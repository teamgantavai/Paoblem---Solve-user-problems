/**
 * Startup AI Matching Library
 *
 * Provides weighted scoring functions to:
 *  1. matchUsersToStartup  — Find best candidates for a startup
 *  2. matchStartupsToUser  — Find best startups for a user
 *
 * No external AI API needed — uses profile fields already collected:
 *   skills, preferred_roles, interests, looking_for, availability,
 *   work_preference, ai_keywords, experience, projects
 */

type AnyRecord = Record<string, any>;

export interface MatchScore {
  score: number;          // 0–100
  reasons: string[];      // human-readable reasons
}

export interface UserMatchResult {
  user_id: string;
  match_score: number;
  match_reasons: string[];
  profile: AnyRecord;
}

export interface StartupMatchResult {
  startup_id: string;
  match_score: number;
  match_reasons: string[];
  startup: AnyRecord;
}

// ── Normalised skill comparison ──────────────────────────────────────────────

function normalizeSkill(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9+#.]/g, '');
}

function skillsOverlap(setA: string[], setB: string[]): number {
  if (!setA.length || !setB.length) return 0;
  const normA = new Set(setA.map(normalizeSkill));
  const normB = new Set(setB.map(normalizeSkill));
  let matches = 0;
  normA.forEach((s) => { if (normB.has(s)) matches++; });
  // Jaccard-like: overlap / min(|A|, |B|)
  return matches / Math.min(normA.size, normB.size);
}

function textOverlap(setA: string[], setB: string[]): number {
  if (!setA.length || !setB.length) return 0;
  const normA = new Set(setA.map((s) => s.trim().toLowerCase()));
  let matches = 0;
  setB.forEach((s) => { if (normA.has(s.trim().toLowerCase())) matches++; });
  return Math.min(matches / Math.max(setB.length, 1), 1);
}

// ── matchUsersToStartup ───────────────────────────────────────────────────────

/**
 * Given a startup and an array of user profiles, return sorted match results.
 *
 * Scoring weights (total = 100):
 *   40 — skills overlap  (user.skills vs startup.required_skills)
 *   25 — role match      (user.preferred_roles vs startup.looking_for)
 *   20 — interest match  (user.interests vs startup.industry + looking_for)
 *   10 — availability    (user has availability + work_preference match)
 *    5 — ai keyword      (user.ai_keywords text overlap with startup description/name)
 */
export function matchUsersToStartup(
  startup: AnyRecord,
  profiles: AnyRecord[]
): UserMatchResult[] {
  const requiredSkills: string[] = startup.required_skills || [];
  const lookingFor: string[] = startup.looking_for || [];
  const startupIndustry: string = startup.industry || '';
  const startupDesc = `${startup.name || ''} ${startup.tagline || ''} ${startup.description || ''} ${startupIndustry}`.toLowerCase();
  const startupWorkType: string = (startup.work_type || '').toLowerCase();

  const results: UserMatchResult[] = profiles.map((profile) => {
    const userSkills: string[] = profile.skills || [];
    const userRoles: string[] = profile.preferred_roles || [];
    const userInterests: string[] = profile.interests || [];
    const userAvailability: string = profile.availability || '';
    const userWorkPref: string = (profile.work_preference || '').toLowerCase();
    const aiKeywords: string[] = profile.ai_keywords || [];

    // ── 1. Skills overlap (40pts) ──
    const skillRatio = skillsOverlap(requiredSkills, userSkills);
    const skillPts = Math.round(skillRatio * 40);

    // ── 2. Role match (25pts) ──
    const roleRatio = textOverlap(lookingFor, userRoles);
    const rolePts = Math.round(roleRatio * 25);

    // ── 3. Interest / industry match (20pts) ──
    const industryKeywords = [startupIndustry, ...lookingFor].filter(Boolean);
    const interestRatio = textOverlap(industryKeywords, userInterests);
    const interestPts = Math.round(interestRatio * 20);

    // ── 4. Availability (10pts) ──
    let availPts = 0;
    if (userAvailability) availPts += 5;
    if (startupWorkType && userWorkPref && (
      startupWorkType === 'remote' ||
      userWorkPref === startupWorkType ||
      userWorkPref === 'flexible'
    )) {
      availPts += 5;
    }

    // ── 5. AI keyword overlap (5pts) ──
    let aiPts = 0;
    if (aiKeywords.length > 0) {
      const matched = aiKeywords.filter((kw) =>
        startupDesc.includes(kw.trim().toLowerCase())
      ).length;
      aiPts = Math.round(Math.min(matched / Math.max(aiKeywords.length, 1), 1) * 5);
    }

    const rawScore = skillPts + rolePts + interestPts + availPts + aiPts;
    // Add a slight base score so even no-match users get shown (minimum 5%)
    const score = Math.min(Math.max(rawScore + 5, 5), 100);

    // ── Human-readable reasons ──
    const reasons: string[] = [];
    if (skillPts >= 10) reasons.push(`Skills match: ${userSkills.filter((s) => requiredSkills.map(normalizeSkill).includes(normalizeSkill(s))).slice(0, 3).join(', ')}`);
    if (rolePts >= 8) reasons.push(`Role alignment: ${userRoles.slice(0, 2).join(', ')}`);
    if (interestPts >= 6) reasons.push(`Shared interests: ${userInterests.filter((i) => industryKeywords.map(s => s.toLowerCase()).includes(i.toLowerCase())).slice(0, 2).join(', ')}`);
    if (availPts >= 5) reasons.push(`Available · ${userAvailability}`);
    if (aiPts >= 3) reasons.push('Strong profile-startup keyword alignment');

    return {
      user_id: profile.id,
      match_score: score,
      match_reasons: reasons,
      profile,
    };
  });

  return results.sort((a, b) => b.match_score - a.match_score);
}

// ── matchStartupsToUser ───────────────────────────────────────────────────────

/**
 * Given a user profile and an array of startups, return sorted match results.
 *
 * Scoring weights (total = 100):
 *   40 — skills match    (user.skills vs startup.required_skills)
 *   25 — role match      (user.preferred_roles vs startup.looking_for)
 *   20 — interest match  (user.interests vs startup.industry)
 *   10 — work preference (user.work_preference vs startup.work_type)
 *    5 — compensation preference
 */
export function matchStartupsToUser(
  profile: AnyRecord,
  startups: AnyRecord[]
): StartupMatchResult[] {
  const userSkills: string[] = profile.skills || [];
  const userRoles: string[] = profile.preferred_roles || [];
  const userInterests: string[] = profile.interests || [];
  const userWorkPref: string = (profile.work_preference || '').toLowerCase();
  const userLookingFor: string[] = profile.looking_for || [];

  const results: StartupMatchResult[] = startups.map((startup) => {
    const requiredSkills: string[] = startup.required_skills || [];
    const lookingFor: string[] = startup.looking_for || [];
    const startupIndustry: string = startup.industry || '';
    const startupWorkType: string = (startup.work_type || '').toLowerCase();
    const startupComp: string = startup.compensation_type || '';

    // ── 1. Skills (40pts) ──
    const skillRatio = skillsOverlap(userSkills, requiredSkills);
    const skillPts = Math.round(skillRatio * 40);

    // ── 2. Role match (25pts) ──
    const roleRatio = textOverlap(userRoles, lookingFor);
    const rolePts = Math.round(roleRatio * 25);

    // ── 3. Interest (20pts) ──
    const industryKeywords = [startupIndustry].filter(Boolean);
    const interestRatio = textOverlap(userInterests, industryKeywords);
    const interestPts = Math.round(interestRatio * 20);

    // ── 4. Work preference (10pts) ──
    let workPts = 0;
    if (startupWorkType === 'remote') workPts = 10;
    else if (userWorkPref && userWorkPref === startupWorkType) workPts = 10;
    else if (userWorkPref === 'flexible') workPts = 7;

    // ── 5. Compensation match (5pts) ──
    let compPts = 0;
    const wantsJoin = userLookingFor.some((l) => l.toLowerCase().includes('startup') || l.toLowerCase().includes('join'));
    if (wantsJoin && (startupComp === 'Equity' || startupComp === 'Paid')) compPts = 5;
    else if (startupComp === 'Internship' && userLookingFor.some((l) => l.toLowerCase().includes('intern'))) compPts = 5;

    const rawScore = skillPts + rolePts + interestPts + workPts + compPts;
    const score = Math.min(Math.max(rawScore + 5, 5), 100);

    const reasons: string[] = [];
    if (skillPts >= 10) reasons.push(`Needs your skills: ${userSkills.filter((s) => requiredSkills.map(normalizeSkill).includes(normalizeSkill(s))).slice(0, 3).join(', ')}`);
    if (rolePts >= 8) reasons.push(`Looking for: ${lookingFor.slice(0, 2).join(', ')}`);
    if (interestPts >= 8) reasons.push(`Industry match: ${startupIndustry}`);
    if (workPts === 10) reasons.push(`${startup.work_type} work`);

    return {
      startup_id: startup.id,
      match_score: score,
      match_reasons: reasons,
      startup,
    };
  });

  return results.sort((a, b) => b.match_score - a.match_score);
}

// ── Helpers for display ───────────────────────────────────────────────────────

export function formatMatchScore(score: number): string {
  return `${Math.round(score)}%`;
}

export function getMatchColor(score: number): string {
  if (score >= 85) return '#10b981'; // green
  if (score >= 65) return '#f59e0b'; // amber
  return '#6b7280';                   // gray
}

export const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Idea:       { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  Validation: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  MVP:        { bg: 'rgba(20,184,166,0.12)', text: '#2dd4bf', border: 'rgba(20,184,166,0.3)' },
  Beta:       { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  Launched:   { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  Revenue:    { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.3)' },
  Funded:     { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', border: 'rgba(239,68,68,0.3)' },
};

export const COMPENSATION_COLORS: Record<string, { bg: string; text: string }> = {
  Equity:         { bg: 'rgba(139,92,246,0.1)', text: '#a78bfa' },
  Paid:           { bg: 'rgba(34,197,94,0.1)',  text: '#4ade80' },
  Internship:     { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa' },
  Volunteer:      { bg: 'rgba(156,163,175,0.1)',text: '#9ca3af' },
  'Revenue Share':{ bg: 'rgba(245,158,11,0.1)', text: '#fbbf24' },
};

export const STARTUP_STAGES: string[] = [
  'Idea', 'Validation', 'MVP', 'Beta', 'Launched', 'Revenue', 'Funded',
];

export const LOOKING_FOR_OPTIONS: string[] = [
  'AI Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Flutter Developer', 'Mobile Developer', 'UI/UX Designer', 'Product Designer',
  'Product Manager', 'Marketing', 'Sales', 'Business Development', 'Co-founder',
  'Data Scientist', 'DevOps Engineer', 'Growth Hacker', 'Content Creator',
];

export const SKILL_OPTIONS: string[] = [
  'React', 'Next.js', 'Node.js', 'Python', 'TypeScript', 'Flutter', 'Firebase',
  'Supabase', 'PostgreSQL', 'AI', 'Machine Learning', 'LLM', 'UI Design',
  'Figma', 'Swift', 'Kotlin', 'Go', 'Rust', 'Docker', 'AWS', 'Marketing', 'Sales',
];

export const INDUSTRY_OPTIONS: string[] = [
  'AI / ML', 'SaaS', 'FinTech', 'HealthTech', 'EdTech', 'E-Commerce',
  'Developer Tools', 'Marketplace', 'Social', 'Gaming', 'Web3 / Crypto',
  'Climate Tech', 'Robotics', 'Cybersecurity', 'Media', 'Other',
];

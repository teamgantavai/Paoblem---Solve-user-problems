// ─── Badge Definitions ────────────────────────────────────────────────────────
// Source of truth for all badge configurations and unlock conditions.
// This mirrors the DB seed in the migration file.

export type BadgeCategory =
  | 'creator' | 'community' | 'popularity' | 'consistency'
  | 'founder' | 'knowledge' | 'special' | 'hidden';

export type BadgeRarity =
  | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type UnlockConditionType =
  | 'post_count' | 'comment_count' | 'upvotes_received'
  | 'streak_days' | 'solution_count' | 'views_count' | 'special';

export interface UnlockCondition {
  type: UnlockConditionType;
  threshold: number;
  post_type?: 'problem' | 'idea' | 'startup';
  special?: string;
}

export interface BadgeDefinition {
  slug: string;
  name: string;
  description: string;
  hint_text: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  rep_reward: number;
  unlock_condition: UnlockCondition;
  sort_order: number;
  is_hidden?: boolean;
  is_limited?: boolean;
  expires_at?: string | null;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  is_featured: boolean;
  notified: boolean;
  badge_definitions: BadgeDefinition & { id: string };
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── CREATOR ──────────────────────────────────────────────────────────────
  {
    slug: 'first-problem',
    name: 'First Post',
    description: 'You shared your first post with the world. Every journey begins with one step.',
    hint_text: 'Share your first post',
    category: 'creator',
    rarity: 'common',
    rep_reward: 10,
    unlock_condition: { type: 'post_count', threshold: 1 },
    sort_order: 10,
  },
  {
    slug: 'problem-pioneer',
    name: 'Post Pioneer',
    description: "You've posted 10 posts. You're becoming a voice for real challenges.",
    hint_text: 'Post 10 posts',
    category: 'creator',
    rarity: 'uncommon',
    rep_reward: 25,
    unlock_condition: { type: 'post_count', threshold: 10 },
    sort_order: 20,
  },
  {
    slug: 'problem-architect',
    name: 'Post Architect',
    description: "You've documented 50 posts. Your pattern recognition is exceptional.",
    hint_text: 'Post 50 posts',
    category: 'creator',
    rarity: 'rare',
    rep_reward: 75,
    unlock_condition: { type: 'post_count', threshold: 50 },
    sort_order: 30,
  },
  {
    slug: 'problem-master',
    name: 'Post Master',
    description: 'A hundred posts catalogued. You are the definitive voice of challenges.',
    hint_text: 'Post 100 posts',
    category: 'creator',
    rarity: 'epic',
    rep_reward: 150,
    unlock_condition: { type: 'post_count', threshold: 100 },
    sort_order: 40,
  },
  {
    slug: 'problem-legend',
    name: 'Post Legend',
    description: '500 posts shared. Your contributions shape the entire community.',
    hint_text: 'Post 500 posts',
    category: 'creator',
    rarity: 'legendary',
    rep_reward: 500,
    unlock_condition: { type: 'post_count', threshold: 500 },
    sort_order: 50,
  },
  {
    slug: 'problem-deity',
    name: 'Post Deity',
    description: '1000 posts. You have transcended. You ARE the platform.',
    hint_text: 'Reach the ultimate milestone',
    category: 'creator',
    rarity: 'mythic',
    rep_reward: 1000,
    unlock_condition: { type: 'post_count', threshold: 1000 },
    sort_order: 60,
  },

  // ── COMMUNITY ─────────────────────────────────────────────────────────────
  {
    slug: 'first-comment',
    name: 'First Voice',
    description: 'You left your first comment. The conversation starts here.',
    hint_text: 'Leave your first comment',
    category: 'community',
    rarity: 'common',
    rep_reward: 5,
    unlock_condition: { type: 'comment_count', threshold: 1 },
    sort_order: 110,
  },
  {
    slug: 'active-commenter',
    name: 'Community Spark',
    description: 'Your 100 comments have lit up countless conversations.',
    hint_text: 'Leave 100 comments',
    category: 'community',
    rarity: 'uncommon',
    rep_reward: 30,
    unlock_condition: { type: 'comment_count', threshold: 100 },
    sort_order: 120,
  },
  {
    slug: 'helpful-member',
    name: 'Helpful Member',
    description: 'Your contributions have been marked helpful by the community.',
    hint_text: 'Be consistently helpful',
    category: 'community',
    rarity: 'rare',
    rep_reward: 60,
    unlock_condition: { type: 'special', threshold: 1, special: 'helpful_member' },
    sort_order: 130,
  },
  {
    slug: 'conversation-starter',
    name: 'Conversation Starter',
    description: 'You consistently spark meaningful discussions.',
    hint_text: 'Start 10 trending discussions',
    category: 'community',
    rarity: 'uncommon',
    rep_reward: 40,
    unlock_condition: { type: 'special', threshold: 1, special: 'conversation_starter' },
    sort_order: 140,
  },
  {
    slug: 'community-voice',
    name: 'Community Voice',
    description: "You've earned the trust of the entire community.",
    hint_text: 'Become a recognized voice',
    category: 'community',
    rarity: 'epic',
    rep_reward: 100,
    unlock_condition: { type: 'special', threshold: 1, special: 'community_voice' },
    sort_order: 150,
  },
  {
    slug: 'community-hero',
    name: 'Community Hero',
    description: 'You are the heartbeat of Paoblem. Legendary contributor.',
    hint_text: 'Reach hero status in the community',
    category: 'community',
    rarity: 'legendary',
    rep_reward: 400,
    unlock_condition: { type: 'special', threshold: 1, special: 'community_hero' },
    sort_order: 160,
  },

  // ── POPULARITY ────────────────────────────────────────────────────────────
  {
    slug: 'first-100-upvotes',
    name: 'Rising Star',
    description: 'Your content has been upvoted 100 times. People love what you share.',
    hint_text: 'Receive 100 upvotes',
    category: 'popularity',
    rarity: 'common',
    rep_reward: 20,
    unlock_condition: { type: 'upvotes_received', threshold: 100 },
    sort_order: 210,
  },
  {
    slug: 'thousand-upvotes',
    name: 'Fan Favorite',
    description: "1,000 upvotes. You're creating content that truly resonates.",
    hint_text: 'Receive 1,000 upvotes',
    category: 'popularity',
    rarity: 'rare',
    rep_reward: 80,
    unlock_condition: { type: 'upvotes_received', threshold: 1000 },
    sort_order: 220,
  },
  {
    slug: 'views-10k',
    name: '10K Views',
    description: 'Your problems have been viewed 10,000 times. Your reach is growing.',
    hint_text: 'Get 10,000 total views',
    category: 'popularity',
    rarity: 'uncommon',
    rep_reward: 40,
    unlock_condition: { type: 'views_count', threshold: 10000 },
    sort_order: 230,
  },
  {
    slug: 'views-100k',
    name: '100K Views',
    description: "100,000 eyes on your content. You're a true platform influencer.",
    hint_text: 'Get 100,000 total views',
    category: 'popularity',
    rarity: 'epic',
    rep_reward: 200,
    unlock_condition: { type: 'views_count', threshold: 100000 },
    sort_order: 240,
  },
  {
    slug: 'trending-creator',
    name: 'Trending Creator',
    description: 'Your post has been on the trending list. The community is watching.',
    hint_text: 'Get a post into trending',
    category: 'popularity',
    rarity: 'rare',
    rep_reward: 75,
    unlock_condition: { type: 'special', threshold: 1, special: 'trending_creator' },
    sort_order: 250,
  },
  {
    slug: 'viral-problem',
    name: 'Viral Problem',
    description: "One of your problems went viral. You captured the internet's attention.",
    hint_text: 'Get a post to go viral',
    category: 'popularity',
    rarity: 'legendary',
    rep_reward: 300,
    unlock_condition: { type: 'special', threshold: 1, special: 'viral_problem' },
    sort_order: 260,
  },

  // ── CONSISTENCY ───────────────────────────────────────────────────────────
  {
    slug: 'streak-3',
    name: 'Habit Builder',
    description: "3 days in a row. You're building a powerful habit.",
    hint_text: 'Post 3 days in a row',
    category: 'consistency',
    rarity: 'common',
    rep_reward: 15,
    unlock_condition: { type: 'streak_days', threshold: 3 },
    sort_order: 310,
  },
  {
    slug: 'streak-7',
    name: 'Weekly Warrior',
    description: 'A full week of consistency. Your dedication is impressive.',
    hint_text: 'Post 7 days in a row',
    category: 'consistency',
    rarity: 'uncommon',
    rep_reward: 35,
    unlock_condition: { type: 'streak_days', threshold: 7 },
    sort_order: 320,
  },
  {
    slug: 'streak-30',
    name: 'Monthly Maven',
    description: "30 days straight. You've turned posting into a discipline.",
    hint_text: 'Post 30 days in a row',
    category: 'consistency',
    rarity: 'rare',
    rep_reward: 100,
    unlock_condition: { type: 'streak_days', threshold: 30 },
    sort_order: 330,
  },
  {
    slug: 'streak-100',
    name: 'Centurion',
    description: '100 consecutive days. Your consistency is superhuman.',
    hint_text: 'Post 100 days in a row',
    category: 'consistency',
    rarity: 'epic',
    rep_reward: 250,
    unlock_condition: { type: 'streak_days', threshold: 100 },
    sort_order: 340,
  },
  {
    slug: 'streak-365',
    name: 'Year of Dedication',
    description: '365 days. One entire year of consistency. Truly legendary.',
    hint_text: 'Post every single day for a year',
    category: 'consistency',
    rarity: 'mythic',
    rep_reward: 750,
    unlock_condition: { type: 'streak_days', threshold: 365 },
    sort_order: 350,
  },

  // ── FOUNDER ───────────────────────────────────────────────────────────────
  {
    slug: 'startup-founder',
    name: 'Startup Founder',
    description: "You've shared your first startup with the Paoblem community.",
    hint_text: 'Share your startup story',
    category: 'founder',
    rarity: 'uncommon',
    rep_reward: 30,
    unlock_condition: { type: 'post_count', threshold: 1, post_type: 'startup' },
    sort_order: 410,
  },
  {
    slug: 'product-launch',
    name: 'Product Launcher',
    description: 'You launched a product and told the world about it.',
    hint_text: 'Document your product launch',
    category: 'founder',
    rarity: 'rare',
    rep_reward: 60,
    unlock_condition: { type: 'special', threshold: 1, special: 'product_launch' },
    sort_order: 420,
  },
  {
    slug: 'first-customer',
    name: 'First Customer',
    description: "You landed your first customer. The hardest step is done.",
    hint_text: 'Share getting your first customer',
    category: 'founder',
    rarity: 'rare',
    rep_reward: 75,
    unlock_condition: { type: 'special', threshold: 1, special: 'first_customer' },
    sort_order: 430,
  },
  {
    slug: 'revenue-milestone',
    name: 'Revenue Milestone',
    description: 'You hit a revenue milestone worth celebrating publicly.',
    hint_text: 'Share a revenue achievement',
    category: 'founder',
    rarity: 'epic',
    rep_reward: 150,
    unlock_condition: { type: 'special', threshold: 1, special: 'revenue_milestone' },
    sort_order: 440,
  },
  {
    slug: 'founder-legend',
    name: 'Founder Legend',
    description: 'Your founder journey has inspired hundreds. You are a beacon.',
    hint_text: 'Become a legendary founder on Paoblem',
    category: 'founder',
    rarity: 'legendary',
    rep_reward: 500,
    unlock_condition: { type: 'special', threshold: 1, special: 'founder_legend' },
    sort_order: 450,
  },

  // ── KNOWLEDGE ─────────────────────────────────────────────────────────────
  {
    slug: 'business-thinker',
    name: 'Business Thinker',
    description: 'Your strategic thinking shines through your problems and ideas.',
    hint_text: 'Show deep business understanding',
    category: 'knowledge',
    rarity: 'uncommon',
    rep_reward: 30,
    unlock_condition: { type: 'special', threshold: 1, special: 'business_thinker' },
    sort_order: 510,
  },
  {
    slug: 'marketing-expert',
    name: 'Marketing Expert',
    description: 'Your marketing insights are frequently upvoted and referenced.',
    hint_text: 'Demonstrate marketing expertise',
    category: 'knowledge',
    rarity: 'uncommon',
    rep_reward: 30,
    unlock_condition: { type: 'special', threshold: 1, special: 'marketing_expert' },
    sort_order: 520,
  },
  {
    slug: 'ai-expert',
    name: 'AI Expert',
    description: 'Your AI-related problems and ideas show deep domain knowledge.',
    hint_text: 'Share deep AI expertise',
    category: 'knowledge',
    rarity: 'rare',
    rep_reward: 60,
    unlock_condition: { type: 'special', threshold: 1, special: 'ai_expert' },
    sort_order: 530,
  },
  {
    slug: 'problem-solver',
    name: 'Problem Solver',
    description: "You've provided solutions that others found genuinely useful.",
    hint_text: 'Help solve 25 problems',
    category: 'knowledge',
    rarity: 'rare',
    rep_reward: 80,
    unlock_condition: { type: 'solution_count', threshold: 25 },
    sort_order: 540,
  },
  {
    slug: 'innovator',
    name: 'Innovator',
    description: 'Your ideas consistently push boundaries and inspire others.',
    hint_text: 'Inspire the community with innovation',
    category: 'knowledge',
    rarity: 'epic',
    rep_reward: 120,
    unlock_condition: { type: 'special', threshold: 1, special: 'innovator' },
    sort_order: 550,
  },

  // ── SPECIAL ───────────────────────────────────────────────────────────────
  {
    slug: 'early-adopter',
    name: 'Early Adopter',
    description: 'You joined Paoblem in the earliest days. You helped shape the platform.',
    hint_text: 'Join during the beta period',
    category: 'special',
    rarity: 'legendary',
    rep_reward: 200,
    unlock_condition: { type: 'special', threshold: 1, special: 'early_adopter' },
    sort_order: 610,
  },
  {
    slug: 'beta-member',
    name: 'Beta Member',
    description: 'You were part of the exclusive beta program that tested Paoblem.',
    hint_text: 'Participate in the beta program',
    category: 'special',
    rarity: 'epic',
    rep_reward: 100,
    unlock_condition: { type: 'special', threshold: 1, special: 'beta_member' },
    sort_order: 620,
  },
  {
    slug: 'verified-user',
    name: 'Verified',
    description: 'Your identity has been verified by the Paoblem team.',
    hint_text: 'Complete identity verification',
    category: 'special',
    rarity: 'rare',
    rep_reward: 50,
    unlock_condition: { type: 'special', threshold: 1, special: 'verified_user' },
    sort_order: 630,
  },
  {
    slug: 'contributor',
    name: 'Contributor',
    description: "You contributed to making Paoblem better — code, feedback, or more.",
    hint_text: "Contribute to Paoblem's growth",
    category: 'special',
    rarity: 'rare',
    rep_reward: 75,
    unlock_condition: { type: 'special', threshold: 1, special: 'contributor' },
    sort_order: 640,
  },
  {
    slug: 'hall-of-fame',
    name: 'Hall of Fame',
    description: 'You have been inducted into the Paoblem Hall of Fame. Permanent recognition.',
    hint_text: 'Be inducted by the Paoblem team',
    category: 'special',
    rarity: 'mythic',
    rep_reward: 1000,
    unlock_condition: { type: 'special', threshold: 1, special: 'hall_of_fame' },
    sort_order: 650,
  },
  {
    slug: 'moderator',
    name: 'Moderator',
    description: 'You help keep Paoblem safe and constructive for everyone.',
    hint_text: 'Become a platform moderator',
    category: 'special',
    rarity: 'epic',
    rep_reward: 150,
    unlock_condition: { type: 'special', threshold: 1, special: 'moderator' },
    sort_order: 660,
  },
  {
    slug: 'ambassador',
    name: 'Ambassador',
    description: 'You represent Paoblem and spread its mission to the world.',
    hint_text: 'Become a Paoblem ambassador',
    category: 'special',
    rarity: 'legendary',
    rep_reward: 300,
    unlock_condition: { type: 'special', threshold: 1, special: 'ambassador' },
    sort_order: 670,
  },

  // ── HIDDEN ACHIEVEMENTS ───────────────────────────────────────────────────
  {
    slug: 'night-owl',
    name: 'Night Owl',
    description: 'You posted between midnight and 4am. The night belongs to creators.',
    hint_text: 'A secret awaits the night...',
    category: 'hidden',
    rarity: 'uncommon',
    rep_reward: 25,
    is_hidden: true,
    unlock_condition: { type: 'special', threshold: 1, special: 'night_owl' },
    sort_order: 710,
  },
  {
    slug: 'early-bird',
    name: 'Early Bird',
    description: 'You posted between 5am and 7am. First light, first ideas.',
    hint_text: 'Discover the early bird secret',
    category: 'hidden',
    rarity: 'uncommon',
    rep_reward: 25,
    is_hidden: true,
    unlock_condition: { type: 'special', threshold: 1, special: 'early_bird' },
    sort_order: 720,
  },
  {
    slug: 'lucky-creator',
    name: 'Lucky Creator',
    description: 'Something fortunate happened on a special day.',
    hint_text: 'A stroke of luck awaits',
    category: 'hidden',
    rarity: 'rare',
    rep_reward: 50,
    is_hidden: true,
    unlock_condition: { type: 'special', threshold: 1, special: 'lucky_creator' },
    sort_order: 730,
  },
  {
    slug: 'silent-observer',
    name: 'Silent Observer',
    description: "You've read 500 posts without ever commenting. A true observer.",
    hint_text: 'The silent path holds secrets',
    category: 'hidden',
    rarity: 'common',
    rep_reward: 15,
    is_hidden: true,
    unlock_condition: { type: 'special', threshold: 1, special: 'silent_observer' },
    sort_order: 740,
  },
  {
    slug: 'trend-starter',
    name: 'Trend Starter',
    description: 'Your post sparked a wave that others followed.',
    hint_text: 'Something viral this way comes',
    category: 'hidden',
    rarity: 'epic',
    rep_reward: 120,
    is_hidden: true,
    unlock_condition: { type: 'special', threshold: 1, special: 'trend_starter' },
    sort_order: 750,
  },
  {
    slug: 'master-explorer',
    name: 'Master Explorer',
    description: "You've visited every corner of Paoblem at least once.",
    hint_text: 'Explore the unknown territories',
    category: 'hidden',
    rarity: 'rare',
    rep_reward: 60,
    is_hidden: true,
    unlock_condition: { type: 'special', threshold: 1, special: 'master_explorer' },
    sort_order: 760,
  },
];

// ── Rarity Colors ─────────────────────────────────────────────────────────────
export const RARITY_CONFIG: Record<BadgeRarity, {
  label: string;
  color: string;
  glow: string;
  border: string;
  bg: string;
  textColor: string;
}> = {
  common:    { label: 'Common',    color: '#9ca3af', glow: 'rgba(156,163,175,0.3)', border: '#6b7280', bg: 'rgba(156,163,175,0.08)', textColor: '#d1d5db' },
  uncommon:  { label: 'Uncommon',  color: '#4ade80', glow: 'rgba(74,222,128,0.35)', border: '#22c55e', bg: 'rgba(74,222,128,0.08)', textColor: '#4ade80' },
  rare:      { label: 'Rare',      color: '#60a5fa', glow: 'rgba(96,165,250,0.4)',  border: '#3b82f6', bg: 'rgba(96,165,250,0.1)',  textColor: '#60a5fa' },
  epic:      { label: 'Epic',      color: '#c084fc', glow: 'rgba(192,132,252,0.45)', border: '#a855f7', bg: 'rgba(192,132,252,0.1)', textColor: '#c084fc' },
  legendary: { label: 'Legendary', color: '#fbbf24', glow: 'rgba(251,191,36,0.5)', border: '#f59e0b', bg: 'rgba(251,191,36,0.1)', textColor: '#fbbf24' },
  mythic:    { label: 'Mythic',    color: '#f472b6', glow: 'rgba(244,114,182,0.5)', border: 'url(#mythic-gradient)', bg: 'rgba(244,114,182,0.1)', textColor: '#f9a8d4' },
};

export const CATEGORY_CONFIG: Record<BadgeCategory, { label: string; icon: string; description: string }> = {
  creator:     { label: 'Creator',     icon: '✍️', description: 'For sharing problems, ideas, and startups' },
  community:   { label: 'Community',   icon: '🤝', description: 'For building connections and conversations' },
  popularity:  { label: 'Popularity',  icon: '🔥', description: 'For earning upvotes, views, and virality' },
  consistency: { label: 'Consistency', icon: '⚡', description: 'For showing up every single day' },
  founder:     { label: 'Founder',     icon: '🚀', description: 'For the entrepreneurial journey' },
  knowledge:   { label: 'Knowledge',   icon: '💡', description: 'For demonstrating deep expertise' },
  special:     { label: 'Special',     icon: '⭐', description: 'Exclusive platform recognition' },
  hidden:      { label: 'Hidden',      icon: '🔮', description: 'Secret achievements waiting to be discovered' },
};

export function getBadgesByCategory(category: BadgeCategory): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter(b => b.category === category).sort((a, b) => a.sort_order - b.sort_order);
}

export function getBadgeBySlug(slug: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.slug === slug);
}

export function getRarityOrder(rarity: BadgeRarity): number {
  const order: Record<BadgeRarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
  return order[rarity];
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processProfileAi } from '@/lib/profileAi';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SELECT_FIELDS = [
  'id', 'full_name', 'avatar_url', 'role', 'bio', 'location', 'created_at', 'username', 'cover_url', 'reputation',
  'pref_receive_saves', 'pref_receive_analytics', 'pref_receive_solutions', 'pref_receive_replies',
  'headline', 'languages', 'github', 'linkedin', 'twitter', 'youtube', 'other_link', 'website',
  'about', 'skills', 'looking_for', 'preferred_roles', 'availability', 'work_preference', 'interests',
  'experience', 'projects', 'ai_summary', 'ai_keywords', 'last_ai_update'
].join(', ');

// ── GET /api/profile?userId=<id> ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const username = req.nextUrl.searchParams.get('username');
    if (!userId && !username) {
      return NextResponse.json({ error: 'userId or username is required' }, { status: 400 });
    }

    // Check if requester is the owner by parsing auth header
    const authHeader = req.headers.get('Authorization');
    let requestingUserId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) requestingUserId = user.id;
      } catch (err) {
        // Safe to ignore token parsing errors for public retrieval
      }
    }

    // Fetch profile
    let query = supabaseAdmin
      .from('profiles')
      .select(SELECT_FIELDS as any);

    if (userId) {
      query = query.eq('id', userId);
    } else {
      query = query.eq('username', username);
    }

    let { data: profile, error: profileError } = (await query.single()) as { data: any, error: any };

    if ((profileError || !profile) && userId) {
      console.warn(`[GET /api/profile] Profile missing for user ${userId}, checking auth.users...`);
      const { data: { user }, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (user && !authUserError) {
        console.log(`[GET /api/profile] User exists in auth.users, creating fallback profile...`);
        const fallbackUsername = user.user_metadata?.username || user.email?.split('@')[0] || `user_${userId.slice(0, 8)}`;
        const { data: newProfile, error: profileCreateError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member',
            avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
            role: user.user_metadata?.role || 'Innovator',
            username: fallbackUsername,
            reputation: 0
          })
          .select(SELECT_FIELDS as any)
          .single();

        if (!profileCreateError && newProfile) {
          profile = newProfile;
          profileError = null;
        } else {
          console.error('[GET /api/profile] Failed to create fallback profile:', profileCreateError);
        }
      }
    }

    if (profileError || !profile) {
      console.error('[GET /api/profile] profileError:', profileError, 'profile:', profile);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const targetUserId = profile.id;
    const isOwner = requestingUserId && requestingUserId === targetUserId;

    // Filter out private AI Recommendation data for public visitors
    const responseProfile = { ...profile };
    if (!isOwner) {
      delete responseProfile.ai_summary;
      delete responseProfile.ai_keywords;
      delete responseProfile.last_ai_update;
    }

    // Fetch post count
    const { count: postCount } = await supabaseAdmin
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    // Fetch comment count
    const { count: commentCount } = await supabaseAdmin
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    // Fetch total upvotes received on user's posts
    const { data: posts } = await supabaseAdmin
      .from('posts')
      .select('upvotes')
      .eq('user_id', targetUserId);

    const totalUpvotes = posts?.reduce((sum, p) => sum + (p.upvotes || 0), 0) ?? 0;

    return NextResponse.json({
      profile: responseProfile,
      stats: {
        postCount: postCount ?? 0,
        commentCount: commentCount ?? 0,
        totalUpvotes,
      }
    });
  } catch (err: any) {
    console.error('[GET /api/profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT /api/profile ──────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      full_name, role, bio, location, avatar_url, username, cover_url,
      pref_receive_saves, pref_receive_analytics, pref_receive_solutions, pref_receive_replies,
      headline, languages, github, linkedin, twitter, youtube, other_link, website,
      about, skills, looking_for, preferred_roles, availability, work_preference, interests,
      experience, projects
    } = body;

    // Validate role
    const VALID_ROLES = ['Innovator', 'Founder', 'Builder', 'Developer', 'Designer', 'Investor', 'Maker', 'Researcher'];
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Fetch current profile to get current username
    const { data: currentProfile, error: getProfileError } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (getProfileError || !currentProfile) {
      return NextResponse.json({ error: 'Failed to retrieve profile' }, { status: 500 });
    }

    const currentUsername = currentProfile.username;
    let usernameChangedThisTime = false;

    const updates: Record<string, any> = {};
    if (full_name !== undefined) updates.full_name = full_name?.trim() || null;
    if (role !== undefined) updates.role = role;
    if (bio !== undefined) updates.bio = bio?.trim() || null;
    if (location !== undefined) updates.location = location?.trim() || null;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (cover_url !== undefined) updates.cover_url = cover_url;
    if (pref_receive_saves !== undefined) updates.pref_receive_saves = !!pref_receive_saves;
    if (pref_receive_analytics !== undefined) updates.pref_receive_analytics = !!pref_receive_analytics;
    if (pref_receive_solutions !== undefined) updates.pref_receive_solutions = !!pref_receive_solutions;
    if (pref_receive_replies !== undefined) updates.pref_receive_replies = !!pref_receive_replies;
    
    // Rich profile updates
    if (headline !== undefined) updates.headline = headline?.trim() || null;
    if (languages !== undefined) updates.languages = Array.isArray(languages) ? languages.map(l => l.trim()).filter(Boolean) : [];
    if (github !== undefined) updates.github = github?.trim() || null;
    if (linkedin !== undefined) updates.linkedin = linkedin?.trim() || null;
    if (twitter !== undefined) updates.twitter = twitter?.trim() || null;
    if (youtube !== undefined) updates.youtube = youtube?.trim() || null;
    if (other_link !== undefined) updates.other_link = other_link?.trim() || null;
    if (website !== undefined) updates.website = website?.trim() || null;
    if (about !== undefined) updates.about = about || null;
    if (skills !== undefined) updates.skills = Array.isArray(skills) ? skills.map(s => s.trim()).filter(Boolean) : [];
    if (looking_for !== undefined) updates.looking_for = Array.isArray(looking_for) ? looking_for.map(l => l.trim()).filter(Boolean) : [];
    if (preferred_roles !== undefined) updates.preferred_roles = Array.isArray(preferred_roles) ? preferred_roles.map(r => r.trim()).filter(Boolean) : [];
    if (availability !== undefined) updates.availability = availability?.trim() || null;
    if (work_preference !== undefined) updates.work_preference = work_preference?.trim() || null;
    if (interests !== undefined) updates.interests = Array.isArray(interests) ? interests.map(i => i.trim()).filter(Boolean) : [];
    if (experience !== undefined) updates.experience = Array.isArray(experience) ? experience : [];
    if (projects !== undefined) updates.projects = Array.isArray(projects) ? projects : [];

    if (username !== undefined) {
      const cleanUsername = username?.trim().toLowerCase();
      if (!cleanUsername) {
        return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 });
      }
      if (cleanUsername.length < 3) {
        return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
      }
      if (/[^a-z0-9_]/.test(cleanUsername)) {
        return NextResponse.json({ error: 'Username can only contain lowercase letters, numbers, and underscores' }, { status: 400 });
      }

      if (cleanUsername !== currentUsername) {
        const usernameChanged = !!user.user_metadata?.username_changed;
        if (usernameChanged) {
          return NextResponse.json({ error: 'Username can only be changed once' }, { status: 400 });
        }

        // Check if username is already taken by another user
        const { data: existing, error: checkError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .neq('id', user.id)
          .maybeSingle();

        if (checkError) {
          return NextResponse.json({ error: 'Failed to validate username' }, { status: 500 });
        }
        if (existing) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }

        updates.username = cleanUsername;
        usernameChangedThisTime = true;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // First save the user-updated fields to profiles
    const { data: updated, error: updateError } = (await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select(SELECT_FIELDS as any)
      .single()) as { data: any, error: any };

    if (updateError) {
      console.error('[PUT /api/profile] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Also update auth metadata so role/name/avatar/username/cover_url is reflected in session
    if (full_name !== undefined || role !== undefined || avatar_url !== undefined || username !== undefined || cover_url !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          ...(full_name !== undefined ? { full_name: updates.full_name } : {}),
          ...(role !== undefined ? { role } : {}),
          ...(avatar_url !== undefined ? { avatar_url } : {}),
          ...(cover_url !== undefined ? { cover_url } : {}),
          ...(username !== undefined ? { username: updates.username } : {}),
          ...(usernameChangedThisTime ? { username_changed: true } : {}),
        }
      });
    }

    // Process AI optimization fields synchronously to provide immediate profile readiness response
    let finalProfile = updated;
    try {
      const aiInput = {
        full_name: updated.full_name,
        headline: updated.headline,
        bio: updated.bio,
        about: updated.about,
        skills: updated.skills || [],
        looking_for: updated.looking_for || [],
        preferred_roles: updated.preferred_roles || [],
        availability: updated.availability,
        work_preference: updated.work_preference,
        interests: updated.interests || [],
        experience: updated.experience || [],
        projects: updated.projects || []
      };

      const aiOutput = await processProfileAi(aiInput);

      const { data: updatedWithAi, error: aiUpdateError } = (await supabaseAdmin
        .from('profiles')
        .update(aiOutput)
        .eq('id', user.id)
        .select(SELECT_FIELDS as any)
        .single()) as { data: any, error: any };

      if (!aiUpdateError && updatedWithAi) {
        finalProfile = updatedWithAi;
      } else {
        console.error('[PUT /api/profile] Database error saving AI output:', aiUpdateError);
      }
    } catch (aiErr) {
      console.error('[PUT /api/profile] Failed to generate AI summary/embeddings:', aiErr);
    }

    return NextResponse.json({ profile: finalProfile });
  } catch (err: any) {
    console.error('[PUT /api/profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


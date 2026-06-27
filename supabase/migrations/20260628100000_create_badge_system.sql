-- ═══════════════════════════════════════════════════════════════════════════
-- Paoblem Badge System Migration
-- Creates badge_definitions and user_badges tables with full RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Badge Definitions ────────────────────────────────────────────────────────
-- Source of truth for all badge types. Managed by admins.
CREATE TABLE IF NOT EXISTS badge_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,           -- machine-readable ID e.g. "first-problem"
  name          TEXT NOT NULL,                  -- display name
  description   TEXT NOT NULL,                  -- shown when earned
  hint_text     TEXT DEFAULT 'Keep exploring...', -- shown to locked users
  category      TEXT NOT NULL CHECK (category IN (
                  'creator', 'community', 'popularity', 'consistency',
                  'founder', 'knowledge', 'special', 'hidden'
                )),
  rarity        TEXT NOT NULL CHECK (rarity IN (
                  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'
                )),
  is_hidden     BOOLEAN DEFAULT FALSE,          -- artwork hidden until unlocked
  is_active     BOOLEAN DEFAULT TRUE,           -- whether badge can be newly earned
  is_limited    BOOLEAN DEFAULT FALSE,          -- limited-time badge
  expires_at    TIMESTAMPTZ,                    -- NULL = never expires
  rep_reward    INTEGER DEFAULT 0,              -- reputation points awarded
  unlock_condition JSONB NOT NULL DEFAULT '{}', -- structured condition spec
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Badges ──────────────────────────────────────────────────────────────
-- Records which users have earned which badges.
CREATE TABLE IF NOT EXISTS user_badges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id      UUID NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at     TIMESTAMPTZ DEFAULT NOW(),
  is_featured   BOOLEAN DEFAULT FALSE,          -- shown prominently on profile
  notified      BOOLEAN DEFAULT FALSE,          -- has user seen the unlock popup
  UNIQUE(user_id, badge_id)                     -- each user earns each badge once
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at ON user_badges(earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_badge_definitions_category ON badge_definitions(category);
CREATE INDEX IF NOT EXISTS idx_badge_definitions_rarity ON badge_definitions(rarity);
CREATE INDEX IF NOT EXISTS idx_badge_definitions_slug ON badge_definitions(slug);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Badge definitions: anyone can read active badges
CREATE POLICY "Anyone can view badge definitions"
  ON badge_definitions FOR SELECT
  USING (true);

-- User badges: anyone can view earned badges (for profiles)
CREATE POLICY "Anyone can view user badges"
  ON user_badges FOR SELECT
  USING (true);

-- User badges: only service role inserts (via API routes)
CREATE POLICY "Service role can insert user badges"
  ON user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User badges: users can update their own (e.g. set is_featured)
CREATE POLICY "Users can update own badges"
  ON user_badges FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Seed: All Badge Definitions ──────────────────────────────────────────────
INSERT INTO badge_definitions (slug, name, description, hint_text, category, rarity, rep_reward, unlock_condition, sort_order) VALUES

-- CREATOR BADGES
('first-problem', 'First Problem', 'You shared your first problem with the world. Every journey begins with one step.', 'Share your first problem', 'creator', 'common', 10, '{"type":"post_count","threshold":1,"post_type":"problem"}', 10),
('problem-pioneer', 'Problem Pioneer', 'You''ve posted 10 problems. You''re becoming a voice for real challenges.', 'Post 10 problems', 'creator', 'uncommon', 25, '{"type":"post_count","threshold":10,"post_type":"problem"}', 20),
('problem-architect', 'Problem Architect', 'You''ve documented 50 problems. Your pattern recognition is exceptional.', 'Post 50 problems', 'creator', 'rare', 75, '{"type":"post_count","threshold":50,"post_type":"problem"}', 30),
('problem-master', 'Problem Master', 'A hundred problems catalogued. You are the definitive voice of challenges.', 'Post 100 problems', 'creator', 'epic', 150, '{"type":"post_count","threshold":100,"post_type":"problem"}', 40),
('problem-legend', 'Problem Legend', '500 problems shared. Your contributions shape the entire community.', 'Post 500 problems', 'creator', 'legendary', 500, '{"type":"post_count","threshold":500,"post_type":"problem"}', 50),
('problem-deity', 'Problem Deity', '1000 problems. You have transcended. You ARE the platform.', 'Reach the ultimate milestone', 'creator', 'mythic', 1000, '{"type":"post_count","threshold":1000,"post_type":"problem"}', 60),

-- COMMUNITY BADGES
('first-comment', 'First Voice', 'You left your first comment. The conversation starts here.', 'Leave your first comment', 'community', 'common', 5, '{"type":"comment_count","threshold":1}', 110),
('active-commenter', 'Community Spark', 'Your 100 comments have lit up countless conversations.', 'Leave 100 comments', 'community', 'uncommon', 30, '{"type":"comment_count","threshold":100}', 120),
('helpful-member', 'Helpful Member', 'Your contributions have been marked helpful by the community.', 'Be consistently helpful', 'community', 'rare', 60, '{"type":"special","threshold":1,"special":"helpful_member"}', 130),
('conversation-starter', 'Conversation Starter', 'You consistently spark meaningful discussions.', 'Start 10 trending discussions', 'community', 'uncommon', 40, '{"type":"special","threshold":1,"special":"conversation_starter"}', 140),
('community-voice', 'Community Voice', 'You''ve earned the trust of the entire community.', 'Become a recognized voice', 'community', 'epic', 100, '{"type":"special","threshold":1,"special":"community_voice"}', 150),
('community-hero', 'Community Hero', 'You are the heartbeat of Paoblem. Legendary contributor.', 'Reach hero status in the community', 'community', 'legendary', 400, '{"type":"special","threshold":1,"special":"community_hero"}', 160),

-- POPULARITY BADGES
('first-100-upvotes', 'Rising Star', 'Your content has been upvoted 100 times. People love what you share.', 'Receive 100 upvotes', 'popularity', 'common', 20, '{"type":"upvotes_received","threshold":100}', 210),
('thousand-upvotes', 'Fan Favorite', '1,000 upvotes. You''re creating content that truly resonates.', 'Receive 1,000 upvotes', 'popularity', 'rare', 80, '{"type":"upvotes_received","threshold":1000}', 220),
('views-10k', '10K Views', 'Your problems have been viewed 10,000 times. Your reach is growing.', 'Get 10,000 total views', 'popularity', 'uncommon', 40, '{"type":"views_count","threshold":10000}', 230),
('views-100k', '100K Views', '100,000 eyes on your content. You''re a true platform influencer.', 'Get 100,000 total views', 'popularity', 'epic', 200, '{"type":"views_count","threshold":100000}', 240),
('trending-creator', 'Trending Creator', 'Your post has been on the trending list. The community is watching.', 'Get a post into trending', 'popularity', 'rare', 75, '{"type":"special","threshold":1,"special":"trending_creator"}', 250),
('viral-problem', 'Viral Problem', 'One of your problems went viral. You captured the internet''s attention.', 'Get a post to go viral', 'popularity', 'legendary', 300, '{"type":"special","threshold":1,"special":"viral_problem"}', 260),

-- CONSISTENCY BADGES
('streak-3', 'Habit Builder', '3 days in a row. You''re building a powerful habit.', 'Post 3 days in a row', 'consistency', 'common', 15, '{"type":"streak_days","threshold":3}', 310),
('streak-7', 'Weekly Warrior', 'A full week of consistency. Your dedication is impressive.', 'Post 7 days in a row', 'consistency', 'uncommon', 35, '{"type":"streak_days","threshold":7}', 320),
('streak-30', 'Monthly Maven', '30 days straight. You''ve turned posting into a discipline.', 'Post 30 days in a row', 'consistency', 'rare', 100, '{"type":"streak_days","threshold":30}', 330),
('streak-100', 'Centurion', '100 consecutive days. Your consistency is superhuman.', 'Post 100 days in a row', 'consistency', 'epic', 250, '{"type":"streak_days","threshold":100}', 340),
('streak-365', 'Year of Dedication', '365 days. One entire year of consistency. Truly legendary.', 'Post every single day for a year', 'consistency', 'mythic', 750, '{"type":"streak_days","threshold":365}', 350),

-- FOUNDER BADGES
('startup-founder', 'Startup Founder', 'You''ve shared your first startup with the Paoblem community.', 'Share your startup story', 'founder', 'uncommon', 30, '{"type":"post_count","threshold":1,"post_type":"startup"}', 410),
('product-launch', 'Product Launcher', 'You launched a product and told the world about it.', 'Document your product launch', 'founder', 'rare', 60, '{"type":"special","threshold":1,"special":"product_launch"}', 420),
('first-customer', 'First Customer', 'You landed your first customer. The hardest step is done.', 'Share getting your first customer', 'founder', 'rare', 75, '{"type":"special","threshold":1,"special":"first_customer"}', 430),
('revenue-milestone', 'Revenue Milestone', 'You hit a revenue milestone worth celebrating publicly.', 'Share a revenue achievement', 'founder', 'epic', 150, '{"type":"special","threshold":1,"special":"revenue_milestone"}', 440),
('founder-legend', 'Founder Legend', 'Your founder journey has inspired hundreds. You are a beacon.', 'Become a legendary founder on Paoblem', 'founder', 'legendary', 500, '{"type":"special","threshold":1,"special":"founder_legend"}', 450),

-- KNOWLEDGE BADGES
('business-thinker', 'Business Thinker', 'Your strategic thinking shines through your problems and ideas.', 'Show deep business understanding', 'knowledge', 'uncommon', 30, '{"type":"special","threshold":1,"special":"business_thinker"}', 510),
('marketing-expert', 'Marketing Expert', 'Your marketing insights are frequently upvoted and referenced.', 'Demonstrate marketing expertise', 'knowledge', 'uncommon', 30, '{"type":"special","threshold":1,"special":"marketing_expert"}', 520),
('ai-expert', 'AI Expert', 'Your AI-related problems and ideas show deep domain knowledge.', 'Share deep AI expertise', 'knowledge', 'rare', 60, '{"type":"special","threshold":1,"special":"ai_expert"}', 530),
('problem-solver', 'Problem Solver', 'You''ve provided solutions that others found genuinely useful.', 'Help solve 25 problems', 'knowledge', 'rare', 80, '{"type":"solution_count","threshold":25}', 540),
('innovator', 'Innovator', 'Your ideas consistently push boundaries and inspire others.', 'Inspire the community with innovation', 'knowledge', 'epic', 120, '{"type":"special","threshold":1,"special":"innovator"}', 550),

-- SPECIAL BADGES
('early-adopter', 'Early Adopter', 'You joined Paoblem in the earliest days. You helped shape the platform.', 'Join during the beta period', 'special', 'legendary', 200, '{"type":"special","threshold":1,"special":"early_adopter"}', 610),
('beta-member', 'Beta Member', 'You were part of the exclusive beta program that tested Paoblem.', 'Participate in the beta program', 'special', 'epic', 100, '{"type":"special","threshold":1,"special":"beta_member"}', 620),
('verified-user', 'Verified', 'Your identity has been verified by the Paoblem team.', 'Complete identity verification', 'special', 'rare', 50, '{"type":"special","threshold":1,"special":"verified_user"}', 630),
('contributor', 'Contributor', 'You contributed to making Paoblem better — code, feedback, or more.', 'Contribute to Paoblem''s growth', 'special', 'rare', 75, '{"type":"special","threshold":1,"special":"contributor"}', 640),
('hall-of-fame', 'Hall of Fame', 'You have been inducted into the Paoblem Hall of Fame. Permanent recognition.', 'Be inducted by the Paoblem team', 'special', 'mythic', 1000, '{"type":"special","threshold":1,"special":"hall_of_fame"}', 650),
('moderator', 'Moderator', 'You help keep Paoblem safe and constructive for everyone.', 'Become a platform moderator', 'special', 'epic', 150, '{"type":"special","threshold":1,"special":"moderator"}', 660),
('ambassador', 'Ambassador', 'You represent Paoblem and spread its mission to the world.', 'Become a Paoblem ambassador', 'special', 'legendary', 300, '{"type":"special","threshold":1,"special":"ambassador"}', 670),

-- HIDDEN ACHIEVEMENTS
('night-owl', 'Night Owl', 'You posted between midnight and 4am. The night belongs to creators.', 'A secret awaits the night...', 'hidden', 'uncommon', 25, '{"type":"special","threshold":1,"special":"night_owl"}', 710),
('early-bird', 'Early Bird', 'You posted between 5am and 7am. First light, first ideas.', 'Discover the early bird secret', 'hidden', 'uncommon', 25, '{"type":"special","threshold":1,"special":"early_bird"}', 720),
('lucky-creator', 'Lucky Creator', 'Something fortunate happened on a special day.', 'A stroke of luck awaits', 'hidden', 'rare', 50, '{"type":"special","threshold":1,"special":"lucky_creator"}', 730),
('silent-observer', 'Silent Observer', 'You''ve read 500 posts without ever commenting. A true observer.', 'The silent path holds secrets', 'hidden', 'common', 15, '{"type":"special","threshold":1,"special":"silent_observer"}', 740),
('trend-starter', 'Trend Starter', 'Your post sparked a wave that others followed.', 'Something viral this way comes', 'hidden', 'epic', 120, '{"type":"special","threshold":1,"special":"trend_starter"}', 750),
('master-explorer', 'Master Explorer', 'You''ve visited every corner of Paoblem at least once.', 'Explore the unknown territories', 'hidden', 'rare', 60, '{"type":"special","threshold":1,"special":"master_explorer"}', 760)

ON CONFLICT (slug) DO NOTHING;

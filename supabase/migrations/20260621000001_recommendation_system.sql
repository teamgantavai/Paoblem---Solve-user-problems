-- Personalized recommendation system for home, trending, and solutions feeds.

DO $$
BEGIN
  ALTER TYPE post_event_type ADD VALUE IF NOT EXISTS 'SOLUTION_VIEW';
  ALTER TYPE post_event_type ADD VALUE IF NOT EXISTS 'SOLUTION_UPVOTE';
  ALTER TYPE post_event_type ADD VALUE IF NOT EXISTS 'SOLUTION_SAVE';
  ALTER TYPE post_event_type ADD VALUE IF NOT EXISTS 'CHALLENGE_ACCEPT';
  ALTER TYPE post_event_type ADD VALUE IF NOT EXISTS 'DWELL';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_category_interests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

CREATE TABLE IF NOT EXISTS public.feed_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  rank_position INT,
  score NUMERIC,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.solution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_id UUID NOT NULL REFERENCES public.solutions(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('SOLUTION_VIEW', 'SOLUTION_UPVOTE', 'SOLUTION_SAVE')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feed_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_category_interests_user_score
  ON public.user_category_interests(user_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_feed_impressions_user_shown
  ON public.feed_impressions(user_id, shown_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_impressions_post_shown
  ON public.feed_impressions(post_id, shown_at DESC);

CREATE INDEX IF NOT EXISTS idx_solution_events_solution_created
  ON public.solution_events(solution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_solution_events_problem_created
  ON public.solution_events(problem_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_solution_events_user
  ON public.solution_events(user_id);

CREATE INDEX IF NOT EXISTS idx_posts_engagement_rank
  ON public.posts(upvotes DESC, comments_count DESC, views_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_solutions_engagement_rank
  ON public.solutions(upvotes DESC, comments_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_events_type_created
  ON public.post_events(event_type, created_at DESC);

ALTER TABLE public.user_category_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own category interests"
  ON public.user_category_interests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages category interests"
  ON public.user_category_interests FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own feed impressions"
  ON public.feed_impressions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages feed impressions"
  ON public.feed_impressions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read solution events"
  ON public.solution_events FOR SELECT
  USING (true);

CREATE POLICY "Service role inserts solution events"
  ON public.solution_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role manages feed cache"
  ON public.feed_cache FOR ALL
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.solution_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

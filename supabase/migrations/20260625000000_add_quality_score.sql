-- ============================================================
-- AI Quality Score System
-- Adds quality score columns and recalculation function to posts
-- ============================================================

-- 1. Add new event types to the post_event_type ENUM
-- (We use ALTER TYPE ... ADD VALUE which must run outside a transaction
--  in Postgres. Supabase migrations run each file in its own transaction,
--  so we guard with a DO block to skip already-existing values.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'LONG_READ'
      AND enumtypid = 'post_event_type'::regtype
  ) THEN
    ALTER TYPE post_event_type ADD VALUE 'LONG_READ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SEE_MORE'
      AND enumtypid = 'post_event_type'::regtype
  ) THEN
    ALTER TYPE post_event_type ADD VALUE 'SEE_MORE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'PROFILE_CLICK'
      AND enumtypid = 'post_event_type'::regtype
  ) THEN
    ALTER TYPE post_event_type ADD VALUE 'PROFILE_CLICK';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'LINK_CLICK'
      AND enumtypid = 'post_event_type'::regtype
  ) THEN
    ALTER TYPE post_event_type ADD VALUE 'LINK_CLICK';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'HIDE_POST'
      AND enumtypid = 'post_event_type'::regtype
  ) THEN
    ALTER TYPE post_event_type ADD VALUE 'HIDE_POST';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'REPORT_SPAM'
      AND enumtypid = 'post_event_type'::regtype
  ) THEN
    ALTER TYPE post_event_type ADD VALUE 'REPORT_SPAM';
  END IF;
END
$$;

-- 2. Add quality score columns to posts table
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS quality_score      FLOAT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS engagement_score   FLOAT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_score   FLOAT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS freshness_score    FLOAT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unique_viewers     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS long_reads         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS see_more_clicks    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_clicks     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_clicks        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reports            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hidden_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_quality_update TIMESTAMPTZ DEFAULT NULL;

-- 3. Index for efficient feed ranking queries on quality score
CREATE INDEX IF NOT EXISTS idx_posts_quality_score ON public.posts (quality_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_posts_unique_viewers ON public.posts (unique_viewers DESC);

-- 4. Core quality score recalculation function
-- Called after every qualifying engagement event.
-- Formula:
--   engagement = (upvotes*3) + (long_reads*3) + (see_more_clicks*2)
--                + (comments*5) + (saves*8) + (shares*10)
--                + (profile_clicks*2) + (link_clicks*2)
--                - (downvotes*5) - (hidden_count*10) - (reports*15)
--   raw_quality = engagement / max(1, unique_viewers)
--   confidence  = unique_viewers / (unique_viewers + 50)   -- Bayesian smoothing
--   age_hours   = (now - created_at) in hours
--   freshness   = 1 + 0.3 * exp(-age_hours / 72)          -- 3-day decay
--   raw_score   = raw_quality * confidence * freshness * 3.5   -- scale to ~10
--   quality_score = GREATEST(0, LEAST(10, raw_score))     -- clamp [0, 10]
CREATE OR REPLACE FUNCTION public.recalculate_quality_score(p_post_id UUID)
RETURNS TABLE (
  new_quality_score    FLOAT,
  new_engagement_score FLOAT,
  new_confidence_score FLOAT,
  new_freshness_score  FLOAT,
  new_unique_viewers   INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post             public.posts%ROWTYPE;
  v_engagement       FLOAT;
  v_raw_quality      FLOAT;
  v_confidence       FLOAT;
  v_age_hours        FLOAT;
  v_freshness        FLOAT;
  v_raw_score        FLOAT;
  v_final_score      FLOAT;
BEGIN
  -- Load current post data
  SELECT * INTO v_post FROM public.posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Engagement formula
  v_engagement :=
    (COALESCE(v_post.upvotes, 0)        * 3.0)
  + (COALESCE(v_post.long_reads, 0)     * 3.0)
  + (COALESCE(v_post.see_more_clicks,0) * 2.0)
  + (COALESCE(v_post.comments_count, 0) * 5.0)
  + (COALESCE(v_post.saves, 0)          * 8.0)
  + (COALESCE(v_post.shares, 0)         * 10.0)
  + (COALESCE(v_post.profile_clicks, 0) * 2.0)
  + (COALESCE(v_post.link_clicks, 0)    * 2.0)
  - (COALESCE(v_post.downvotes, 0)      * 5.0)
  - (COALESCE(v_post.hidden_count, 0)   * 10.0)
  - (COALESCE(v_post.reports, 0)        * 15.0);

  -- Normalize by unique viewers
  v_raw_quality := v_engagement / GREATEST(1.0, COALESCE(v_post.unique_viewers, 0)::FLOAT);

  -- Confidence factor (Bayesian smoothing — shrinks toward 0 for tiny samples)
  v_confidence := COALESCE(v_post.unique_viewers, 0)::FLOAT
                  / (COALESCE(v_post.unique_viewers, 0)::FLOAT + 50.0);

  -- Freshness factor (boost new posts, decay over 72 hours)
  v_age_hours := GREATEST(0.0, EXTRACT(EPOCH FROM (now() - v_post.created_at)) / 3600.0);
  v_freshness := 1.0 + 0.3 * EXP(-v_age_hours / 72.0);

  -- Raw score (scale factor 3.5 chosen so a healthy engaged post ≈ 6–8)
  v_raw_score := v_raw_quality * v_confidence * v_freshness * 3.5;

  -- Clamp to [0, 10]
  v_final_score := GREATEST(0.0, LEAST(10.0, v_raw_score));

  -- Write results back to posts table
  UPDATE public.posts
  SET
    quality_score       = v_final_score,
    engagement_score    = v_engagement,
    confidence_score    = v_confidence,
    freshness_score     = v_freshness,
    last_quality_update = now()
  WHERE id = p_post_id;

  -- Return new values to caller
  RETURN QUERY
    SELECT
      v_final_score,
      v_engagement,
      v_confidence,
      v_freshness,
      COALESCE(v_post.unique_viewers, 0)::INTEGER;
END;
$$;

-- 5. Grant execute to service role (API calls use service role key)
GRANT EXECUTE ON FUNCTION public.recalculate_quality_score(UUID) TO service_role;

-- 6. Helper function: increment a counter column and recalculate score atomically
CREATE OR REPLACE FUNCTION public.increment_quality_counter(
  p_post_id   UUID,
  p_column    TEXT,
  p_delta     INTEGER DEFAULT 1
)
RETURNS FLOAT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result FLOAT;
BEGIN
  -- Increment the specified counter (whitelist to prevent SQL injection)
  IF p_column NOT IN (
    'unique_viewers','long_reads','see_more_clicks','saves','shares',
    'profile_clicks','link_clicks','reports','hidden_count'
  ) THEN
    RAISE EXCEPTION 'Invalid counter column: %', p_column;
  END IF;

  EXECUTE format(
    'UPDATE public.posts SET %I = GREATEST(0, COALESCE(%I, 0) + $1) WHERE id = $2',
    p_column, p_column
  ) USING p_delta, p_post_id;

  -- Recalculate and return new score
  SELECT new_quality_score INTO v_result
  FROM public.recalculate_quality_score(p_post_id);

  RETURN COALESCE(v_result, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_quality_counter(UUID, TEXT, INTEGER) TO service_role;

-- 7. Backfill existing posts: calculate initial quality score based on current data
-- unique_viewers approximated from views_count since we don't have the exact distinct count
UPDATE public.posts
SET
  unique_viewers = GREATEST(0, COALESCE(views_count, 0))
WHERE unique_viewers = 0 AND views_count > 0;

-- Run initial quality calculation for all existing posts that have engagement
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.posts
    WHERE upvotes > 0 OR comments_count > 0 OR views_count > 5
    ORDER BY created_at DESC
    LIMIT 500  -- backfill most recent 500 posts only for efficiency
  LOOP
    PERFORM public.recalculate_quality_score(r.id);
  END LOOP;
END
$$;

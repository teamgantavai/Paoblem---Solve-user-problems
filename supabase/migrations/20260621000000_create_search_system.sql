-- ============================================================
-- Migration: Comprehensive Search System
-- Adds PostgreSQL Full-Text Search + pg_trgm fuzzy matching
-- Tables: search_queries (analytics), search_history (per-user)
-- Function: search_all() unified search RPC
-- ============================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- 2. Full-Text Search on POSTS
-- ============================================================

-- Add tsvector column
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Trigger function to auto-update search_vector
CREATE OR REPLACE FUNCTION public.posts_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_search_vector_trigger ON public.posts;
CREATE TRIGGER posts_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, body ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.posts_search_vector_update();

-- Backfill existing posts
UPDATE public.posts SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(body, '')), 'B')
WHERE search_vector IS NULL;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_posts_search_vector ON public.posts USING GIN (search_vector);

-- GIN trigram index for fuzzy/typo-tolerant matching on title
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm ON public.posts USING GIN (title gin_trgm_ops);

-- Popularity composite index for ranking
CREATE INDEX IF NOT EXISTS idx_posts_popularity ON public.posts ((upvotes + views_count) DESC);

-- ============================================================
-- 3. Full-Text Search on SOLUTIONS
-- ============================================================

ALTER TABLE public.solutions ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.solutions_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS solutions_search_vector_trigger ON public.solutions;
CREATE TRIGGER solutions_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, body ON public.solutions
FOR EACH ROW EXECUTE FUNCTION public.solutions_search_vector_update();

UPDATE public.solutions SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(body, '')), 'B')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_solutions_search_vector ON public.solutions USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_solutions_title_trgm ON public.solutions USING GIN (title gin_trgm_ops);

-- ============================================================
-- 4. Full-Text Search on PROFILES
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.profiles_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.username, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.role, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_search_vector_trigger ON public.profiles;
CREATE TRIGGER profiles_search_vector_trigger
BEFORE INSERT OR UPDATE OF full_name, username, bio, role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_search_vector_update();

UPDATE public.profiles SET search_vector =
  setweight(to_tsvector('english', coalesce(full_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(username, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(bio, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(role, '')), 'C')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_search_vector ON public.profiles USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm ON public.profiles USING GIN (full_name gin_trgm_ops);

-- ============================================================
-- 5. Search Analytics Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INT DEFAULT 0,
  clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_queries_query ON public.search_queries (query);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON public.search_queries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_queries_user_id ON public.search_queries (user_id);

ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (even anon for tracking)
CREATE POLICY "Allow insert search queries" ON public.search_queries
  FOR INSERT WITH CHECK (true);

-- Users can read their own search queries
CREATE POLICY "Users can read own search queries" ON public.search_queries
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================
-- 6. Search History Table (per-user, synced)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unique constraint to deduplicate (user + query)
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_history_user_query
  ON public.search_history (user_id, query);

CREATE INDEX IF NOT EXISTS idx_search_history_user_created
  ON public.search_history (user_id, created_at DESC);

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own search history" ON public.search_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search history" ON public.search_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own search history" ON public.search_history
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 7. Unified Search Function: search_all()
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_all(
  query_text TEXT,
  limit_per_type INT DEFAULT 5
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  ts_query tsquery;
  sanitized TEXT;
BEGIN
  -- Sanitize and build tsquery: split words, join with &, add :* for prefix matching
  sanitized := trim(regexp_replace(query_text, '[^\w\s]', ' ', 'g'));

  IF sanitized = '' OR sanitized IS NULL THEN
    RETURN jsonb_build_object(
      'problems', '[]'::jsonb,
      'ideas', '[]'::jsonb,
      'solutions', '[]'::jsonb,
      'users', '[]'::jsonb
    );
  END IF;

  -- Build prefix tsquery: "ai study" → "ai:* & study:*"
  ts_query := to_tsquery('english',
    array_to_string(
      array(
        SELECT word || ':*'
        FROM unnest(string_to_array(sanitized, ' ')) AS word
        WHERE word <> ''
      ),
      ' & '
    )
  );

  WITH
  -- Search problems (posts with type = 'problem')
  problem_results AS (
    SELECT
      p.id,
      p.title,
      ts_headline('english', p.body, ts_query,
        'MaxWords=35, MinWords=15, StartSel=<mark>, StopSel=</mark>'
      ) AS body_snippet,
      p.type,
      p.slug,
      p.upvotes,
      p.comments_count,
      p.views_count,
      p.created_at,
      (
        ts_rank(p.search_vector, ts_query) * 10.0
        + COALESCE(word_similarity(p.title, sanitized), 0) * 5.0
        + ln(1 + p.upvotes) * 2.0
        + ln(1 + p.views_count) * 0.5
        + ln(1 + p.comments_count) * 1.5
        - EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0 * 0.01
      ) AS rank,
      jsonb_build_object(
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'username', pr.username
      ) AS author
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.type = 'problem'
      AND (
        p.search_vector @@ ts_query
        OR word_similarity(p.title, sanitized) > 0.2
      )
    ORDER BY rank DESC
    LIMIT limit_per_type
  ),

  -- Search ideas (posts with type = 'idea')
  idea_results AS (
    SELECT
      p.id,
      p.title,
      ts_headline('english', p.body, ts_query,
        'MaxWords=35, MinWords=15, StartSel=<mark>, StopSel=</mark>'
      ) AS body_snippet,
      p.type,
      p.slug,
      p.upvotes,
      p.comments_count,
      p.views_count,
      p.created_at,
      (
        ts_rank(p.search_vector, ts_query) * 10.0
        + COALESCE(word_similarity(p.title, sanitized), 0) * 5.0
        + ln(1 + p.upvotes) * 2.0
        + ln(1 + p.views_count) * 0.5
        + ln(1 + p.comments_count) * 1.5
        - EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0 * 0.01
      ) AS rank,
      jsonb_build_object(
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'username', pr.username
      ) AS author
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.type = 'idea'
      AND (
        p.search_vector @@ ts_query
        OR word_similarity(p.title, sanitized) > 0.2
      )
    ORDER BY rank DESC
    LIMIT limit_per_type
  ),

  -- Search solutions
  solution_results AS (
    SELECT
      s.id,
      s.title,
      ts_headline('english', s.body, ts_query,
        'MaxWords=35, MinWords=15, StartSel=<mark>, StopSel=</mark>'
      ) AS body_snippet,
      s.problem_id,
      ps.title AS problem_title,
      s.upvotes,
      s.created_at,
      (
        ts_rank(s.search_vector, ts_query) * 10.0
        + COALESCE(word_similarity(s.title, sanitized), 0) * 5.0
        + ln(1 + s.upvotes) * 2.0
        + ln(1 + s.comments_count) * 1.5
        - EXTRACT(EPOCH FROM (now() - s.created_at)) / 86400.0 * 0.01
      ) AS rank,
      jsonb_build_object(
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'username', pr.username
      ) AS author
    FROM public.solutions s
    LEFT JOIN public.posts ps ON ps.id = s.problem_id
    LEFT JOIN public.profiles pr ON pr.id = s.user_id
    WHERE
      s.search_vector @@ ts_query
      OR word_similarity(s.title, sanitized) > 0.2
    ORDER BY rank DESC
    LIMIT limit_per_type
  ),

  -- Search users/profiles
  user_results AS (
    SELECT
      pr.id,
      pr.full_name,
      pr.username,
      pr.avatar_url,
      pr.role,
      CASE
        WHEN pr.bio IS NOT NULL AND pr.bio <> '' THEN
          ts_headline('english', pr.bio, ts_query,
            'MaxWords=25, MinWords=10, StartSel=<mark>, StopSel=</mark>'
          )
        ELSE NULL
      END AS bio_snippet,
      (
        ts_rank(pr.search_vector, ts_query) * 10.0
        + COALESCE(word_similarity(coalesce(pr.full_name, ''), sanitized), 0) * 8.0
        + COALESCE(word_similarity(coalesce(pr.username, ''), sanitized), 0) * 6.0
      ) AS rank
    FROM public.profiles pr
    WHERE
      pr.search_vector @@ ts_query
      OR word_similarity(coalesce(pr.full_name, ''), sanitized) > 0.25
      OR word_similarity(coalesce(pr.username, ''), sanitized) > 0.25
    ORDER BY rank DESC
    LIMIT limit_per_type
  )

  SELECT jsonb_build_object(
    'problems', COALESCE((SELECT jsonb_agg(row_to_json(r)) FROM problem_results r), '[]'::jsonb),
    'ideas', COALESCE((SELECT jsonb_agg(row_to_json(r)) FROM idea_results r), '[]'::jsonb),
    'solutions', COALESCE((SELECT jsonb_agg(row_to_json(r)) FROM solution_results r), '[]'::jsonb),
    'users', COALESCE((SELECT jsonb_agg(row_to_json(r)) FROM user_results r), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

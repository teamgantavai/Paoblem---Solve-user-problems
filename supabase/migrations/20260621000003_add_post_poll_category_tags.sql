-- Add poll_question, category, and tags columns to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS poll_question TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Index for category filtering
CREATE INDEX IF NOT EXISTS posts_category_idx ON public.posts (category);

-- Index for tags (GIN index for array contains queries)
CREATE INDEX IF NOT EXISTS posts_tags_idx ON public.posts USING GIN (tags);

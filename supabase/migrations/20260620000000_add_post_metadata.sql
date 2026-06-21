-- Add metadata and video_url columns to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Create an index on the metadata type field if it exists for faster filtering later
CREATE INDEX IF NOT EXISTS posts_metadata_type_idx ON public.posts ((metadata->>'type'));

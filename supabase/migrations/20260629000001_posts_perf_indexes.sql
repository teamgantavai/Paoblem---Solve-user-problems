-- Create indexes for high-performance sorting by scores and quality metrics
CREATE INDEX IF NOT EXISTS posts_upvotes_idx ON public.posts (upvotes DESC);
CREATE INDEX IF NOT EXISTS posts_downvotes_idx ON public.posts (downvotes DESC);
CREATE INDEX IF NOT EXISTS posts_quality_score_idx ON public.posts (quality_score DESC);

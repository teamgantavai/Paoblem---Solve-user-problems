-- Post Analytics Tables
-- Run this migration against your Supabase instance.

CREATE TYPE post_event_type AS ENUM (
  'POST_VIEW',
  'POST_OPEN',
  'POST_UPVOTE',
  'POST_DOWNVOTE',
  'POST_COMMENT',
  'POST_SHARE',
  'POST_SAVE',
  'FOLLOW_FROM_POST'
);

CREATE TABLE IF NOT EXISTS post_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type post_event_type NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_events_post_type ON post_events(post_id, event_type);
CREATE INDEX IF NOT EXISTS idx_post_events_post_created ON post_events(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_events_user ON post_events(user_id);

CREATE TABLE IF NOT EXISTS post_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INT NOT NULL DEFAULT 0,
  unique_views INT NOT NULL DEFAULT 0,
  opens INT NOT NULL DEFAULT 0,
  upvotes INT NOT NULL DEFAULT 0,
  downvotes INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  saves INT NOT NULL DEFAULT 0,
  follows_gained INT NOT NULL DEFAULT 0,
  UNIQUE (post_id, date)
);

CREATE INDEX IF NOT EXISTS idx_post_analytics_daily_post_date ON post_analytics_daily(post_id, date DESC);

ALTER TABLE post_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_analytics_daily ENABLE ROW LEVEL SECURITY;

-- Post owners can read events for their posts
CREATE POLICY "Post owners can read events"
  ON post_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_events.post_id
        AND posts.user_id = auth.uid()
    )
  );

-- Post owners can read daily analytics for their posts
CREATE POLICY "Post owners can read daily analytics"
  ON post_analytics_daily FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_analytics_daily.post_id
        AND posts.user_id = auth.uid()
    )
  );

-- Service role inserts (API routes use service role key)
CREATE POLICY "Service role can insert events"
  ON post_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can upsert daily analytics"
  ON post_analytics_daily FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for live event feed
ALTER PUBLICATION supabase_realtime ADD TABLE post_events;

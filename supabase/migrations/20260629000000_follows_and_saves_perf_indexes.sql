-- 1. Create public follows table if not exists (so it's fully defined in schema migrations)
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(follower_id, following_id)
);

-- Enable RLS on public.follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for follows if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'Allow public read on follows'
  ) THEN
    CREATE POLICY "Allow public read on follows" ON public.follows FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'Allow insert on follows for auth'
  ) THEN
    CREATE POLICY "Allow insert on follows for auth" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'Allow delete on follows for owner'
  ) THEN
    CREATE POLICY "Allow delete on follows for owner" ON public.follows FOR DELETE USING (auth.uid() = follower_id);
  END IF;
END
$$;

-- 2. Create high performance indexes on follows table for fast profile loads
CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_id_idx ON public.follows (following_id);

-- 3. Create high performance indexes on post_saves table
CREATE INDEX IF NOT EXISTS post_saves_user_id_idx ON public.post_saves (user_id);
CREATE INDEX IF NOT EXISTS post_saves_post_id_idx ON public.post_saves (post_id);

-- 4. Create high performance indexes on notifications table
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);

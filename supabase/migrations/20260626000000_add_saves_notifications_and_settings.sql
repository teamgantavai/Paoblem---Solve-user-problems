-- 1. Create post_saves table
CREATE TABLE IF NOT EXISTS public.post_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, post_id)
);

-- Enable RLS on post_saves
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;

-- RLS Policies for post_saves
CREATE POLICY "Allow public read on post_saves" ON public.post_saves FOR SELECT USING (true);
CREATE POLICY "Allow insert on post_saves for auth" ON public.post_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow delete on post_saves for owner" ON public.post_saves FOR DELETE USING (auth.uid() = user_id);

-- 2. Add trigger to update saves count and recalculate quality score
CREATE OR REPLACE FUNCTION public.handle_post_save_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET saves = COALESCE(saves, 0) + 1 WHERE id = NEW.post_id;
    PERFORM public.recalculate_quality_score(NEW.post_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET saves = GREATEST(0, COALESCE(saves, 0) - 1) WHERE id = OLD.post_id;
    PERFORM public.recalculate_quality_score(OLD.post_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS post_saves_count_trigger ON public.post_saves;
CREATE TRIGGER post_saves_count_trigger
AFTER INSERT OR DELETE ON public.post_saves
FOR EACH ROW EXECUTE FUNCTION public.handle_post_save_changes();

-- 3. Add notification preference columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pref_receive_saves boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_receive_analytics boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_receive_solutions boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_receive_replies boolean DEFAULT true;

-- 4. Add status column to solutions
ALTER TABLE public.solutions
  ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('building', 'launched')) DEFAULT 'launched';

-- 5. Add last_analytics_email_sent_at to posts and last_reply_email_sent_at to profiles
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS last_analytics_email_sent_at timestamp with time zone;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_reply_email_sent_at timestamp with time zone;

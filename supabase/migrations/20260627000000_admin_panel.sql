-- Migration: Secure Admin Panel DB Setup
-- Adds custom columns for moderation, verification, category management, and audit trailing

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  disabled boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Populate default categories if empty
INSERT INTO public.categories (name, sort_order) VALUES
  ('AI', 1),
  ('SaaS', 2),
  ('Education', 3),
  ('Healthcare', 4),
  ('Fintech', 5),
  ('Developer Tools', 6),
  ('Design', 7),
  ('Marketing', 8),
  ('Product', 9),
  ('Sales', 10),
  ('Operations', 11),
  ('Funding', 12)
ON CONFLICT (name) DO NOTHING;

-- 2. Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('post', 'comment')),
  content_id uuid NOT NULL,
  reason text NOT NULL,
  ai_status text DEFAULT 'pending' CHECK (ai_status IN ('pending', 'flagged', 'safe', 'error')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for moderation queue
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_reported_user_idx ON public.reports (reported_user_id);

-- 3. Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON public.admin_audit_logs (created_at DESC);

-- 4. Add admin columns to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_until timestamp with time zone DEFAULT NULL;

-- 5. Add columns to public.posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_trending boolean DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_status text CHECK (moderation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved';

-- 6. Add columns to public.comments
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- Enable RLS on reports, categories, admin_audit_logs
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow read on categories to everyone
CREATE POLICY "Allow public read on categories" ON public.categories FOR SELECT USING (true);

-- Admin security: allow everything to authenticated users with email official.diljha@gmail.com
CREATE POLICY "Allow admin read on reports" ON public.reports FOR SELECT TO authenticated USING (auth.jwt() ->> 'email' = 'official.diljha@gmail.com');
CREATE POLICY "Allow admin all on reports" ON public.reports FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'official.diljha@gmail.com') WITH CHECK (auth.jwt() ->> 'email' = 'official.diljha@gmail.com');

CREATE POLICY "Allow admin all on categories" ON public.categories FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'official.diljha@gmail.com') WITH CHECK (auth.jwt() ->> 'email' = 'official.diljha@gmail.com');

CREATE POLICY "Allow admin read on audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (auth.jwt() ->> 'email' = 'official.diljha@gmail.com');
CREATE POLICY "Allow admin insert on audit logs" ON public.admin_audit_logs FOR INSERT TO authenticated WITH CHECK (auth.jwt() ->> 'email' = 'official.diljha@gmail.com');

-- Grant permissions to authenticated / service role
GRANT ALL ON TABLE public.categories TO authenticated, service_role;
GRANT ALL ON TABLE public.reports TO authenticated, service_role;
GRANT ALL ON TABLE public.admin_audit_logs TO authenticated, service_role;

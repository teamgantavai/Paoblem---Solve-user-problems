-- Migration: Add link_name column to posts table
-- Run this in your Supabase SQL Editor

-- 1. Add link_name column (if it doesn't exist)
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS link_name text;

-- 2. Ensure RLS policies are correct and not duplicated
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow public read on posts" ON public.posts;
DROP POLICY IF EXISTS "Allow insert on posts for creator" ON public.posts;
DROP POLICY IF EXISTS "Allow update on posts for owner" ON public.posts;
DROP POLICY IF EXISTS "Allow delete on posts for owner" ON public.posts;

-- Re-create clean RLS policies
CREATE POLICY "Allow public read on posts"
  ON public.posts FOR SELECT
  USING (true);

CREATE POLICY "Allow insert on posts for creator"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow update on posts for owner"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Allow delete on posts for owner"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Ensure profiles RLS allows public read (needed for the JOIN in list route)
DROP POLICY IF EXISTS "Allow public read on profiles" ON public.profiles;
CREATE POLICY "Allow public read on profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- 4. Add INSERT policy for profiles (so the trigger can insert)
DROP POLICY IF EXISTS "Allow insert on profiles for trigger" ON public.profiles;
CREATE POLICY "Allow insert on profiles for trigger"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

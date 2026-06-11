-- Migration: Add explicit foreign key constraint from comments.user_id to profiles.id for PostgREST joins
-- Run this in your Supabase SQL Editor

ALTER TABLE public.comments
DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

ALTER TABLE public.comments
ADD CONSTRAINT comments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

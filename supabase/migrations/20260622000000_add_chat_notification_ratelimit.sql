-- Add rate-limiting column to prevent chat email spam.
-- Stores the timestamp of the last chat notification email sent to this user.
-- The API checks this before sending: if < 30 minutes ago, no email is sent.
-- This also prevents duplicate emails from concurrent requests, page refreshes,
-- reconnects, retries, and multiple browser tabs.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_chat_email_sent_at timestamp with time zone;

-- Index for fast lookup when checking cooldown (used per message sent)
CREATE INDEX IF NOT EXISTS idx_profiles_last_chat_email_sent_at
  ON public.profiles(id, last_chat_email_sent_at)
  WHERE last_chat_email_sent_at IS NOT NULL;

-- Allow users to read their own last_chat_email_sent_at (already covered by existing profile policies)
-- Allow service role to update it freely (service role bypasses RLS by default)

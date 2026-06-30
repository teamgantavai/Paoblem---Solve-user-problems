-- ============================================================
-- Group Join Requests System
-- Adds a table for public group join requests (moderated approval flow).
-- ============================================================

BEGIN;

-- ── group_join_requests ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  message     text,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_join_requests_group_idx  ON public.group_join_requests (group_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS group_join_requests_user_idx   ON public.group_join_requests (user_id, status);

-- Enable realtime for join requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_join_requests;

COMMIT;

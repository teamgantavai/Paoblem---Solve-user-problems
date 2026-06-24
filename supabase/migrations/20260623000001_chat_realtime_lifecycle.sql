BEGIN;

CREATE TABLE IF NOT EXISTS public.message_deletions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can manage own message deletions" ON public.message_deletions;
CREATE POLICY "users can manage own message deletions"
  ON public.message_deletions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_deletions.message_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS message_deletions_user_idx
  ON public.message_deletions (user_id, deleted_at DESC);

CREATE INDEX IF NOT EXISTS message_deletions_message_idx
  ON public.message_deletions (message_id);

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_check;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_not_empty_unless_deleted;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_not_empty_unless_deleted
  CHECK (deleted_at IS NOT NULL OR content <> '' OR jsonb_array_length(attachments) > 0);

DO $$
DECLARE
  realtime_table regclass;
BEGIN
  FOREACH realtime_table IN ARRAY ARRAY[
    'public.conversations'::regclass,
    'public.conversation_participants'::regclass,
    'public.messages'::regclass,
    'public.message_reads'::regclass,
    'public.user_presence'::regclass,
    'public.typing_status'::regclass,
    'public.message_deletions'::regclass
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', realtime_table);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

COMMIT;

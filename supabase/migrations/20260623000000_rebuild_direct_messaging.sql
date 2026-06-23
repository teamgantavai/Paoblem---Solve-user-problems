-- Complete direct messaging rebuild.
-- This migration intentionally removes the patched legacy chat schema and creates
-- a clean one-to-one architecture.

BEGIN;

DROP TABLE IF EXISTS public.message_edit_history CASCADE;
DROP TABLE IF EXISTS public.message_deletions CASCADE;
DROP TABLE IF EXISTS public.read_receipts CASCADE;
DROP TABLE IF EXISTS public.attachments CASCADE;
DROP TABLE IF EXISTS public.typing_status CASCADE;
DROP TABLE IF EXISTS public.message_reads CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.user_presence CASCADE;
DROP TABLE IF EXISTS public.user_blocks CASCADE;
DROP TABLE IF EXISTS public.user_reports CASCADE;

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type text NOT NULL DEFAULT 'direct' CHECK (conversation_type = 'direct'),
  direct_key text NOT NULL UNIQUE,
  user_low_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_high_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_id uuid,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CHECK (user_low_id <> user_high_id),
  CHECK (direct_key = LEAST(user_low_id::text, user_high_id::text) || ':' || GREATEST(user_low_id::text, user_high_id::text))
);

CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_read_at timestamptz,
  pinned_at timestamptz,
  archived_at timestamptz,
  muted_at timestamptz,
  blocked_at timestamptz,
  reported_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  client_mutation_id text,
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CHECK (content <> '' OR jsonb_array_length(attachments) > 0)
);

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_last_message_id_fkey
  FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE TABLE public.message_reads (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_online boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.typing_status (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'Conversation reported',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CHECK (reporter_id <> reported_user_id)
);

CREATE UNIQUE INDEX messages_client_mutation_unique
  ON public.messages (conversation_id, sender_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;
CREATE INDEX conversations_latest_idx ON public.conversations (last_message_at DESC NULLS LAST, updated_at DESC);
CREATE INDEX conversation_participants_user_idx ON public.conversation_participants (user_id, archived_at, pinned_at DESC);
CREATE INDEX conversation_participants_conversation_idx ON public.conversation_participants (conversation_id);
CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at DESC);
CREATE INDEX messages_sender_idx ON public.messages (sender_id, created_at DESC);
CREATE INDEX messages_search_idx ON public.messages USING gin (to_tsvector('simple', content));
CREATE INDEX message_reads_user_idx ON public.message_reads (user_id, read_at DESC);
CREATE INDEX typing_status_conversation_idx ON public.typing_status (conversation_id, updated_at DESC);
CREATE INDEX user_presence_online_idx ON public.user_presence (is_online, updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_messaging_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_touch_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_messaging_updated_at();

CREATE OR REPLACE FUNCTION public.update_conversation_latest_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_id = NEW.id,
      last_message_at = NEW.created_at,
      updated_at = timezone('utc', now())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER messages_update_conversation_latest
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_latest_message();

CREATE OR REPLACE FUNCTION public.enforce_direct_message_sender()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id = NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'sender is not a participant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_enforce_sender
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_direct_message_sender();

CREATE OR REPLACE FUNCTION public.enforce_two_direct_participants()
RETURNS trigger AS $$
DECLARE
  participant_count integer;
BEGIN
  SELECT count(*) INTO participant_count
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id;

  IF participant_count > 2 THEN
    RAISE EXCEPTION 'direct conversations may only have two participants';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_participants_limit_two
  AFTER INSERT OR UPDATE ON public.conversation_participants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_two_direct_participants();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can read conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated users can create direct conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    auth.uid() IN (user_low_id, user_high_id)
    AND conversation_type = 'direct'
  );

CREATE POLICY "participants can read participants"
  ON public.conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "users can insert own participant row"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own participant settings"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "participants can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "participants can send messages as themselves"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "senders can edit or soft-delete messages"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "participants can read message reads"
  ON public.message_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_reads.message_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "users can insert own read receipts"
  ON public.message_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own read receipts"
  ON public.message_reads FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "presence is visible to authenticated users"
  ON public.user_presence FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "users can upsert own presence"
  ON public.user_presence FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "participants can see typing"
  ON public.typing_status FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = typing_status.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "users can upsert own typing"
  ON public.typing_status FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = typing_status.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "users can manage own blocks"
  ON public.user_blocks FOR ALL
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "users can create own reports"
  ON public.user_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "users can read own reports"
  ON public.user_reports FOR SELECT
  USING (reporter_id = auth.uid());

COMMIT;

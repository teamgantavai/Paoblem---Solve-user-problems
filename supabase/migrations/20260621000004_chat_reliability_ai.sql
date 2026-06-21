-- Chat reliability, realtime, group metadata, reply/forward/delete support, and AI cache.

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS direct_key text,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.conversation_members
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
ADD COLUMN IF NOT EXISTS last_read_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS forwarded_from_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS forwarded_sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

WITH direct_members AS (
  SELECT
    c.id AS conversation_id,
    string_agg(cm.user_id::text, ':' ORDER BY cm.user_id::text) AS member_key,
    count(*) AS member_count
  FROM public.conversations c
  JOIN public.conversation_members cm ON cm.conversation_id = c.id
  WHERE c.type = 'direct'
  GROUP BY c.id
)
UPDATE public.conversations c
SET direct_key = dm.member_key
FROM direct_members dm
WHERE c.id = dm.conversation_id
AND dm.member_count = 2
AND c.direct_key IS NULL;

WITH ranked_directs AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY direct_key ORDER BY updated_at DESC, created_at DESC, id DESC) AS rn
  FROM public.conversations
  WHERE type = 'direct'
  AND direct_key IS NOT NULL
  AND deleted_at IS NULL
)
UPDATE public.conversations c
SET deleted_at = timezone('utc'::text, now())
FROM ranked_directs rd
WHERE c.id = rd.id
AND rd.rn > 1;

CREATE TABLE IF NOT EXISTS public.message_deletions (
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  deleted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  message_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_direct_key ON public.conversations(direct_key) WHERE direct_key IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_direct_conversations ON public.conversations(direct_key) WHERE direct_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_conversation ON public.conversation_members(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_user ON public.conversation_members(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_id ON public.messages(conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_user_message ON public.read_receipts(user_id, message_id);
CREATE INDEX IF NOT EXISTS idx_typing_status_conversation_updated ON public.typing_status(conversation_id, updated_at DESC);

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_ai_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read message_deletions" ON public.message_deletions;
CREATE POLICY "Members can read message_deletions" ON public.message_deletions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages
      JOIN public.conversation_members ON conversation_members.conversation_id = messages.conversation_id
      WHERE messages.id = message_deletions.message_id
      AND conversation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage own message_deletions" ON public.message_deletions;
CREATE POLICY "Users can manage own message_deletions" ON public.message_deletions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own chat summaries" ON public.chat_ai_summaries;
CREATE POLICY "Users can read own chat summaries" ON public.chat_ai_summaries
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own chat summaries" ON public.chat_ai_summaries;
CREATE POLICY "Users can manage own chat summaries" ON public.chat_ai_summaries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow members update conversations" ON public.conversations;
CREATE POLICY "Allow members update conversations" ON public.conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
      AND conversation_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Allow members insert read_receipts idempotently" ON public.read_receipts;
CREATE POLICY "Allow members insert read_receipts idempotently" ON public.read_receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.read_receipts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_status;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_deletions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

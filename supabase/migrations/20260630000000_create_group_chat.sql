-- ============================================================
-- Group Chat System Migration
-- Creates 7 new tables alongside the existing DM system.
-- Does NOT modify any existing tables.
-- ============================================================

BEGIN;

-- ── 1. groups ────────────────────────────────────────────────
CREATE TABLE public.groups (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description         text        CHECK (char_length(description) <= 500),
  avatar_url          text,
  banner_url          text,
  category            text,
  privacy             text        NOT NULL DEFAULT 'public'
                                  CHECK (privacy IN ('public', 'private')),
  invite_permission   text        NOT NULL DEFAULT 'admin'
                                  CHECK (invite_permission IN ('owner', 'admin', 'member')),
  message_permission  text        NOT NULL DEFAULT 'member'
                                  CHECK (message_permission IN ('owner', 'admin', 'moderator', 'member')),
  created_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at     timestamptz,
  member_count        integer     NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ── 2. group_members ─────────────────────────────────────────
CREATE TABLE public.group_members (
  group_id            uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role                text        NOT NULL DEFAULT 'member'
                                  CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  muted_until         timestamptz,
  last_read_at        timestamptz,
  joined_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (group_id, user_id)
);

-- ── 3. group_messages ────────────────────────────────────────
CREATE TABLE public.group_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content             text        NOT NULL DEFAULT '',
  message_type        text        NOT NULL DEFAULT 'text'
                                  CHECK (message_type IN ('text', 'image', 'file', 'system')),
  attachments         jsonb       NOT NULL DEFAULT '[]',
  reply_to_message_id uuid        REFERENCES public.group_messages(id) ON DELETE SET NULL,
  mentions            jsonb       NOT NULL DEFAULT '[]',
  pinned_at           timestamptz,
  pinned_by           uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at           timestamptz,
  deleted_at          timestamptz,
  deleted_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_mutation_id  text,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CHECK (content <> '' OR jsonb_array_length(attachments) > 0 OR message_type = 'system')
);

-- ── 4. group_message_reactions ───────────────────────────────
CREATE TABLE public.group_message_reactions (
  message_id          uuid        NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji               text        NOT NULL CHECK (char_length(emoji) <= 10),
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (message_id, user_id)
);

-- ── 5. group_invites ─────────────────────────────────────────
CREATE TABLE public.group_invites (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_by          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_user_id     uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code         text        UNIQUE,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ── 6. group_message_reads ───────────────────────────────────
CREATE TABLE public.group_message_reads (
  message_id          uuid        NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at             timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (message_id, user_id)
);

-- ── 7. group_typing_status ───────────────────────────────────
CREATE TABLE public.group_typing_status (
  group_id            uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_typing           boolean     NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (group_id, user_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX groups_created_by_idx      ON public.groups (created_by);
CREATE INDEX groups_last_message_idx    ON public.groups (last_message_at DESC NULLS LAST);

CREATE INDEX group_members_user_idx     ON public.group_members (user_id, joined_at DESC);
CREATE INDEX group_members_group_idx    ON public.group_members (group_id, role);

CREATE UNIQUE INDEX group_messages_client_mutation_unique
  ON public.group_messages (group_id, sender_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

CREATE INDEX group_messages_group_created_idx ON public.group_messages (group_id, created_at DESC);
CREATE INDEX group_messages_sender_idx        ON public.group_messages (sender_id, created_at DESC);
CREATE INDEX group_messages_pinned_idx        ON public.group_messages (group_id, pinned_at DESC NULLS LAST)
  WHERE pinned_at IS NOT NULL;
CREATE INDEX group_messages_search_idx        ON public.group_messages USING gin (to_tsvector('simple', content));

CREATE INDEX group_invites_user_idx       ON public.group_invites (invited_user_id, status);
CREATE INDEX group_invites_group_idx      ON public.group_invites (group_id, status);
CREATE INDEX group_message_reads_user_idx ON public.group_message_reads (user_id, read_at DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_groups_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER groups_touch_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_groups_updated_at();

CREATE TRIGGER group_messages_touch_updated_at
  BEFORE UPDATE ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_groups_updated_at();

-- Update group.last_message_at + member_count on new message
CREATE OR REPLACE FUNCTION public.update_group_last_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.groups
  SET last_message_at = NEW.created_at,
      updated_at      = timezone('utc', now())
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER group_messages_update_last_message
  AFTER INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_group_last_message();

-- Update member_count when members join/leave
CREATE OR REPLACE FUNCTION public.sync_group_member_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.groups
  SET member_count = (
    SELECT count(*) FROM public.group_members WHERE group_id = COALESCE(NEW.group_id, OLD.group_id)
  )
  WHERE id = COALESCE(NEW.group_id, OLD.group_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER group_members_sync_count
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_group_member_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.groups                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_reads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_typing_status   ENABLE ROW LEVEL SECURITY;

-- groups: public groups visible to all authenticated; private only to members
CREATE POLICY "public groups visible to authenticated"
  ON public.groups FOR SELECT
  USING (
    privacy = 'public'
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "admins and owners can update group"
  ON public.groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "owners can delete group"
  ON public.groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id = auth.uid()
        AND gm.role = 'owner'
    )
  );

-- group_members
CREATE POLICY "members can read group members"
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "users can insert their own membership"
  ON public.group_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins can insert any member"
  ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "admins can update member roles"
  ON public.group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin', 'moderator')
    )
  );

CREATE POLICY "users can delete own membership (leave)"
  ON public.group_members FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "admins can remove members"
  ON public.group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

-- group_messages
CREATE POLICY "members can read group messages"
  ON public.group_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "members can send messages"
  ON public.group_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "senders and admins can update messages"
  ON public.group_messages FOR UPDATE
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin', 'moderator')
    )
  );

-- group_message_reactions
CREATE POLICY "members can read reactions"
  ON public.group_message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_messages gm
      JOIN public.group_members mb ON mb.group_id = gm.group_id
      WHERE gm.id = group_message_reactions.message_id AND mb.user_id = auth.uid()
    )
  );

CREATE POLICY "members can manage own reactions"
  ON public.group_message_reactions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- group_invites
CREATE POLICY "invited users can read own invites"
  ON public.group_invites FOR SELECT
  USING (
    invited_user_id = auth.uid()
    OR invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_invites.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "admins can create invites"
  ON public.group_invites FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_invites.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "invited users can update own invite status"
  ON public.group_invites FOR UPDATE
  USING (invited_user_id = auth.uid() OR invited_by = auth.uid());

CREATE POLICY "admins can delete invites"
  ON public.group_invites FOR DELETE
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_invites.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

-- group_message_reads
CREATE POLICY "members can read receipts"
  ON public.group_message_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_messages gm
      JOIN public.group_members mb ON mb.group_id = gm.group_id
      WHERE gm.id = group_message_reads.message_id AND mb.user_id = auth.uid()
    )
  );

CREATE POLICY "users can insert own read receipts"
  ON public.group_message_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own read receipts"
  ON public.group_message_reads FOR UPDATE
  USING (user_id = auth.uid());

-- group_typing_status
CREATE POLICY "members can see typing"
  ON public.group_typing_status FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_typing_status.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "users can upsert own typing"
  ON public.group_typing_status FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- ENABLE REALTIME on new tables
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_typing_status;

COMMIT;

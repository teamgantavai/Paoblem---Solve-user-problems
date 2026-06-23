-- Production poll storage and atomic voting.
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  multiple_choice boolean NOT NULL DEFAULT false,
  allow_vote_changes boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.polls
ADD COLUMN IF NOT EXISTS allow_vote_changes boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_text text NOT NULL,
  vote_count integer NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (poll_id, position)
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_id uuid REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx ON public.poll_options(poll_id, position);
CREATE INDEX IF NOT EXISTS poll_votes_poll_user_idx ON public.poll_votes(poll_id, user_id);
CREATE INDEX IF NOT EXISTS poll_votes_option_id_idx ON public.poll_votes(option_id);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on polls" ON public.polls;
CREATE POLICY "Allow public read on polls" ON public.polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on poll_options" ON public.poll_options;
CREATE POLICY "Allow public read on poll_options" ON public.poll_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on poll_votes" ON public.poll_votes;
CREATE POLICY "Allow public read on poll_votes" ON public.poll_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow self insert poll_votes" ON public.poll_votes;
CREATE POLICY "Allow self insert poll_votes" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow self update poll_votes" ON public.poll_votes;
CREATE POLICY "Allow self update poll_votes" ON public.poll_votes FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow self delete poll_votes" ON public.poll_votes;
CREATE POLICY "Allow self delete poll_votes" ON public.poll_votes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.recount_poll_option_votes(p_poll_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.poll_options po
  SET vote_count = COALESCE(v.count, 0)
  FROM (
    SELECT option_id, COUNT(*)::integer AS count
    FROM public.poll_votes
    WHERE poll_id = p_poll_id
    GROUP BY option_id
  ) v
  WHERE po.poll_id = p_poll_id AND po.id = v.option_id;

  UPDATE public.poll_options po
  SET vote_count = 0
  WHERE po.poll_id = p_poll_id
    AND NOT EXISTS (
      SELECT 1 FROM public.poll_votes pv
      WHERE pv.poll_id = p_poll_id AND pv.option_id = po.id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_on_poll(p_poll_id uuid, p_option_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  poll_row public.polls%ROWTYPE;
  existing_vote public.poll_votes%ROWTYPE;
  action_text text;
  voted_option uuid;
BEGIN
  SELECT * INTO poll_row FROM public.polls WHERE id = p_poll_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Poll not found');
  END IF;

  IF poll_row.expires_at <= timezone('utc'::text, now()) THEN
    RETURN jsonb_build_object('error', 'Poll closed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.poll_options
    WHERE id = p_option_id AND poll_id = p_poll_id
  ) THEN
    RETURN jsonb_build_object('error', 'Invalid poll option');
  END IF;

  SELECT * INTO existing_vote
  FROM public.poll_votes
  WHERE poll_id = p_poll_id AND user_id = p_user_id
  FOR UPDATE;

  IF FOUND AND existing_vote.option_id = p_option_id THEN
    action_text := 'unchanged';
    voted_option := p_option_id;
  ELSIF FOUND THEN
    IF poll_row.allow_vote_changes IS NOT TRUE THEN
      RETURN jsonb_build_object('error', 'You have already voted in this poll');
    END IF;

    UPDATE public.poll_votes
    SET option_id = p_option_id, updated_at = timezone('utc'::text, now())
    WHERE id = existing_vote.id;
    action_text := 'updated';
    voted_option := p_option_id;
  ELSE
    INSERT INTO public.poll_votes (poll_id, option_id, user_id)
    VALUES (p_poll_id, p_option_id, p_user_id);
    action_text := 'created';
    voted_option := p_option_id;
  END IF;

  PERFORM public.recount_poll_option_votes(p_poll_id);
  RETURN jsonb_build_object('action', action_text, 'voted_option_id', voted_option);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_on_poll(uuid, uuid, uuid) TO anon, authenticated, service_role;

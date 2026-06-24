BEGIN;

DROP FUNCTION IF EXISTS public.vote_on_poll(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.recount_poll_option_votes(uuid);

DELETE FROM public.posts
WHERE poll_question IS NOT NULL
   OR metadata ? 'poll'
   OR metadata ? 'poll_question'
   OR metadata ? 'poll_expires_at'
   OR metadata ? 'poll_duration';

UPDATE public.posts
SET metadata = metadata - 'poll' - 'poll_question' - 'poll_expires_at' - 'poll_duration'
WHERE metadata ? 'poll'
   OR metadata ? 'poll_question'
   OR metadata ? 'poll_expires_at'
   OR metadata ? 'poll_duration';

DROP TABLE IF EXISTS public.poll_votes CASCADE;
DROP TABLE IF EXISTS public.poll_options CASCADE;
DROP TABLE IF EXISTS public.polls CASCADE;

ALTER TABLE public.posts
  DROP COLUMN IF EXISTS poll_question;

COMMIT;

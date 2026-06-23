-- Keep direct conversations stable with the canonical sorted user ID key: user1_user2.
UPDATE public.conversations c
SET direct_key = dm.direct_key
FROM (
  SELECT
    conversation_id,
    string_agg(user_id::text, '_' ORDER BY user_id::text) AS direct_key
  FROM public.conversation_members
  GROUP BY conversation_id
  HAVING COUNT(*) = 2
) dm
WHERE c.id = dm.conversation_id
  AND c.type = 'direct'
  AND (c.direct_key IS DISTINCT FROM dm.direct_key);

CREATE INDEX IF NOT EXISTS conversations_direct_key_idx
ON public.conversations(direct_key)
WHERE direct_key IS NOT NULL AND deleted_at IS NULL;

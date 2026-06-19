CREATE TABLE IF NOT EXISTS public.message_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  editor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  old_content text NOT NULL DEFAULT '',
  new_content text NOT NULL DEFAULT '',
  edited_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.message_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow members read message edit history" ON public.message_edit_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.messages
      JOIN public.conversation_members ON conversation_members.conversation_id = messages.conversation_id
      WHERE messages.id = message_edit_history.message_id
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow sender insert message edit history" ON public.message_edit_history
  FOR INSERT WITH CHECK (auth.uid() = editor_id);

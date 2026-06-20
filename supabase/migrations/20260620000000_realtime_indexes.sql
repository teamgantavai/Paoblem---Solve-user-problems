-- Create indexes for performance optimization on messaging system
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- Safe checks for legacy / fallback columns if they exist in the messages table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiver_id') THEN
    CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'seen_at') THEN
    CREATE INDEX IF NOT EXISTS idx_messages_seen_at ON public.messages(seen_at);
  END IF;
END $$;

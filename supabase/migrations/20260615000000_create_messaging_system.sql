-- Create messaging system schema tables
-- 1. Extend profiles table with online status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS online boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 2. Create Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct', 'group')) DEFAULT 'direct',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Conversation Members table
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

-- Drop legacy messages table if exists to recreate with correct new columns
DROP TABLE IF EXISTS public.messages CASCADE;

-- 4. Create Messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('TEXT', 'IMAGE', 'VIDEO', 'FILE', 'VOICE', 'LINK', 'SYSTEM')) DEFAULT 'TEXT',
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  edited_at timestamp with time zone
);

-- 5. Create Attachments table
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  file_type text NOT NULL,
  size integer NOT NULL
);

-- 6. Create Read Receipts table
CREATE TABLE IF NOT EXISTS public.read_receipts (
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  read_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

-- 7. Create Typing Status table
CREATE TABLE IF NOT EXISTS public.typing_status (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  typing boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, conversation_id)
);

-- Enable RLS on new tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
-- Conversations: Read if user is a member
CREATE POLICY "Allow members read access to conversations" ON public.conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members 
      WHERE conversation_members.conversation_id = conversations.id 
      AND conversation_members.user_id = auth.uid()
    )
  );

-- Conversation Members: Read if user is a member of the conversation
CREATE POLICY "Allow members read conversation_members" ON public.conversation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = conversation_members.conversation_id 
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow members insert conversation_members" ON public.conversation_members
  FOR INSERT WITH CHECK (true);

-- Messages: Read if user is a member of the conversation, insert if user is the sender
CREATE POLICY "Allow members read messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members 
      WHERE conversation_members.conversation_id = messages.conversation_id 
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow sender insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversation_members 
      WHERE conversation_members.conversation_id = messages.conversation_id 
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow sender update messages" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Allow sender delete messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- Attachments: Read if user is member of conversation
CREATE POLICY "Allow members read attachments" ON public.attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages 
      JOIN public.conversation_members ON conversation_members.conversation_id = messages.conversation_id
      WHERE messages.id = attachments.message_id AND conversation_members.user_id = auth.uid()
    )
  );

-- Read Receipts policies
CREATE POLICY "Allow read read_receipts" ON public.read_receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages 
      JOIN public.conversation_members ON conversation_members.conversation_id = messages.conversation_id
      WHERE messages.id = read_receipts.message_id AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert read_receipts" ON public.read_receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Typing Status policies
CREATE POLICY "Allow select typing_status" ON public.typing_status
  FOR SELECT USING (true);

CREATE POLICY "Allow upsert typing_status" ON public.typing_status
  FOR ALL USING (auth.uid() = user_id);

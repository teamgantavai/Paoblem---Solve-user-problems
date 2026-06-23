const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: memberConversations } = await supabase
    .from('conversation_members')
    .select('conversation_id');
  
  const conversationIds = memberConversations.map(mc => mc.conversation_id);
  console.log('Conversations:', conversationIds);

  if (conversationIds.length > 0) {
    const { data, error } = await supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        user:user_id(id, username, full_name, avatar_url, role, online, last_seen)
      `)
      .in('conversation_id', conversationIds);

    console.log('Query result:', JSON.stringify({ data, error }, null, 2));
  }
}

test();

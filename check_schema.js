const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  // Query to get columns of conversations table
  const { data: convData, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .limit(1);
    
  console.log('Conversations:', convData, convErr);

  const { data: memData, error: memErr } = await supabase
    .from('conversation_members')
    .select('*')
    .limit(1);

  console.log('Conversation Members:', memData, memErr);
}

main();

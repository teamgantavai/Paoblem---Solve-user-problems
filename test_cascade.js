const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  // 1. Create a conversation
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ type: 'group' })
    .select()
    .single();
    
  if (convErr) return console.error('Conv error', convErr);
  
  console.log('Created conv:', conv.id);

  // 2. Add member
  const dummyUserId = '848939a4-bbf7-4451-8a56-fb83161342ca'; // Akash's id
  await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: dummyUserId });

  // 3. Add message
  const { data: msg } = await supabase.from('messages').insert({
    conversation_id: conv.id,
    sender_id: dummyUserId,
    content: 'Hello world'
  }).select().single();
  
  console.log('Created message:', msg.id);

  // 4. Delete conversation
  const { error: delErr } = await supabase.from('conversations').delete().eq('id', conv.id);
  console.log('Delete conversation error:', delErr);

  // 5. Check if message still exists
  const { data: msgCheck } = await supabase.from('messages').select('*').eq('id', msg.id);
  console.log('Message exists after delete?', msgCheck.length > 0);
  
  // 6. Check if member still exists
  const { data: memCheck } = await supabase.from('conversation_members').select('*').eq('conversation_id', conv.id);
  console.log('Member exists after delete?', memCheck.length > 0);
}

main();

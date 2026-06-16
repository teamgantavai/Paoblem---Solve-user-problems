const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Using Key prefix:", supabaseKey.substring(0, 20));

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Check profiles table columns
  let { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  console.log("Profiles check:", { count: profiles?.length, error: pErr });

  // Check messages table columns
  let { data: messages, error: mErr } = await supabase.from('messages').select('*').limit(1);
  console.log("Messages check:", { count: messages?.length, error: mErr });

  // Check if conversations table exists
  let { data: convs, error: cErr } = await supabase.from('conversations').select('*').limit(1);
  console.log("Conversations check:", { count: convs?.length, error: cErr });
}

check();

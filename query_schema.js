const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k) acc[k] = v.join('=').replace(/"/g, '');
  return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: convs, error: e1 } = await supabase.from('conversations').select('*').limit(1);
  console.log('conversations columns:', convs && convs.length ? Object.keys(convs[0]) : (convs ? 'no records' : 'e1: ' + e1?.message));

  const { data: mems, error: e2 } = await supabase.from('conversation_members').select('*').limit(1);
  console.log('conversation_members columns:', mems && mems.length ? Object.keys(mems[0]) : (mems ? 'no records' : 'e2: ' + e2?.message));
}
run();

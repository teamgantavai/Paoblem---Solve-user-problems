const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k) acc[k] = v.join('=').trim().replace(/"/g, '');
  return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('posts').select('*').limit(1);
  if (error) {
    console.error('Error fetching posts:', error);
  } else {
    console.log('Posts columns:', data && data.length ? Object.keys(data[0]) : 'no records');
  }
}
run();

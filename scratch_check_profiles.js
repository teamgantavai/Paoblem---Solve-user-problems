const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
try {
  const content = fs.readFileSync('.env.local', 'utf8');
  env = content.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) acc[k.trim()] = v.join('=').trim().replace(/"/g, '');
    return acc;
  }, {});
} catch (e) {
  console.error('Error reading env file:', e);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('Profile columns:', data && data.length ? Object.keys(data[0]) : 'no records');
  }
}
run();

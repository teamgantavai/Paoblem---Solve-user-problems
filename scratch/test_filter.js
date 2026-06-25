const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k) acc[k.trim()] = v.join('=').trim().replace(/"/g, '');
  return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test(category) {
  console.log('Testing category:', category);
  let query = supabase
    .from('posts')
    .select('*, profiles:user_id(full_name, avatar_url, role, username), solutions_count:solutions(count)');

  // This is the query from route.ts
  query = query.or(`category.eq.${category},metadata->>category.eq.${category}`);

  const { data, error } = await query;
  if (error) {
    console.error('Error for category:', category, error);
  } else {
    console.log('Success, post count:', data.length);
  }
}

async function main() {
  await test('AI');
  await test('Developer Tools');
}
main();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('conversations')
    .update({ name: 'Test' })
    .eq('id', '2f0fad27-c643-4119-be27-66b7ff17c710');
    
  console.log('Update Result:', data, error);
}

main();

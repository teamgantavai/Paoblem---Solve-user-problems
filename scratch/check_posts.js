const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Reload PostgREST schema cache
  const { data: reloadData, error: reloadError } = await supabase.rpc('reload_schema');
  console.log('Reload Schema Rpc:', reloadData, reloadError);
  
  // Alternative: run raw SQL to reload schema cache if RPC is not defined
  const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', {
    sql_query: "NOTIFY pgrst, 'reload schema';"
  }).catch(() => ({ error: 'exec_sql rpc not available' }));
  console.log('Reload Schema via SQL:', sqlData, sqlError);

  // Check columns of posts table
  const { data: cols, error: colsErr } = await supabase
    .from('posts')
    .select('*')
    .limit(1);
    
  if (colsErr) {
    console.error('Error fetching posts:', colsErr);
  } else {
    console.log('Columns in posts:', Object.keys(cols[0] || {}));
  }
}

main();

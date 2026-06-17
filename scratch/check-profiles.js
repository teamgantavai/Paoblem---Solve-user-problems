const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function check() {
  const client = new Client({ connectionString: process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgres://postgres:').replace('.supabase.co', ':6543/postgres') });
  // wait, we don't have the db password.
}

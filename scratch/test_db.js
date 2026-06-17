const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);
  if (error) {
    console.error('Error fetching notifications:', error);
  } else {
    console.log('Fetched notification row:', data);
  }
}

run();

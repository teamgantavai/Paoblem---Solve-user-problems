const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Using Key prefix:", supabaseKey ? supabaseKey.substring(0, 20) : "none");
console.log("Env keys:", Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('TOKEN') && !k.includes('SECRET')));

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Try calling check_email_exists to make sure connection works
  try {
    let { data, error } = await supabase.rpc('check_email_exists', { email_to_check: 'test@example.com' });
    console.log("RPC check:", { data, error });
  } catch (err) {
    console.error("RPC check exception:", err);
  }
}

check();


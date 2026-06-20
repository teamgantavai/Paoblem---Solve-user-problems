const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data: messages, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);

    if (messageError) {
      console.error("Error fetching messages:", messageError);
    } else {
      console.log("Fetched messages columns:", messages && messages.length ? Object.keys(messages[0]) : messages);
    }
  } catch (err) {
    console.error("Exception during check:", err);
  }
}

check();

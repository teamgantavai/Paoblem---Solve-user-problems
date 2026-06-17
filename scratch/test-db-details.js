const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data: comments, error: commentError } = await supabase
      .from('comments')
      .select('id, parent_id')
      .limit(1);

    if (commentError) {
      console.error("Error fetching comments:", commentError);
    } else {
      console.log("Fetched comment row successfully:", comments);
    }
  } catch (err) {
    console.error("Exception during check:", err);
  }
}

check();

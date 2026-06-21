const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const email = `test_user_${Date.now()}@example.com`;
    const password = 'password123';
    const fullName = 'Test User';
    
    console.log(`Attempting to sign up user with email: ${email}`);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    
    if (error) {
      console.error('Sign up error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('Sign up success! User details:', data.user);
      if (data.user && data.user.id) {
        await supabase.auth.admin.deleteUser(data.user.id);
        console.log('Cleaned up test user.');
      }
    }
  } catch (err) {
    console.error("Exception during check:", err);
  }
}

check();


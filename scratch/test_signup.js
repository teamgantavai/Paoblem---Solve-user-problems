const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
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
    console.error('Sign up error:', error);
  } else {
    console.log('Sign up success! User details:', data.user);
    // Cleanup
    if (data.user && data.user.id) {
      await supabase.auth.admin.deleteUser(data.user.id);
      console.log('Cleaned up test user.');
    }
  }
}

main();

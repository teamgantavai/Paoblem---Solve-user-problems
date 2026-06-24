const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, title, user_id, category, tags, link_name, external_link, created_at, profiles:user_id(id, full_name, avatar_url, username)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (postsError) {
    console.error('Error fetching posts:', postsError);
    return;
  }

  console.log('--- RECENT POSTS ---');
  posts.forEach(p => {
    console.log({
      id: p.id,
      title: p.title,
      user_id: p.user_id,
      category: p.category,
      link_name: p.link_name,
      external_link: p.external_link,
      profile: p.profiles
    });
  });

  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);

  console.log('--- PROFILES ---');
  console.log(profiles, profError);
}

main();

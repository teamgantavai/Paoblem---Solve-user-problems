const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yltxagukcgdbnhjspclv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsdHhhZ3VrY2dkYm5oanNwY2x2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE1NDM5MCwiZXhwIjoyMDk1NzMwMzkwfQ.LFrwrThUVBSqw4wT0ARBd2-cdauG0PXVPCkHgoj9J00';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: posts, error: pe } = await supabase.from('posts').select('*').limit(3);
  console.log('Posts:', posts, pe);
  
  if (posts && posts.length > 0) {
    const postId = posts[0].id;
    console.log('Testing postId:', postId);
    const { data: votes, error: ve } = await supabase
      .from('votes')
      .select('user_id, vote_type, created_at, profiles(full_name, avatar_url, username)')
      .eq('post_id', postId);
    console.log('Votes for first post:', votes, ve);
    
    // Let's also check all votes in table
    const { data: allVotes, error: ave } = await supabase.from('votes').select('*, profiles(*)').limit(10);
    console.log('All votes in table:', allVotes, ave);
  }
}
run();

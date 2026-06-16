import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import { Post } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface UserPageProps {
  params: Promise<{ username: string }>;
}

async function getUserProfile(username: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Fetch profile details
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (pErr || !profile) return null;

  // Fetch user's posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles:user_id(full_name, avatar_url, role, username)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  // Fetch user's comments count
  const { count: commentCount } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id);

  // Fetch total upvotes received on user's posts
  const totalUpvotes = posts?.reduce((sum, p) => sum + (p.upvotes || 0), 0) ?? 0;

  return {
    profile,
    posts: (posts || []) as Post[],
    stats: {
      postCount: posts?.length || 0,
      commentCount: commentCount || 0,
      totalUpvotes,
    }
  };
}

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { username } = await params;
  const data = await getUserProfile(username);
  if (!data) {
    return {
      title: 'User Not Found | Paoblem',
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const name = data.profile.full_name || username;
  const bio = data.profile.bio || `View ${name}'s startup problems, ideas, and solutions on Paoblem.`;

  return {
    title: `${name} (${data.profile.role || 'Innovator'}) Profile | Paoblem`,
    description: bio.substring(0, 160),
    alternates: {
      canonical: `${siteUrl}/user/${username}`,
    },
  };
}

export default async function UserPage({ params }: UserPageProps) {
  const { username } = await params;
  const data = await getUserProfile(username);

  if (!data) {
    notFound();
  }

  const { profile, posts, stats } = data;
  const name = profile.full_name || username;
  const avatar = profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.id}`;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';

  // Breadcrumbs JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": siteUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": name,
        "item": `${siteUrl}/user/${username}`
      }
    ]
  };

  return (
    <div className="app-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        
        <main className="center-feed">
          {/* User Identity Header Card */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <img
                src={avatar}
                alt={name}
                style={{ width: '72px', height: '72px', borderRadius: '50%', border: '2px solid var(--border-color)', objectFit: 'cover' }}
              />
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {name}
                  <span style={{ fontSize: '0.7rem', fontWeight: 500, background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)' }}>
                    {profile.role || 'Innovator'}
                  </span>
                </h1>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  @{profile.username || username}
                </p>
                {profile.location && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    📍 {profile.location}
                  </p>
                )}
              </div>
            </div>

            {profile.bio && (
              <p style={{ fontSize: '0.88rem', lineHeight: '1.5', color: 'var(--text-main)', marginTop: '0.5rem' }}>
                {profile.bio}
              </p>
            )}

            <div style={{ display: 'flex', gap: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{stats.postCount}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Posts</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{stats.commentCount}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Comments</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{stats.totalUpvotes}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Upvotes</span>
              </div>
            </div>
          </div>

          {/* User Posts List */}
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem' }}>
            Discussions by {name}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {posts.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No discussions posted yet.
              </div>
            ) : (
              posts.map((post) => (
                <article key={post.id} className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <span className={`sticker-tag ${post.type}`} style={{ marginLeft: 0 }}>
                      {post.type === 'problem' ? 'Problem' : 'Idea'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    <Link href={`/post/${post.slug || post.id}`} style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
                      {post.title}
                    </Link>
                  </h3>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.75rem' }}>
                    {post.body}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>↑ {post.upvotes} upvotes</span>
                    <span>💬 {post.comments_count} comments</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </main>
        
        <SidebarRight />
      </div>
    </div>
  );
}

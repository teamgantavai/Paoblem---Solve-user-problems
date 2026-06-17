import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import { Post } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface TagPageProps {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}

async function getTaggedPosts(tag: string, pageNum: number = 1) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const pageSize = 10;
  const from = (pageNum - 1) * pageSize;
  const to = from + pageSize - 1;

  // Search in title or body for the keyword (case-insensitive)
  const { data, count, error } = await supabase
    .from('posts')
    .select('*, profiles:user_id(full_name, avatar_url, role, username)', { count: 'exact' })
    .or(`title.ilike.%${tag}%,body.ilike.%${tag}%`)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { posts: [], count: 0 };
  return { posts: (data || []) as Post[], count: count || 0 };
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const cleanTag = decodeURIComponent(tag);

  return {
    title: `#${cleanTag} Discussions | Paoblem`,
    description: `Read startup problems, ideas, and developer discussions tagged with #${cleanTag} on Paoblem.`,
    alternates: {
      canonical: `${siteUrl}/tag/${tag}`,
    },
  };
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { tag } = await params;
  const cleanTag = decodeURIComponent(tag);
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const { posts, count } = await getTaggedPosts(cleanTag, page);

  const pageSize = 10;
  const totalPages = Math.ceil(count / pageSize);
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';

  const hasNext = page < totalPages;
  const hasPrev = page > 1;

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
        "name": `#${cleanTag}`,
        "item": `${siteUrl}/tag/${tag}`
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
          <header style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Posts tagged with #{cleanTag}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {count} discussions found
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {posts.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No posts found with this tag.
              </div>
            ) : (
              posts.map((post) => {
                const authorName = post.profiles?.full_name || 'Member';
                const authorAvatar = post.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.user_id}`;
                const authorRole = post.profiles?.role || 'Innovator';
                const authorUsername = post.profiles?.username;

                return (
                  <article key={post.id} className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      <img
                        src={authorAvatar}
                        alt={authorName}
                        className="avatar"
                        style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        <Link href={authorUsername ? `/user/${authorUsername}` : `/profile?userId=${post.user_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          {authorName}
                        </Link>{' '}
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: '8px', marginLeft: '4px' }}>
                          {authorRole}
                        </span>
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      <Link href={`/post/${post.slug || post.id}`} style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
                        {post.title}
                      </Link>
                    </h2>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.75rem' }}>
                      {post.body}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span>↑ {post.upvotes} upvotes</span>
                      <span>💬 {post.comments_count} comments</span>
                      <span className={`sticker-tag ${post.type}`} style={{ padding: '1px 6px', fontSize: '0.65rem' }}>
                        {post.type === 'problem' ? 'Problem' : 'Idea'}
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Pagination SEO controls */}
          {totalPages > 1 && (
            <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }} aria-label="Pagination Navigation">
              {hasPrev ? (
                <Link href={`/tag/${tag}?page=${page - 1}`} rel="prev" style={{ fontSize: '0.82rem', padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', textDecoration: 'none' }}>
                  ← Previous
                </Link>
              ) : (
                <span style={{ opacity: 0.3, fontSize: '0.82rem', padding: '6px 12px' }}>← Previous</span>
              )}
              
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Page {page} of {totalPages}
              </span>

              {hasNext ? (
                <Link href={`/tag/${tag}?page=${page + 1}`} rel="next" style={{ fontSize: '0.82rem', padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', textDecoration: 'none' }}>
                  Next →
                </Link>
              ) : (
                <span style={{ opacity: 0.3, fontSize: '0.82rem', padding: '6px 12px' }}>Next →</span>
              )}
            </nav>
          )}

        </main>
        
        <SidebarRight />
      </div>
    </div>
  );
}

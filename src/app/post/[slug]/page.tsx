import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import InteractivePost from '@/components/InteractivePost';
import { Post, Comment } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Helper to get mock post details
function getMockPost(slug: string): Post | null {
  if (slug === 'why-designing-sucks') {
    return {
      id: 'dylan-post',
      user_id: 'user-figma',
      title: 'Why designing Sucks!!!',
      body: 'Design handoff is broken. Redlines are tedious. Prototyping shouldn\'t require rebuilding everything from scratch. We need closer collaboration between design and code, where design files directly map to component trees.',
      type: 'problem',
      image_url: JSON.stringify(['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80']),
      external_link: 'https://figma.com',
      link_name: 'Figma Design',
      upvotes: 142,
      downvotes: 3,
      comments_count: 2,
      views_count: 420,
      solutions_count: 2,
      solved: true,
      slug: 'why-designing-sucks',
      created_at: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
      profiles: {
        full_name: 'Dylan Field',
        avatar_url: 'https://i.pravatar.cc/150?u=dylan2',
        role: 'CEO of Figma',
        username: 'dylan_field'
      }
    };
  } else if (slug === 'recruiting-in-2026-is-totally-broken') {
    return {
      id: 'ryan-post',
      user_id: 'user-linkedin',
      title: 'Recruiting in 2026 is totally broken',
      body: 'LinkedIn is full of spam and automated outreach. Founders can\'t find genuine early-stage talent who want to build, and builders are drowned in AI-generated recruiter messages. We need a peer-reviewed network of problem solvers.',
      type: 'problem',
      image_url: JSON.stringify(['https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop&q=80']),
      external_link: 'https://linkedin.com',
      link_name: 'LinkedIn Recruiting',
      upvotes: 95,
      downvotes: 1,
      comments_count: 1,
      views_count: 310,
      solutions_count: 0,
      solved: false,
      slug: 'recruiting-in-2026-is-totally-broken',
      created_at: new Date(Date.now() - 1000 * 3600 * 48).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 3600 * 48).toISOString(),
      profiles: {
        full_name: 'Ryan Roslansky',
        avatar_url: 'https://i.pravatar.cc/150?u=ryan2',
        role: 'CEO of LinkedIn',
        username: 'ryan_roslansky'
      }
    };
  }
  return null;
}

// Fetch Post Details
async function getPost(slug: string): Promise<Post | null> {
  const mock = getMockPost(slug);
  if (mock) return mock;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  let query = supabase
    .from('posts')
    .select('*, profiles:user_id(full_name, avatar_url, role, username), solutions_count:solutions(count)');

  if (isUuid) {
    query = query.eq('id', slug);
  } else {
    query = query.eq('slug', slug);
  }

  let { data, error } = await query.maybeSingle();

  if (error && error.message.includes('solutions')) {
    let fallbackQuery = supabase
      .from('posts')
      .select('*, profiles:user_id(full_name, avatar_url, role, username)');

    if (isUuid) {
      fallbackQuery = fallbackQuery.eq('id', slug);
    } else {
      fallbackQuery = fallbackQuery.eq('slug', slug);
    }

    const fallback = await fallbackQuery.maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    return null;
  }
  const rawSolutionsCount = (data as { solutions_count?: { count?: number }[] }).solutions_count;
  const solutionsCount = Number(rawSolutionsCount?.[0]?.count || 0);
  return {
    ...data,
    solutions_count: solutionsCount,
    solved: data.type === 'problem' && solutionsCount > 0,
  } as Post;
}

// Fetch Comments
async function getComments(post: Post): Promise<Comment[]> {
  if (post.id === 'dylan-post') {
    return [
      {
        id: 'comment-1',
        post_id: 'dylan-post',
        user_id: 'user-ryan',
        body: 'Absolutely. Design handoff shouldn\'t be a transition between two different mental models.',
        created_at: new Date(Date.now() - 1000 * 3600 * 20).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 3600 * 20).toISOString(),
        profiles: {
          full_name: 'Ryan Roslansky',
          avatar_url: 'https://i.pravatar.cc/150?u=ryan2',
          role: 'CEO of LinkedIn',
          username: 'ryan_roslansky'
        }
      }
    ];
  } else if (post.id === 'ryan-post') {
    return [
      {
        id: 'comment-2',
        post_id: 'ryan-post',
        user_id: 'user-dylan',
        body: 'Fully agree, Ryan. I experience this firsthand with design hires.',
        created_at: new Date(Date.now() - 1000 * 3600 * 40).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 3600 * 40).toISOString(),
        profiles: {
          full_name: 'Dylan Field',
          avatar_url: 'https://i.pravatar.cc/150?u=dylan2',
          role: 'CEO of Figma',
          username: 'dylan_field'
        }
      }
    ];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles:user_id(full_name, avatar_url, role, username)')
    .eq('post_id', post.id)
    .order('created_at', { ascending: true });

  if (error) return [];
  return data as Comment[];
}

// Fetch Internal Link Data
async function getInternalLinks(currentPost: Post) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // 1. Related posts: same type, not the current one
  const { data: related } = await supabase
    .from('posts')
    .select('title, slug, type, created_at')
    .eq('type', currentPost.type)
    .neq('id', currentPost.id)
    .limit(3);

  // 2. Trending discussions: top upvoted posts
  const { data: trending } = await supabase
    .from('posts')
    .select('title, slug, type, upvotes')
    .order('upvotes', { ascending: false })
    .neq('id', currentPost.id)
    .limit(4);

  // 3. Extract keywords for similar topics
  const stopwords = new Set(['the', 'a', 'is', 'why', 'to', 'in', 'and', 'or', 'for', 'on', 'it', 'is', 'are', 'was', 'were', 'of', 'with', 'at', 'by', 'an', 'this', 'that', 'from']);
  const words = currentPost.title.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
  
  const similarTopics = Array.from(new Set(words)).slice(0, 5);

  return {
    related: related || [],
    trending: trending || [],
    similarTopics
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    return {
      title: 'Post Not Found | Paoblem',
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const description = post.body.substring(0, 160).replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  return {
    title: `${post.title} | Paoblem`,
    description,
    alternates: {
      canonical: `${siteUrl}/post/${slug}`,
    },
    openGraph: {
      title: post.title,
      description,
      url: `${siteUrl}/post/${slug}`,
      type: 'article',
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      authors: [post.profiles?.full_name || 'Anonymous'],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const comments = await getComments(post);
  const { related, trending, similarTopics } = await getInternalLinks(post);

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';

  // Structured Data Definitions
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${siteUrl}/post/${post.slug}#article`,
        "isPartOf": {
          "@type": "WebPage",
          "@id": `${siteUrl}/post/${post.slug}`
        },
        "headline": post.title,
        "description": post.body.substring(0, 160),
        "datePublished": post.created_at,
        "dateModified": post.updated_at,
        "author": {
          "@type": "Person",
          "name": post.profiles?.full_name || 'Anonymous',
          "jobTitle": post.profiles?.role || 'Innovator',
          "image": post.profiles?.avatar_url || undefined
        },
        "publisher": {
          "@type": "Organization",
          "name": "Paoblem",
          "logo": {
            "@type": "ImageObject",
            "url": `${siteUrl}/favicon.ico`
          }
        },
        "mainEntityOfPage": `${siteUrl}/post/${post.slug}`
      },
      {
        "@type": "DiscussionForumPosting",
        "@id": `${siteUrl}/post/${post.slug}#discussion`,
        "headline": post.title,
        "description": post.body,
        "datePublished": post.created_at,
        "author": {
          "@type": "Person",
          "name": post.profiles?.full_name || 'Anonymous',
          "image": post.profiles?.avatar_url || undefined
        },
        "commentCount": post.comments_count,
        "interactionStatistic": [
          {
            "@type": "InteractionCounter",
            "interactionType": "https://schema.org/LikeAction",
            "userInteractionCount": post.upvotes - post.downvotes
          },
          {
            "@type": "InteractionCounter",
            "interactionType": "https://schema.org/CommentAction",
            "userInteractionCount": post.comments_count
          }
        ]
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/post/${post.slug}#breadcrumb`,
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
            "name": post.type === 'problem' ? 'Problems' : 'Ideas',
            "item": `${siteUrl}/category/${post.type === 'problem' ? 'problems' : 'ideas'}`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": post.title,
            "item": `${siteUrl}/post/${post.slug}`
          }
        ]
      }
    ]
  };

  return (
    <div className="app-container">
      {/* Dynamic SEO JSON-LD scripts */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar />
      
      <div className="main-content">
        <SidebarLeft />

        <main className="center-feed">
          {/* Breadcrumb Trail */}
          <nav className="breadcrumbs" aria-label="breadcrumb" style={{ marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <ol style={{ display: 'flex', gap: '0.4rem', listStyle: 'none', padding: 0, margin: 0, alignItems: 'center' }}>
              <li>
                <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Home</Link>
              </li>
              <li style={{ color: 'var(--text-muted)', opacity: 0.5 }}>/</li>
              <li>
                <Link href={`/category/${post.type === 'problem' ? 'problems' : 'ideas'}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', textTransform: 'capitalize' }}>
                  {post.type === 'problem' ? 'Problems' : 'Ideas'}
                </Link>
              </li>
              <li style={{ color: 'var(--text-muted)', opacity: 0.5 }}>/</li>
              <li aria-current="page" style={{ color: 'var(--text-main)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                {post.title}
              </li>
            </ol>
          </nav>

          {/* Core Interactive post content */}
          <Suspense fallback={<div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading startup discussion...</div>}>
            <InteractivePost initialPost={post} initialComments={comments} />
          </Suspense>

          {/* Internal Linking Area */}
          <section className="internal-linking-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem', padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '18px', background: 'var(--bg-card)' }}>
            
            {/* Similar Topics */}
            {similarTopics.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.6rem' }}>Similar Topics</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {similarTopics.map(tag => (
                    <Link
                      key={tag}
                      href={`/tag/${tag}`}
                      style={{
                        fontSize: '0.75rem',
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-muted)',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'background 0.2s'
                      }}
                      className="tag-link"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Related Posts */}
            {related.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.6rem' }}>Related startup {post.type}s</h3>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: 0, margin: 0, listStyle: 'none' }}>
                  {related.map(rel => (
                    <li key={rel.slug} style={{ fontSize: '0.82rem' }}>
                      <Link href={`/post/${rel.slug}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                        {rel.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trending Posts */}
            {trending.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.6rem' }}>Trending Discussions</h3>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: 0, margin: 0, listStyle: 'none' }}>
                  {trending.map(trend => (
                    <li key={trend.slug} style={{ fontSize: '0.82rem' }}>
                      <Link href={`/post/${trend.slug}`} style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
                        {trend.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </section>
        </main>

        <SidebarRight />
      </div>
    </div>
  );
}

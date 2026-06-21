import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import UserProfileClient from '@/components/UserProfileClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface UserPageProps {
  params: Promise<{ username: string }>;
}

async function getUserProfile(username: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Fetch profile
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (pErr || !profile) return null;

  // Fetch all posts (problems + ideas)
  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, body, slug, type, upvotes, comments_count, created_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  // Fetch solutions
  const { data: solutions } = await supabase
    .from('solutions')
    .select('id, title, body, upvotes, comments_count, created_at, external_link, link_name, problem:problem_id(id, title, slug)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  // Fetch comments (with post info)
  const { data: comments } = await supabase
    .from('comments')
    .select('id, body, created_at, post_id, post:post_id(id, title, slug)')
    .eq('user_id', profile.id)
    .is('parent_id', null)   // top-level comments only
    .order('created_at', { ascending: false })
    .limit(50);

  const totalUpvotes = (posts || []).reduce((sum, p) => sum + (p.upvotes || 0), 0)
    + (solutions || []).reduce((sum, s) => sum + (s.upvotes || 0), 0);

  return {
    profile,
    posts: (posts || []) as any[],
    solutions: (solutions || []) as any[],
    comments: (comments || []) as any[],
    stats: {
      postCount: posts?.length || 0,
      solutionCount: solutions?.length || 0,
      commentCount: comments?.length || 0,
      totalUpvotes,
    },
  };
}

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { username } = await params;
  const data = await getUserProfile(username);
  if (!data) return { title: 'User Not Found | Paoblem' };

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const name = data.profile.full_name || username;
  const bio = data.profile.bio || `View ${name}'s problems, ideas, and solutions on Paoblem.`;

  return {
    title: `${name} (@${username}) | Paoblem`,
    description: bio.substring(0, 160),
    alternates: { canonical: `${siteUrl}/user/${username}` },
    openGraph: {
      title: `${name} | Paoblem`,
      description: bio.substring(0, 160),
      type: 'profile',
      url: `${siteUrl}/user/${username}`,
      images: data.profile.avatar_url ? [{ url: data.profile.avatar_url }] : [],
    },
  };
}

export default async function UserPage({ params }: UserPageProps) {
  const { username } = await params;
  const data = await getUserProfile(username);

  if (!data) notFound();

  const { profile, posts, solutions, comments, stats } = data;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const name = profile.full_name || username;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: name, item: `${siteUrl}/user/${username}` },
    ],
  };

  return (
    <div className="upf-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <div className="upf-page-body">
        <UserProfileClient
          profile={profile}
          posts={posts}
          solutions={solutions}
          comments={comments}
          stats={stats}
        />
      </div>
    </div>
  );
}

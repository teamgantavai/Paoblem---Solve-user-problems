import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SolutionDetailClient from '@/components/SolutionDetailClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getSolutionData(id: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: solution, error } = await admin
    .from('solutions')
    .select('*, problem:problem_id(id, title, slug, body, type, category, upvotes, downvotes, comments_count, created_at, profiles:user_id(full_name, avatar_url, role, username))')
    .eq('id', id)
    .maybeSingle();

  if (error || !solution) {
    return null;
  }

  // Attach profile to solution
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, username')
    .eq('id', solution.user_id)
    .maybeSingle();
    
  const solutionWithProfile = {
    ...solution,
    profiles: profile || null
  };

  // Fetch related solutions
  const { data: related } = await admin
    .from('solutions')
    .select('id, title, upvotes, comments_count, created_at, user_id')
    .eq('problem_id', solution.problem_id)
    .neq('id', id)
    .order('upvotes', { ascending: false })
    .limit(3);

  let relatedWithProfiles: any[] = [];
  if (related && related.length > 0) {
    const userIds = related.map(r => r.user_id);
    const { data: rProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, username')
      .in('id', userIds);
    const pMap = new Map((rProfiles || []).map(p => [p.id, p]));
    relatedWithProfiles = related.map(r => ({
      ...r,
      profiles: pMap.get(r.user_id) || null
    }));
  }

  return {
    solution: solutionWithProfile,
    related: relatedWithProfiles
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getSolutionData(id);
  if (!data || !data.solution) {
    return {
      title: 'Solution Not Found | Paoblem',
    };
  }

  const solution = data.solution;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const description = solution.body.substring(0, 160);

  return {
    title: `${solution.title} - Startup Solution | Paoblem`,
    description,
    alternates: {
      canonical: `${siteUrl}/solutions/${id}`,
    },
    openGraph: {
      title: `${solution.title} - Startup Solution`,
      description,
      url: `${siteUrl}/solutions/${id}`,
      type: 'article',
      publishedTime: solution.created_at,
      modifiedTime: solution.updated_at,
      authors: [solution.profiles?.full_name || 'Anonymous'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${solution.title} - Startup Solution`,
      description,
    },
  };
}

export default async function SolutionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getSolutionData(id);

  if (!data || !data.solution) {
    notFound();
  }

  const { solution, related } = data;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';

  // HowTo / TechArticle and DiscussionForumPosting Schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${siteUrl}/solutions/${id}#article`,
        "isPartOf": {
          "@type": "WebPage",
          "@id": `${siteUrl}/solutions/${id}`
        },
        "headline": solution.title,
        "description": solution.body.substring(0, 160),
        "datePublished": solution.created_at,
        "dateModified": solution.updated_at,
        "author": {
          "@type": "Person",
          "name": solution.profiles?.full_name || 'Anonymous',
          "jobTitle": solution.profiles?.role || 'Innovator',
          "image": solution.profiles?.avatar_url || undefined
        },
        "publisher": {
          "@type": "Organization",
          "name": "Paoblem",
          "logo": {
            "@type": "ImageObject",
            "url": `${siteUrl}/favicon.ico`
          }
        }
      },
      {
        "@type": "DiscussionForumPosting",
        "@id": `${siteUrl}/solutions/${id}#discussion`,
        "headline": solution.title,
        "description": solution.body,
        "datePublished": solution.created_at,
        "author": {
          "@type": "Person",
          "name": solution.profiles?.full_name || 'Anonymous',
          "image": solution.profiles?.avatar_url || undefined
        },
        "commentCount": solution.comments_count
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SolutionDetailClient initialSolution={solution} initialRelated={related} />
    </>
  );
}

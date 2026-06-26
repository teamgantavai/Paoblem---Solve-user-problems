import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProblemSolutionsClient from '@/components/ProblemSolutionsClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProblemData(id: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch the problem details
  const { data: problem, error: problemError } = await supabase
    .from('posts')
    .select('id, title, slug, body, type, upvotes, downvotes, comments_count, category, created_at, profiles:user_id(full_name, avatar_url, role, username)')
    .eq('id', id)
    .maybeSingle();

  if (problemError || !problem) {
    return null;
  }

  // 2. Fetch the solutions (hot sort default)
  const { data: rawSolutions } = await admin
    .from('solutions')
    .select('*')
    .eq('problem_id', id)
    .order('upvotes', { ascending: false })
    .order('comments_count', { ascending: false });

  // 3. Attach profiles to solutions
  let solutionsWithProfiles: any[] = [];
  if (rawSolutions && rawSolutions.length > 0) {
    const userIds = Array.from(new Set(rawSolutions.map(s => s.user_id).filter(Boolean)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, username')
      .in('id', userIds);
    const pMap = new Map((profiles || []).map(p => [p.id, p]));
    solutionsWithProfiles = rawSolutions.map(s => ({
      ...s,
      profiles: pMap.get(s.user_id) || null
    }));
  }

  const rawProfile = (problem as any).profiles;
  const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
  const formattedProblem = {
    ...problem,
    profiles: profile || null
  };

  return {
    problem: formattedProblem,
    solutions: solutionsWithProfiles,
    total: solutionsWithProfiles.length
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getProblemData(id);
  if (!data || !data.problem) {
    return {
      title: 'Problem Solutions | Paoblem',
    };
  }

  const problem = data.problem;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const description = `Read collaborative engineering and business solutions for this problem: "${problem.body.substring(0, 120)}". Participate in solving founder pain points.`;

  return {
    title: `Solutions for: ${problem.title} | Paoblem`,
    description,
    alternates: {
      canonical: `${siteUrl}/problems/${id}/solutions`,
    },
    openGraph: {
      title: `Solutions for: ${problem.title}`,
      description,
      url: `${siteUrl}/problems/${id}/solutions`,
      type: 'website',
    },
  };
}

export default async function ProblemSolutionsPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getProblemData(id);

  if (!data) {
    notFound();
  }

  const { problem, solutions, total } = data;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';

  // QA Page JSON-LD schema
  const mainEntityAnswers = solutions.map(s => ({
    "@type": "Answer",
    "text": s.body,
    "dateCreated": s.created_at,
    "upvoteCount": s.upvotes,
    "author": {
      "@type": "Person",
      "name": s.profiles?.full_name || 'Anonymous'
    }
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    "mainEntity": {
      "@type": "Question",
      "name": problem.title,
      "text": problem.body,
      "answerCount": total,
      "upvoteCount": problem.upvotes,
      "dateCreated": problem.created_at,
      "author": {
        "@type": "Person",
        "name": problem.profiles?.full_name || 'Anonymous'
      },
      "suggestedAnswer": mainEntityAnswers.slice(0, 10)
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProblemSolutionsClient
        initialProblem={problem}
        initialSolutions={solutions}
        initialTotal={total}
      />
    </>
  );
}

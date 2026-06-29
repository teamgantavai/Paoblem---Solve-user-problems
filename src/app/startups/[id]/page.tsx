import { Metadata } from 'next';
import StartupDetailClient from '@/components/StartupDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Basic metadata — could fetch startup name server-side for richer SEO
  return {
    title: 'Startup | Paoblem',
    description: 'View this startup, explore open roles, and apply to join the team.',
    alternates: {
      canonical: `https://paoblem.com/startups/${id}`,
    },
    openGraph: {
      title: 'Startup | Paoblem',
      description: 'View this startup, explore open roles, and apply to join the team.',
      url: `https://paoblem.com/startups/${id}`,
      type: 'website',
    },
  };
}

export default async function StartupPage({ params }: Props) {
  const { id } = await params;
  return <StartupDetailClient startupId={id} />;
}

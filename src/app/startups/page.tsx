import { Metadata } from 'next';
import StartupsPageClient from '@/components/StartupsPageClient';

export const metadata: Metadata = {
  title: 'Startups — Find Opportunities & Build Teams | Paoblem',
  description: 'Discover founder-built startups seeking co-founders, engineers, designers, and marketers. Apply to join a startup or showcase yours on Paoblem.',
  alternates: {
    canonical: 'https://paoblem.com/startups',
  },
  openGraph: {
    title: 'Startups — Find Opportunities & Build Teams | Paoblem',
    description: 'Discover founder-built startups seeking co-founders, engineers, designers, and marketers. Apply to join a startup or showcase yours on Paoblem.',
    url: 'https://paoblem.com/startups',
    type: 'website',
  },
};

export default function StartupsPage() {
  return <StartupsPageClient />;
}

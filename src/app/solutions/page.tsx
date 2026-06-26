import { Metadata } from 'next';
import SolutionsPageClient from '@/components/SolutionsPageClient';

export const metadata: Metadata = {
  title: "Startup Solutions & Engineering Fixes | Paoblem",
  description: "Explore developer and founder-built solutions to real-world business and code problems. Join the Paoblem (Problem) community to get issues resolved.",
  alternates: {
    canonical: 'https://paoblem.com/solutions',
  },
  openGraph: {
    title: 'Startup Solutions & Engineering Fixes | Paoblem',
    description: 'Explore developer and founder-built solutions to real-world business and code problems. Join the Paoblem (Problem) community to get issues resolved.',
    url: 'https://paoblem.com/solutions',
    type: 'website',
  },
};

export default function SolutionsPage() {
  return <SolutionsPageClient />;
}
import { Metadata } from 'next';
import { Suspense } from 'react';
import CreateStartupClient from '@/components/CreateStartupClient';

export const metadata: Metadata = {
  title: 'Create a Startup | Paoblem',
  description: 'Launch your startup on Paoblem. Describe your vision, set what roles you need, and let AI match you with the right people.',
  alternates: {
    canonical: 'https://paoblem.com/startups/create',
  },
};

export default function CreateStartupPage() {
  return (
    <Suspense fallback={null}>
      <CreateStartupClient />
    </Suspense>
  );
}


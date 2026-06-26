import { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import Feed from '@/components/Feed';
import SidebarRight from '@/components/SidebarRight';

export const metadata: Metadata = {
  title: "Paoblem - Startup Problems, Ideas & Solutions Network",
  description: "Share real startup problems, validate startup ideas, collaborate on solutions, and discover next-generation business opportunities on Paoblem (Problem) - the social platform for founders.",
  creator: "Dilkhush Jha",
  authors: [{ name: "Dilkhush Jha", url: "https://paoblem.com" }],
  alternates: {
    canonical: 'https://paoblem.com',
  },
  openGraph: {
    title: 'Paoblem - Startup Problems, Ideas & Solutions Network',
    description: 'Share real startup problems, validate startup ideas, collaborate on solutions, and discover next-generation business opportunities.',
    url: 'https://paoblem.com',
    siteName: 'Paoblem',
    type: 'website',
  },
};

export default function Home() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    "name": "Paoblem",
    "url": siteUrl,
    "logo": `${siteUrl}/favicon.ico`,
    "description": "A social network for startup founders to share problems, validate ideas, and collaborate on solutions.",
    "founder": {
      "@type": "Person",
      "name": "Dilkhush Jha",
      "jobTitle": "Founder"
    }
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    "name": "Paoblem",
    "url": siteUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="app-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        <Feed />
        <SidebarRight />
      </div>
    </div>
  );
}

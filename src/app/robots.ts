import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/post/*',
        '/user/*',
        '/tag/*',
        '/category/*'
      ],
      disallow: [
        '/api/*',
        '/chats/*',
        '/notifications/*',
        '/create-post/*'
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

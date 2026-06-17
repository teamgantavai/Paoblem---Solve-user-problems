import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Fetch the latest 20 posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles:user_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(20);

  let itemsXml = '';

  const escapeXml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Static mock posts for backfill consistency
  const mockPosts = [
    {
      title: 'Why designing Sucks!!!',
      slug: 'why-designing-sucks',
      body: 'Design handoff is broken. Redlines are tedious. Prototyping shouldn\'t require rebuilding everything from scratch.',
      created_at: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
      profiles: { full_name: 'Dylan Field' }
    },
    {
      title: 'Recruiting in 2026 is totally broken',
      slug: 'recruiting-in-2026-is-totally-broken',
      body: 'LinkedIn is full of spam and outreach. Founders can\'t find genuine early-stage talent.',
      created_at: new Date(Date.now() - 1000 * 3600 * 48).toISOString(),
      profiles: { full_name: 'Ryan Roslansky' }
    }
  ];

  const allPosts = [...(posts || [])];
  mockPosts.forEach(mp => {
    if (!allPosts.some(p => p.slug === mp.slug)) {
      allPosts.push(mp as any);
    }
  });

  allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  allPosts.forEach((post) => {
    if (post.slug) {
      const itemLink = `${siteUrl}/post/${post.slug}`;
      itemsXml += `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${itemLink}</link>
      <guid isPermaLink="true">${itemLink}</guid>
      <description>${escapeXml(post.body.substring(0, 300))}</description>
      <pubDate>${new Date(post.created_at).toUTCString()}</pubDate>
      <author>${escapeXml(post.profiles?.full_name || 'Anonymous')}</author>
    </item>\n`;
    }
  });

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Paoblem - Startup Problems and Solutions</title>
    <link>${siteUrl}</link>
    <description>Discover startup ideas, founders problems, and software/business solutions from a community of creators.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Fetch posts ordered by created_at desc
  const { data: posts } = await supabase
    .from('posts')
    .select('slug, updated_at')
    .order('created_at', { ascending: false });

  let urlsXml = '';
  
  // Static URLs
  urlsXml += `  <url>
    <loc>${siteUrl}</loc>
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/category/problems</loc>
    <changefreq>always</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${siteUrl}/category/ideas</loc>
    <changefreq>always</changefreq>
    <priority>0.9</priority>
  </url>\n`;

  // Dynamic post URLs
  if (posts) {
    posts.forEach((post) => {
      if (post.slug) {
        urlsXml += `  <url>
    <loc>${siteUrl}/post/${post.slug}</loc>
    <lastmod>${new Date(post.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
      }
    });
  }

  // Add mock posts sitemaps
  urlsXml += `  <url>
    <loc>${siteUrl}/post/why-designing-sucks</loc>
    <lastmod>${new Date(Date.now() - 1000 * 3600 * 24).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/post/recruiting-in-2026-is-totally-broken</loc>
    <lastmod>${new Date(Date.now() - 1000 * 3600 * 48).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}

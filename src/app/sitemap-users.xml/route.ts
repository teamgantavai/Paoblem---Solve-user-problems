import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Fetch profiles that have a username
  const { data: profiles } = await supabase
    .from('profiles')
    .select('username, updated_at')
    .not('username', 'is', null)
    .order('updated_at', { ascending: false });

  let urlsXml = '';
  
  if (profiles) {
    profiles.forEach((p) => {
      if (p.username) {
        urlsXml += `  <url>
    <loc>${siteUrl}/user/${p.username}</loc>
    <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
      }
    });
  }

  // Add mock profiles sitemaps
  urlsXml += `  <url>
    <loc>${siteUrl}/user/dylan_field</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${siteUrl}/user/ryan_roslansky</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
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

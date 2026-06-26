import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Fetch solutions ordered by updated_at desc
  const { data: solutions } = await supabase
    .from('solutions')
    .select('id, updated_at')
    .order('updated_at', { ascending: false });

  let urlsXml = '';
  
  // Static solutions feed page
  urlsXml += `  <url>
    <loc>${siteUrl}/solutions</loc>
    <changefreq>always</changefreq>
    <priority>0.9</priority>
  </url>\n`;

  // Dynamic solution detail URLs
  if (solutions) {
    solutions.forEach((sol) => {
      if (sol.id) {
        urlsXml += `  <url>
    <loc>${siteUrl}/solutions/${sol.id}</loc>
    <lastmod>${new Date(sol.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
      }
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}

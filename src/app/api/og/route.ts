import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function wrapText(text: string, maxChars: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxChars) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine) {
    lines.push(currentLine.trim());
  }
  return lines;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return new NextResponse('postId is required', { status: 400 });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch post and author profiles
    const { data: post, error: postErr } = await admin
      .from('posts')
      .select('*, profiles:user_id(*)')
      .eq('id', postId)
      .single();

    if (postErr || !post) {
      return new NextResponse('Post not found', { status: 404 });
    }

    const title = post.title || 'No title';
    const body = post.body || '';
    const upvotes = post.upvotes || 0;
    const comments = post.comments_count || 0;
    const saves = post.saves || 0;
    const authorName = post.profiles?.full_name || post.profiles?.username || 'Someone';
    const authorRole = post.profiles?.role || 'Innovator';
    const authorAvatar = post.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.user_id}`;

    // Text Wrapping
    const titleLines = wrapText(title, 36).slice(0, 3);
    const bodyLines = wrapText(body.replace(/<[^>]*>/g, ''), 52).slice(0, 3);
    if (wrapText(body, 52).length > 3) {
      bodyLines[bodyLines.length - 1] += '...';
    }

    // Clean avatar URL for XML compatibility
    const cleanAvatar = authorAvatar.replace(/&/g, '&amp;');

    const svg = `
<svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0b0e" />
      <stop offset="100%" stop-color="#14161f" />
    </linearGradient>
    
    <!-- Branding Gradient -->
    <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>

    <!-- Border Gradient -->
    <linearGradient id="border-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2a2d3d" />
      <stop offset="100%" stop-color="#1b1c26" />
    </linearGradient>

    <!-- Clip Path for Avatar -->
    <clipPath id="avatar-clip">
      <circle cx="90" cy="180" r="30" />
    </clipPath>
  </defs>

  <style>
    .title-text { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 36px; font-weight: 800; fill: #ffffff; }
    .body-text { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 20px; font-weight: 400; fill: #a1a1aa; line-height: 1.6; }
    .author-name { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 20px; font-weight: 700; fill: #ffffff; }
    .author-role { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 500; fill: #71717a; }
    .logo-text { font-family: 'Outfit', 'Inter', system-ui, sans-serif; font-size: 24px; font-weight: 800; fill: url(#brand-grad); letter-spacing: -0.03em; }
    .watermark-text { font-family: 'Inter', system-ui, sans-serif; font-size: 14px; font-weight: 600; fill: #3f3f46; letter-spacing: 0.05em; }
    .stat-label { font-family: 'Inter', system-ui, sans-serif; font-size: 16px; font-weight: 700; fill: #ffffff; }
    .stat-icon { fill: #71717a; }
  </style>

  <!-- Outer background -->
  <rect width="800" height="800" fill="url(#bg-grad)" />

  <!-- Main Card -->
  <rect x="40" y="40" width="720" height="720" rx="32" fill="#15171e" stroke="url(#border-grad)" stroke-width="2" />

  <!-- Card Top Branding Header -->
  <g transform="translate(80, 80)">
    <!-- Logo Icon -->
    <path d="M0,12 L6,2 L12,12 L6,9 Z" fill="url(#brand-grad)" transform="scale(1.8)" />
    <text x="32" y="18" class="logo-text">Paoblem</text>
    <rect x="610" y="0" width="30" height="20" rx="4" fill="#242735" />
    <text x="616" y="14" font-family="sans-serif" font-size="10" font-weight="700" fill="#a1a1aa">${post.type.toUpperCase()}</text>
  </g>

  <!-- Divider -->
  <line x1="80" y1="125" x2="720" y2="125" stroke="#272a34" stroke-width="1" />

  <!-- Author Profile Section -->
  <!-- Background circle placeholder for avatar in case it doesn't load -->
  <circle cx="90" cy="180" r="30" fill="#272a34" />
  <!-- Profile Icon Fallback -->
  <path d="M84,174 A6,6 0 1,1 96,174 A6,6 0 1,1 84,174 M78,192 C78,184 84,182 90,182 C96,182 102,184 102,192 Z" fill="#71717a" />
  <!-- Real Avatar Image -->
  <image href="${cleanAvatar}" x="60" y="150" width="60" height="60" clip-path="url(#avatar-clip)" />

  <!-- Author name and role -->
  <text x="140" y="177" class="author-name">${authorName}</text>
  <text x="140" y="197" class="author-role">${authorRole}</text>

  <!-- Title section -->
  <text x="80" y="270" class="title-text">
    ${titleLines.map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : 48}">${line}</tspan>`).join('')}
  </text>

  <!-- Body / Description Snippet -->
  <text x="80" y="470" class="body-text">
    ${bodyLines.map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : 34}">${line}</tspan>`).join('')}
  </text>

  <!-- Stats Section Footer -->
  <g transform="translate(80, 650)">
    <!-- Upvotes -->
    <path d="M0,8 L7,0 L14,8 Z" class="stat-icon" transform="translate(0, 2)" />
    <text x="24" y="12" class="stat-label">${upvotes}</text>

    <!-- Saves -->
    <path d="M0,0 L10,0 L10,13 L5,9 L0,13 Z" class="stat-icon" transform="translate(100, 1)" />
    <text x="120" y="12" class="stat-label">${saves}</text>

    <!-- Comments -->
    <path d="M0,0 L14,0 C16,0 17,1 17,3 L17,9 C17,11 16,12 14,12 L8,12 L4,16 L4,12 L3,12 C1,12 0,11 0,9 L0,3 C0,1 1,0 0,0 Z" class="stat-icon" transform="translate(200, 1)" />
    <text x="228" y="12" class="stat-label">${comments}</text>
  </g>

  <!-- Watermark at the bottom -->
  <text x="345" y="725" class="watermark-text">PAOBLEM.COM</text>

</svg>
`;

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (err: any) {
    console.error('[OG Card API] error:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

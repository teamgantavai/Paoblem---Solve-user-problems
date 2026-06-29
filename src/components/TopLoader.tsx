'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/* ─── Theme-aware top progress bar ────────────────────────────────────────── */

let timer: ReturnType<typeof setTimeout> | null = null;

function getBarColor() {
  return '#2563eb';
}

function getGlowColor() {
  return 'rgba(37, 99, 235, 0.45)';
}

function startBar() {
  const bar = document.getElementById('top-loader-bar');
  const glow = document.getElementById('top-loader-glow');
  if (!bar || !glow) return;

  const color = getBarColor();

  bar.style.background = color;
  bar.style.boxShadow = 'none';
  glow.style.boxShadow = 'none';

  bar.style.transition = 'none';
  bar.style.width = '0%';
  bar.style.opacity = '1';
  glow.style.opacity = '1';
  // Force reflow
  void bar.offsetWidth;
  bar.style.transition = 'width 10s cubic-bezier(0.1, 0.05, 0, 1)';
  bar.style.width = '85%';
}

function finishBar() {
  const bar = document.getElementById('top-loader-bar');
  const glow = document.getElementById('top-loader-glow');
  if (!bar || !glow) return;
  bar.style.transition = 'width 0.25s ease, opacity 0.4s ease 0.25s';
  bar.style.width = '100%';
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    bar.style.opacity = '0';
    glow.style.opacity = '0';
  }, 500);
}

export default function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    const current = pathname + '?' + searchParams.toString();
    if (prevPath.current !== null && prevPath.current !== current) {
      finishBar();
    }
    prevPath.current = current;
  }, [pathname, searchParams]);

  // Intercept Next.js link clicks to start the bar immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('http') || target.target === '_blank') return;
      startBar();
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const handleStart = () => startBar();
    const handleFinish = () => finishBar();

    window.addEventListener('top-loader:start', handleStart);
    window.addEventListener('top-loader:finish', handleFinish);
    return () => {
      window.removeEventListener('top-loader:start', handleStart);
      window.removeEventListener('top-loader:finish', handleFinish);
    };
  }, []);

  return (
    <>
      {/* Bar container */}
      <div
        id="top-loader-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '2px',
          width: '0%',
          background: '#ffffff',
          zIndex: 9999,
          opacity: 0,
          pointerEvents: 'none',
          borderRadius: '0 2px 2px 0',
        }}
      />
      {/* Glow */}
      <div
        id="top-loader-glow"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '2px',
          background: 'transparent',
          zIndex: 9998,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

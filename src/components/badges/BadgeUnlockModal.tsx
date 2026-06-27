'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import BadgeArtwork from './BadgeArtwork';
import type { BadgeRarity, BadgeCategory } from '@/lib/badgeDefinitions';
import { RARITY_CONFIG } from '@/lib/badgeDefinitions';

interface BadgeUnlockModalProps {
  badge: {
    slug: string;
    name: string;
    description: string;
    category: BadgeCategory;
    rarity: BadgeRarity;
    rep_reward: number;
  } | null;
  onClose: () => void;
  onViewCollection: () => void;
}

// ─── Confetti Particle ────────────────────────────────────────────────────────
function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  const style: React.CSSProperties = {
    position: 'fixed',
    top: '-10px',
    left: `${x}%`,
    width: '8px',
    height: '8px',
    backgroundColor: color,
    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    animationName: 'confettiFall',
    animationDuration: `${2.5 + Math.random() * 2}s`,
    animationDelay: `${delay}s`,
    animationTimingFunction: 'ease-in',
    animationFillMode: 'forwards',
    zIndex: 10001,
    transform: `rotate(${Math.random() * 360}deg)`,
  };
  return <div style={style} />;
}

// ─── Light Ray ────────────────────────────────────────────────────────────────
function LightRays({ color }: { color: string }) {
  return (
    <div className="badge-unlock-rays" style={{ '--ray-color': color } as React.CSSProperties}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="badge-unlock-ray"
          style={{ transform: `rotate(${i * 30}deg)` }}
        />
      ))}
    </div>
  );
}

// ─── Floating Particle ────────────────────────────────────────────────────────
function FloatingParticles({ color }: { color: string }) {
  return (
    <div className="badge-unlock-particles">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="badge-unlock-particle"
          style={{
            '--particle-color': color,
            '--particle-delay': `${i * 0.12}s`,
            '--particle-angle': `${(i / 16) * 360}deg`,
            '--particle-distance': `${60 + Math.random() * 60}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default function BadgeUnlockModal({
  badge,
  onClose,
  onViewCollection,
}: BadgeUnlockModalProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  
  // Scratch Reveal States
  const [revealed, setRevealed] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [scratching, setScratching] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  
  const prefersReduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const redirectTimeoutRef = useRef<any>(null);

  const rarityConf = badge ? RARITY_CONFIG[badge.rarity] : null;

  // Reset scratch states when a new badge is loaded
  useEffect(() => {
    if (badge) {
      setRevealed(false);
      setScratchProgress(0);
      setScratching(false);
    }
  }, [badge]);

  // Setup Scratch Canvas coating
  useEffect(() => {
    if (visible && !revealed && canvasRef.current && badge) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 240;
      const height = 240;
      canvas.width = width;
      canvas.height = height;

      // Draw shiny metallic silver/gray gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#f1f5f9'); // Slate 100
      grad.addColorStop(0.2, '#cbd5e1'); // Slate 300
      grad.addColorStop(0.5, '#ffffff'); // bright reflective highlight
      grad.addColorStop(0.8, '#cbd5e1');
      grad.addColorStop(1, '#475569'); // Slate 600

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Fine brushed hairline texture
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      for (let i = 0; i < height; i += 2) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Border highlight frame
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, width - 8, height - 8);

      // Draw mystery badge decorations
      ctx.textAlign = 'center';
      
      // Question marks
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = '#fbbf24'; // Amber 400
      ctx.fillText('❓❓❓', width / 2, height / 2 - 12);

      // Text Labels
      ctx.font = '800 13px sans-serif';
      ctx.fillStyle = '#1e293b'; // Slate 800
      ctx.fillText('MYSTERY ACHIEVEMENT', width / 2, height / 2 + 24);

      ctx.font = '500 11px sans-serif';
      ctx.fillStyle = '#475569'; // Slate 600
      ctx.fillText('Scratch to Reveal', width / 2, height / 2 + 48);
    }
  }, [visible, revealed, badge]);

  // Handle touch and mouse scratching positions
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const scratch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 44; // diameter of scratch area (22 radius * 2)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (lastPosRef.current) {
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    lastPosRef.current = { x, y };
    checkClearedPercentage();
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setScratching(true);
    const pos = getMousePos(e);
    lastPosRef.current = pos;
    scratch(pos.x, pos.y);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!scratching) return;
    const pos = getMousePos(e);
    scratch(pos.x, pos.y);
  };

  const handleEnd = () => {
    setScratching(false);
    lastPosRef.current = null;
  };

  // Sub-millisecond scanning loop to evaluate transparent cleared area
  const checkClearedPercentage = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let transparentCount = 0;

    // Scan every 40th pixel (160 elements)
    const scanStep = 160;
    for (let i = 0; i < pixels.length; i += scanStep) {
      if (pixels[i + 3] === 0) {
        transparentCount++;
      }
    }

    const clearedPct = (transparentCount / (pixels.length / scanStep)) * 100;
    setScratchProgress(clearedPct);

    if (clearedPct >= 65) {
      triggerReveal();
    }
  };

  const triggerReveal = () => {
    if (revealed) return;
    setRevealed(true);
    setScratchProgress(100);

    // After animation delay, show corner toast
    setTimeout(() => {
      if (badge) {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} toast-premium-achievement`}>
            <span className="toast-icon">🏆</span>
            <div className="toast-body">
              <span className="toast-title">Achievement Added</span>
              <span className="toast-desc">{badge.name}</span>
            </div>
          </div>
        ), { position: 'bottom-right', duration: 4000 });
      }
    }, 800);

    // Smooth redirect to achievements page after showing the badge (4.5 seconds)
    if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    if (badge) {
      redirectTimeoutRef.current = setTimeout(() => {
        handleClose();
        router.push(`/achievements?badge=${badge.slug}`);
      }, 4500);
    }
  };

  // Solver horizontal sweep animation
  const handleAutoReveal = () => {
    if (revealed) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      triggerReveal();
      return;
    }

    let currentY = 0;
    const interval = setInterval(() => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.fillRect(0, currentY, canvas.width, 24);
      currentY += 24;

      if (currentY >= canvas.height) {
        clearInterval(interval);
        triggerReveal();
      }
    }, 35);
  };

  // Generate confetti colors from rarity
  const confettiColors = badge ? [
    rarityConf!.color,
    '#ffffff',
    rarityConf!.glow.replace('rgba(', 'rgb(').replace(/,[\d.]+\)/, ')'),
    '#fbbf24',
    '#f9fafb',
  ] : [];

  const confettiParticles = prefersReduced ? [] : Array.from({ length: 65 }).map((_, i) => ({
    key: i,
    delay: Math.random() * 0.8,
    x: Math.random() * 100,
    color: confettiColors[i % confettiColors.length],
  }));

  const handleClose = useCallback(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    setVisible(false);
    setTimeout(onClose, 400);
  }, [onClose]);

  useEffect(() => {
    if (badge) {
      // Stagger entrance
      requestAnimationFrame(() => {
        setVisible(true);
        setTimeout(() => setShowContent(true), prefersReduced ? 0 : 200);
      });
    } else {
      setVisible(false);
      setShowContent(false);
    }
  }, [badge, prefersReduced]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    if (badge) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [badge, handleClose]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  if (!badge) return null;

  const unlockDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <>
      {/* Confetti - only fire after scratch reveal is completed! */}
      {visible && revealed && !prefersReduced && confettiParticles.map(p => (
        <ConfettiParticle key={p.key} delay={p.delay} x={p.x} color={p.color} />
      ))}

      {/* Overlay */}
      <div
        ref={overlayRef}
        className={`badge-unlock-overlay ${visible ? 'badge-unlock-overlay-visible' : ''}`}
        onClick={handleOverlayClick}
      >
        {/* Modal card */}
        <div
          className={`badge-unlock-modal ${showContent ? 'badge-unlock-modal-visible' : ''}`}
          style={{
            '--rarity-glow': rarityConf!.glow,
            '--rarity-color': rarityConf!.color,
            '--rarity-border': rarityConf!.border,
            '--rarity-bg': rarityConf!.bg,
          } as React.CSSProperties}
          role="dialog"
          aria-modal="true"
          aria-label={`Achievement unlocked: ${badge.name}`}
        >
          {/* Close button */}
          <button className="badge-unlock-close" onClick={handleClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>

          {/* Header label */}
          <div className="badge-unlock-header">
            <span className="badge-unlock-label" style={{ letterSpacing: '0.05em' }}>
              {revealed ? '🏆 Achievement Unlocked' : '✨ New Achievement Unlocked'}
            </span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {revealed ? "You've unlocked a new badge!" : "You've earned a new achievement."}
            </p>
          </div>

          {/* Badge artwork zone / Scratch Area */}
          <div className="badge-unlock-artwork-zone" style={{ margin: '1.5rem auto 1.5rem' }}>
            {/* Background elements - only visible when revealed */}
            {revealed && !prefersReduced && <LightRays color={rarityConf!.color} />}
            {revealed && !prefersReduced && <FloatingParticles color={rarityConf!.color} />}
            
            <div className="badge-unlock-artwork-inner" style={{ overflow: 'visible', position: 'relative' }}>
              {!revealed ? (
                /* Interactive scratch overlay card container */
                <div className="badge-scratch-container">
                  {/* Badge visual underneath the card */}
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BadgeArtwork
                      slug={badge.slug}
                      rarity={badge.rarity}
                      category={badge.category}
                      size={140}
                      locked={false}
                      animated={false}
                    />
                  </div>
                  {/* The interactive canvas mask */}
                  <canvas
                    ref={canvasRef}
                    className={`badge-scratch-canvas ${scratchProgress >= 65 ? 'badge-scratch-canvas-fade' : ''}`}
                    onMouseDown={handleStart}
                    onMouseMove={handleMove}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    onTouchStart={handleStart}
                    onTouchMove={handleMove}
                    onTouchEnd={handleEnd}
                  />
                </div>
              ) : (
                /* Revealed shiny badge with scales & twist animation */
                <div className="badge-reveal-animate">
                  <BadgeArtwork
                    slug={badge.slug}
                    rarity={badge.rarity}
                    category={badge.category}
                    size={140}
                    locked={false}
                    animated={true}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Details & CTA Buttons */}
          {!revealed ? (
            /* Locked state CTA: Scratch guide & Auto solver */
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Scratch the card to reveal your secret achievement!
              </p>
              <button
                className="badge-unlock-btn badge-unlock-btn-primary"
                onClick={handleAutoReveal}
                style={{
                  '--btn-glow': 'rgba(251, 191, 36, 0.25)',
                  '--btn-color': '#f59e0b',
                  fontSize: '0.85rem',
                  padding: '0.6rem 1.75rem',
                  borderRadius: '20px'
                } as React.CSSProperties}
              >
                Scratch Now
              </button>
            </div>
          ) : (
            /* Revealed state badge information and profile action redirections */
            <>
              <div className="badge-unlock-info" style={{ marginTop: '0.5rem' }}>
                <h2 className="badge-unlock-name" style={{ color: '#ffffff' }}>
                  {badge.name}
                </h2>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', margin: '0.5rem 0' }}>
                  <div
                    className="badge-unlock-rarity-pill"
                    style={{ color: rarityConf!.textColor, background: rarityConf!.bg, borderColor: rarityConf!.color }}
                  >
                    <span className="badge-rarity-dot" style={{ background: rarityConf!.color }} />
                    {rarityConf!.label}
                  </div>
                  <div
                    className="badge-unlock-rarity-pill"
                    style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    {badge.category.charAt(0).toUpperCase() + badge.category.slice(1)}
                  </div>
                </div>

                <p className="badge-unlock-description" style={{ fontSize: '0.9rem', lineHeight: '1.45', opacity: 0.9, maxHeight: '75px', overflowY: 'auto' }}>
                  {badge.description}
                </p>

                <div className="badge-unlock-meta" style={{ marginTop: '1.25rem' }}>
                  {badge.rep_reward > 0 && (
                    <div className="badge-unlock-rep" style={{ background: 'rgba(251,191,36,0.04)', borderColor: 'rgba(251,191,36,0.1)' }}>
                      <span className="badge-unlock-rep-icon">⚡</span>
                      <span style={{ color: '#fbbf24', fontWeight: 800 }}>+{badge.rep_reward} Trust Score earned</span>
                    </div>
                  )}
                  <div className="badge-unlock-date">
                    <span className="badge-unlock-date-icon">📅</span>
                    <span>Unlocked {unlockDate}</span>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="badge-unlock-actions" style={{ marginTop: '1.75rem', gap: '0.50rem' }}>
                <button
                  className="badge-unlock-btn"
                  onClick={() => { onViewCollection(); handleClose(); }}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                >
                  View Collection
                </button>
                <button
                  className="badge-unlock-btn"
                  onClick={() => { router.push('/profile'); handleClose(); }}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                >
                  View Profile
                </button>
                <button
                  className="badge-unlock-btn badge-unlock-btn-primary"
                  onClick={handleClose}
                  style={{ '--btn-glow': rarityConf!.glow, '--btn-color': rarityConf!.color, fontSize: '0.85rem' } as React.CSSProperties}
                >
                  Continue
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

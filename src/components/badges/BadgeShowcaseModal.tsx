'use client';

import React, { useEffect, useState, useRef } from 'react';
import BadgeArtwork from './BadgeArtwork';
import { BADGE_DEFINITIONS, RARITY_CONFIG, type BadgeRarity } from '@/lib/badgeDefinitions';

interface BadgeShowcaseModalProps {
  badge: {
    slug: string;
    name: string;
    description: string;
    hint_text: string;
    category: any;
    rarity: BadgeRarity;
    rep_reward: number;
    is_hidden?: boolean;
    earned?: boolean;
    earned_at?: string | null;
  } | null;
  onClose: () => void;
}

export default function BadgeShowcaseModal({ badge, onClose }: BadgeShowcaseModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Interactive toy physics state
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  // Click & tap tracking refs
  const dragDistanceRef = useRef(0);
  const clickTimeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable coordinates ref to run physics loop at solid 60 FPS
  const physicsRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotation: 0,
    lastTime: 0,
    lastX: 0,
    lastY: 0,
    animFrameId: 0,
    isPhysicsActive: false,
  });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // Reusable Physics Loop runner
  const startPhysicsLoop = () => {
    const p = physicsRef.current;
    if (p.animFrameId) cancelAnimationFrame(p.animFrameId);

    const runPhysics = () => {
      if (!p.isPhysicsActive) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const cx = width / 2;
      const cy = height / 2;
      const r = 70; // mascot bounding radius

      const mx = cx + p.x;
      const my = cy + p.y;

      // 1. Hooke's Law Spring Force towards Center (0, 0)
      const ax = (0 - p.x) * 0.078;
      const ay = (0 - p.y) * 0.078;

      // 2. Add acceleration and apply air damping (0.925)
      p.vx = (p.vx + ax) * 0.925;
      p.vy = (p.vy + ay) * 0.925;

      // 3. Move positions
      p.x += p.vx;
      p.y += p.vy;

      // 4. Boundary Collision Bounces (Elastic Collisions)
      const updatedMx = cx + p.x;
      const updatedMy = cy + p.y;

      if (updatedMx - r < 0) {
        p.x = r - cx;
        p.vx = -p.vx * 0.82;
      } else if (updatedMx + r > width) {
        p.x = width - r - cx;
        p.vx = -p.vx * 0.82;
      }

      if (updatedMy - r < 0) {
        p.y = r - cy;
        p.vy = -p.vy * 0.82;
      } else if (updatedMy + r > height) {
        p.y = height - r - cy;
        p.vy = -p.vy * 0.82;
      }

      // Roll angle matches speed
      p.rotation += p.vx * 1.8;

      const distToHome = Math.sqrt(p.x * p.x + p.y * p.y);
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);

      // Settle back to center stop condition
      if (distToHome < 0.2 && speed < 0.04) {
        p.x = 0;
        p.y = 0;
        p.vx = 0;
        p.vy = 0;
        p.rotation = 0;
        p.isPhysicsActive = false;
        setOffset({ x: 0, y: 0 });
        setRotation(0);
        return;
      }

      setOffset({ x: p.x, y: p.y });
      setRotation(p.rotation);

      p.animFrameId = requestAnimationFrame(runPhysics);
    };

    p.animFrameId = requestAnimationFrame(runPhysics);
  };

  // Mount logic: key listeners, automatic initial bounce animation, and confetti canvas loop
  useEffect(() => {
    if (!badge) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Confetti canvas animation burst
    const canvas = canvasRef.current;
    let confettiAnimId = 0;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const colors = ['#fde047', '#f43f5e', '#3b82f6', '#10b981', '#a855f7', '#f97316'];
        const particles: any[] = [];
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Spawn 90 particles ejecting from center
        for (let i = 0; i < 90; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 4 + Math.random() * 11;
          particles.push({
            x: cx,
            y: cy - 40,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 5, // fountain-style initial upward arc
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 5 + Math.random() * 6,
            rotation: Math.random() * 360,
            rotSpeed: -5 + Math.random() * 10,
            opacity: 1,
          });
        }

        const updateConfetti = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          let active = false;
          particles.forEach((p) => {
            if (p.opacity <= 0) return;
            active = true;

            // Physics mechanics
            p.vy += 0.22; // gravity pulls downward
            p.vx *= 0.98; // air friction
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotSpeed;
            p.opacity -= 0.0085; // fade out rate

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(p.opacity, 0);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
          });

          if (active) {
            confettiAnimId = requestAnimationFrame(updateConfetti);
          }
        };
        confettiAnimId = requestAnimationFrame(updateConfetti);
      }
    }

    // Snappy initial kick/bounce when user clicks the badge and modal opens!
    const timer = setTimeout(() => {
      const p = physicsRef.current;
      p.vx = 0;
      p.vy = -20; // snappily pop/flick upwards
      p.isPhysicsActive = true;
      startPhysicsLoop();
    }, 250);

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
      const p = physicsRef.current;
      if (p.animFrameId) cancelAnimationFrame(p.animFrameId);
    };
  }, [badge]);

  if (!badge) return null;

  const rConf = RARITY_CONFIG[badge.rarity] || { color: '#ffffff', glow: 'rgba(255,255,255,0.1)' };
  const isHiddenLocked = badge.is_hidden && !badge.earned;

  // Mouse hover 3D tilt card handlers (only active when not dragging or flying)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xc = rect.width / 2;
    const yc = rect.height / 2;
    const rotateY = ((x - xc) / xc) * 15;
    const rotateX = -((y - yc) / yc) * 15;
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Pointer drag and physics bounce triggers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    
    const p = physicsRef.current;
    p.vx = 0;
    p.vy = 0;
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    p.lastTime = performance.now();
    p.isPhysicsActive = false;
    
    // Tap metrics
    clickTimeRef.current = performance.now();
    dragDistanceRef.current = 0;
    
    if (p.animFrameId) {
      cancelAnimationFrame(p.animFrameId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const p = physicsRef.current;
    const now = performance.now();
    const dt = Math.max(now - p.lastTime, 1);
    
    const dx = e.clientX - p.lastX;
    const dy = e.clientY - p.lastY;
    
    p.x += dx;
    p.y += dy;
    
    // Accumulate total drag movement distance
    dragDistanceRef.current += Math.sqrt(dx * dx + dy * dy);
    
    // Instantaneous velocity (pixels per frame)
    p.vx = (dx / dt) * 16;
    p.vy = (dy / dt) * 16;
    
    // Roll mascot rotation
    p.rotation += dx * 0.85;
    
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    p.lastTime = now;
    
    setOffset({ x: p.x, y: p.y });
    setRotation(p.rotation);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const p = physicsRef.current;
    const duration = performance.now() - clickTimeRef.current;
    
    // If the user just tapped/clicked without dragging, apply a random bouncy kick!
    if (duration < 250 && dragDistanceRef.current < 6) {
      const angle = Math.random() * Math.PI * 2;
      const force = 18 + Math.random() * 8;
      p.vx = Math.cos(angle) * force;
      p.vy = Math.sin(angle) * force;
      p.isPhysicsActive = true;
      startPhysicsLoop();
      return;
    }
    
    // Else, perform normal momentum throw based on dragging speed
    p.isPhysicsActive = true;
    p.vx = Math.max(Math.min(p.vx, 32), -32);
    p.vy = Math.max(Math.min(p.vy, 32), -32);
    
    startPhysicsLoop();
  };

  const isInteractive = isDragging || physicsRef.current.isPhysicsActive;
  const transformStyle = isInteractive
    ? `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`
    : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;

  return (
    <div
      className={`clean-modal-overlay ${isClosing ? 'is-closing' : ''}`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      {/* Confetti Canvas Particle Spray */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10001,
        }}
      />

      {/* Floating Close Button at Overlay Screen Level */}
      <button className="clean-modal-close-btn" onClick={handleClose} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div
        className={`premium-showcase-modal-box ${isClosing ? 'is-closing' : ''}`}
        style={{ '--rarity-glow-shadow': rConf.glow } as React.CSSProperties}
      >
        {/* Pulsing Highlight Ripples */}
        <div className="badge-ripple-ring" style={{ '--rarity-glow-shadow': rConf.glow } as React.CSSProperties} />
        <div className="badge-ripple-ring" style={{ '--rarity-glow-shadow': rConf.glow, animationDelay: '1s' } as React.CSSProperties} />
        <div className="badge-ripple-ring" style={{ '--rarity-glow-shadow': rConf.glow, animationDelay: '2s' } as React.CSSProperties} />

        {/* Spinning Sunburst Beam Rays */}
        <svg className="sunburst-rays" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="sunburst-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={rConf.color} stopOpacity="0.45" />
              <stop offset="100%" stopColor={rConf.color} stopOpacity="0" />
            </radialGradient>
          </defs>
          {[...Array(12)].map((_, i) => (
            <path
              key={i}
              d="M50 50 L46 0 L54 0 Z"
              fill="url(#sunburst-grad)"
              transform={`rotate(${i * 30} 50 50)`}
            />
          ))}
        </svg>

        {/* Hero Glow Backdrop */}
        <div className="badge-hero-lighting-glow" style={{ background: rConf.glow }} />

        {/* Mascot Container with Physics Dragging */}
        <div
          className={`badge-3d-perspective-container ${!isInteractive ? 'badge-hero-idle-float' : ''}`}
          style={{ 
            width: '240px', 
            height: '240px',
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseMove={!isInteractive ? handleMouseMove : undefined}
          onMouseLeave={!isInteractive ? handleMouseLeave : undefined}
        >
          <div
            className="badge-3d-card"
            style={{
              width: '220px',
              height: '220px',
              transform: transformStyle,
              borderColor: rConf.color,
              borderRadius: '24px',
              transition: isDragging ? 'none' : undefined,
            }}
          >
            <div className="badge-3d-card-inner">
              <BadgeArtwork
                slug={badge.slug}
                rarity={badge.rarity}
                category={badge.category}
                size={175}
                locked={!badge.earned}
                animated={true}
                transparentBackground={false}
              />
            </div>
          </div>
        </div>

        {/* Celebratory Walkthrough Hint (Only if locked) */}
        {!badge.earned && (
          <div className="premium-showcase-metadata">
            {isHiddenLocked ? 'Earn this badge to unlock details' : badge.hint_text}
          </div>
        )}
      </div>
    </div>
  );
}

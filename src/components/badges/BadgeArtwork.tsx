'use client';

import React, { useState } from 'react';
import type { BadgeRarity, BadgeCategory } from '@/lib/badgeDefinitions';

interface BadgeArtworkProps {
  slug: string;
  rarity: BadgeRarity;
  category: BadgeCategory;
  size?: number;
  locked?: boolean;
  animated?: boolean;
  transparentBackground?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PREMIUM 3D MATERIAL ENAMEL BEZELS & GRADIENTS
   ═══════════════════════════════════════════════════════════════════════════ */
function EnamelDiscDefs({ rarity, id }: { rarity: BadgeRarity; id: string }) {
  return (
    <defs>
      {/* Matte Silver Steel Bezel */}
      <linearGradient id={`${id}-metal-common`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="25%" stopColor="#cbd5e1" />
        <stop offset="50%" stopColor="#f1f5f9" />
        <stop offset="75%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>
      {/* Enamel Background - Common */}
      <radialGradient id={`${id}-enamel-common`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="70%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#64748b" />
      </radialGradient>

      {/* Green Enamel Bezel */}
      <linearGradient id={`${id}-metal-uncommon`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a7f3d0" />
        <stop offset="25%" stopColor="#34d399" />
        <stop offset="50%" stopColor="#ffffff" />
        <stop offset="75%" stopColor="#059669" />
        <stop offset="100%" stopColor="#064e3b" />
      </linearGradient>
      {/* Enamel Background - Uncommon */}
      <radialGradient id={`${id}-enamel-uncommon`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="70%" stopColor="#059669" />
        <stop offset="100%" stopColor="#064e3b" />
      </radialGradient>

      {/* Blue Sapphire Crystal Bezel */}
      <linearGradient id={`${id}-metal-rare`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#93c5fd" />
        <stop offset="25%" stopColor="#60a5fa" />
        <stop offset="50%" stopColor="#ffffff" />
        <stop offset="75%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </linearGradient>
      {/* Enamel Background - Rare */}
      <radialGradient id={`${id}-enamel-rare`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="70%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </radialGradient>

      {/* Purple Amethyst / Rose Gold Bezel */}
      <linearGradient id={`${id}-metal-epic`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fed7aa" />
        <stop offset="25%" stopColor="#f472b6" />
        <stop offset="50%" stopColor="#ffffff" />
        <stop offset="75%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#581c87" />
      </linearGradient>
      {/* Enamel Background - Epic */}
      <radialGradient id={`${id}-enamel-epic`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="70%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#3b0764" />
      </radialGradient>

      {/* Gold Foil / Gold Rim Bezel */}
      <linearGradient id={`${id}-metal-legendary`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fffbeb" />
        <stop offset="20%" stopColor="#fde047" />
        <stop offset="40%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#f59e0b" />
        <stop offset="80%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      {/* Enamel Background - Legendary */}
      <radialGradient id={`${id}-enamel-legendary`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="60%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#451a03" />
      </radialGradient>

      {/* Mythic Black Titanium & Gold Edge Bezel */}
      <linearGradient id={`${id}-metal-mythic`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#374151" />
        <stop offset="20%" stopColor="#ec4899" />
        <stop offset="40%" stopColor="#3b82f6" />
        <stop offset="60%" stopColor="#eab308" />
        <stop offset="80%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#111827" />
      </linearGradient>
      {/* Enamel Background - Mythic */}
      <radialGradient id={`${id}-enamel-mythic`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#f472b6" />
        <stop offset="40%" stopColor="#1e1b4b" />
        <stop offset="100%" stopColor="#030712" />
      </radialGradient>

      {/* Shadows & Lighting Defs */}
      <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.4" />
      </filter>
      <filter id={`${id}-char-shadow`} x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.35" />
      </filter>

      {/* Coin inner shadow radial gradient */}
      <radialGradient id="coin-inner-shadow" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.75" />
      </radialGradient>

      {/* Glass sheen linear gradient */}
      <linearGradient id="glass-shine-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
        <stop offset="40%" stopColor="#ffffff" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

interface EnamelDiscProps {
  rarity: BadgeRarity;
  id: string;
}

function BaseEnamelDisc({ rarity, id }: EnamelDiscProps) {
  return (
    <>
      {/* 3D Soft Drop Shadow */}
      <circle cx="50" cy="56" r="38" fill="rgba(0,0,0,0.35)" filter={`url(#${id}-shadow)`} />
      
      {/* Thick Outer 3D Metallic Bezel (Beveled Rim) */}
      <circle cx="50" cy="56" r="38" fill={`url(#${id}-metal-${rarity})`} />
      <circle cx="50" cy="56" r="36" fill="rgba(0, 0, 0, 0.15)" />
      
      {/* Inner Bezel highlight ring */}
      <circle cx="50" cy="56" r="35.5" fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="0.75" />
      
      {/* Inner Enamel Base */}
      <circle cx="50" cy="56" r="33.5" fill={`url(#${id}-enamel-${rarity})`} />

      {/* Volumetric shade inside the coin */}
      <circle cx="50" cy="56" r="33.5" fill="url(#coin-inner-shadow)" opacity="0.4" style={{ mixBlendMode: 'multiply' }} />
      
      {/* Inner metal ring line */}
      <circle cx="50" cy="56" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.75" />
    </>
  );
}

function Sparkles({ rarity }: { rarity: BadgeRarity }) {
  if (rarity === 'common' || rarity === 'uncommon') return null;
  
  const sparkleColor = rarity === 'rare' ? '#93c5fd' : rarity === 'epic' ? '#f5d0fe' : rarity === 'legendary' ? '#fef08a' : '#fbcfe8';

  return (
    <g className="badge-sparkles-group" pointerEvents="none">
      {/* Sparkle 1: Top Left */}
      <path
        className="badge-sparkle badge-sparkle-1"
        d="M 22 23 Q 22 28 27 28 Q 22 28 22 33 Q 22 28 17 28 Q 22 28 22 23 Z"
        fill={sparkleColor}
        opacity="0.9"
        filter="drop-shadow(0 0 2px rgba(255,255,255,0.8))"
      />
      {/* Sparkle 2: Top Right */}
      <path
        className="badge-sparkle badge-sparkle-2"
        d="M 78 26 Q 78 32 84 32 Q 78 32 78 38 Q 78 32 72 32 Q 78 32 78 26 Z"
        fill={sparkleColor}
        opacity="0.8"
        filter="drop-shadow(0 0 3px rgba(255,255,255,0.8))"
      />
      {/* Sparkle 3: Bottom Left */}
      <path
        className="badge-sparkle badge-sparkle-3"
        d="M 20 70 Q 20 74 24 74 Q 20 74 20 78 Q 20 74 16 74 Q 20 74 20 70 Z"
        fill={sparkleColor}
        opacity="0.75"
        filter="drop-shadow(0 0 2px rgba(255,255,255,0.6))"
      />
    </g>
  );
}

function GlassSheen({ id, sheenPos, isHovered }: { id: string; sheenPos: { x: number; y: number }; isHovered: boolean }) {
  return (
    <>
      {/* Glass dome reflection highlight arc */}
      <path
        d="M 17.5 56 A 32.5 32.5 0 0 1 82.5 56 A 32.5 15 0 0 0 17.5 56 Z"
        fill="url(#glass-shine-grad)"
        opacity="0.3"
        pointerEvents="none"
      />
      {/* Dynamic interactive glint layer */}
      <circle
        cx="50"
        cy="56"
        r="32.5"
        fill={`url(#${id}-sheen-grad)`}
        opacity={isHovered ? 0.35 : 0.15}
        style={{ mixBlendMode: 'overlay', pointerEvents: 'none', transition: 'opacity 0.3s ease' }}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   50 UNIQUE ANIMAL MASCOT COMPONENT DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════════ */

// 1. Lion
function CharacterLion({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <path d="M50 10 C10 10 6 46 6 62 C6 82 28 98 50 98 C72 98 94 82 94 62 C94 46 90 10 50 10 Z" fill="#ea580c" />
      <circle cx="50" cy="56" r="25" fill="#fbbf24" />
      <path d="M32 44 Q40 38 44 44" fill="none" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M56 44 Q60 38 68 44" fill="none" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
      <polygon points="50,58 43,49 57,49" fill="#1e293b" />
      <path d="M41 62 Q50 75 59 62 Z" fill="#1e293b" />
      <path d="M45 67 Q50 73 55 67" fill="#f43f5e" />
      <polygon points="42,26 50,12 58,26" fill="#fde047" />
    </g>
  );
}

// 2. Tiger
function CharacterTiger({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="50" cy="52" r="23" fill="#ea580c" />
      <path d="M28 42 H38 M72 42 H62 M50 29 V36" stroke="#000000" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="50" cy="58" rx="11" ry="8" fill="#ffedd5" />
      <circle cx="50" cy="54" r="3.5" fill="#1e293b" />
      <path d="M45 60 Q50 67 55 60 Z" fill="#1e293b" />
      <path d="M47 63 Q50 67 53 63" fill="#f43f5e" />
      <circle cx="38" cy="44" r="5.5" fill="#ffffff" />
      <circle cx="38" cy="44" r="2.2" fill="#000000" />
      <circle cx="61" cy="44" r="5.5" fill="#ffffff" />
      <circle cx="61" cy="44" r="2.2" fill="#000000" />
    </g>
  );
}

// 3. Fox
function CharacterFox({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <path d="M26 38 C14 8 28 20 38 32 Z" fill="#ea580c" />
      <path d="M74 38 C86 8 72 20 62 32 Z" fill="#ea580c" />
      <ellipse cx="50" cy="48" rx="22" ry="18" fill="#ea580c" />
      <path d="M28 48 C16 48 24 62 36 58 Z" fill="#ffffff" />
      <path d="M72 48 C84 48 76 62 64 58 Z" fill="#ffffff" />
      <circle cx="50" cy="65" r="3.5" fill="#1e293b" />
      <path d="M45 56 Q50 62 55 56 Z" fill="#1e293b" />
      <path d="M47 58 Q50 62 53 58" fill="#f43f5e" />
      <circle cx="36" cy="38" r="7.5" fill="#ffffff" />
      <circle cx="36" cy="39" r="3" fill="#000000" />
      <circle cx="64" cy="38" r="7.5" fill="#ffffff" />
      <circle cx="64" cy="37" r="3" fill="#000000" />
      <circle cx="50" cy="11" r="8" fill="#fde047" filter="drop-shadow(0 0 5px #fde047)" />
      <line x1="50" y1="19" x2="50" y2="25" stroke="#ffffff" strokeWidth="2.5" />
    </g>
  );
}

// 4. Wolf
function CharacterWolf({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <polygon points="24,36 14,8 34,30 Z" fill="#475569" />
      <polygon points="76,36 86,8 66,30 Z" fill="#475569" />
      <polygon points="50,72 18,34 82,34" fill="#475569" />
      <circle cx="50" cy="70" r="4" fill="#1e293b" />
      <path d="M45 60 Q50 66 55 60 Z" fill="#1e293b" />
      <path d="M47 62 Q50 66 53 62" fill="#f43f5e" />
      <ellipse cx="50" cy="54" rx="9" ry="13" fill="#1e293b" />
      <polygon points="32,36 40,40 32,42 Z" fill="#fbbf24" />
      <polygon points="68,36 60,40 68,42 Z" fill="#fbbf24" />
    </g>
  );
}

// 5. Bear
function CharacterBear({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="28" cy="32" r="8" fill="#92400e" />
      <circle cx="72" cy="32" r="8" fill="#92400e" />
      <circle cx="50" cy="52" r="23" fill="#92400e" />
      <ellipse cx="50" cy="58" rx="11" ry="8" fill="#fed7aa" />
      <circle cx="50" cy="54" r="3.2" fill="#1e293b" />
      <path d="M45 60 Q50 67 55 60 Z" fill="#1e293b" />
      <path d="M47 63 Q50 67 53 63" fill="#f43f5e" />
      <circle cx="39" cy="44" r="5" fill="#ffffff" />
      <circle cx="39" cy="44" r="2" fill="#000000" />
      <circle cx="61" cy="44" r="5" fill="#ffffff" />
      <circle cx="61" cy="44" r="2" fill="#000000" />
    </g>
  );
}

// 6. Panda
function CharacterPanda({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="26" cy="24" r="10.5" fill="#1e293b" />
      <circle cx="74" cy="24" r="10.5" fill="#1e293b" />
      <circle cx="50" cy="46" r="26" fill="#ffffff" stroke="#1e293b" strokeWidth="4.5" />
      <ellipse cx="40" cy="44" rx="7.5" ry="10" fill="#1e293b" transform="rotate(-15 40 44)" />
      <ellipse cx="60" cy="44" rx="7.5" ry="10" fill="#1e293b" transform="rotate(15 60 44)" />
      <circle cx="41" cy="43" r="2.5" fill="#ffffff" />
      <circle cx="59" cy="43" r="2.5" fill="#ffffff" />
      <ellipse cx="50" cy="52" rx="4" ry="2.5" fill="#1e293b" />
      <path d="M45 58 Q50 65 55 58 Z" fill="#1e293b" />
      <path d="M47 61 Q50 65 53 61" fill="#f43f5e" />
    </g>
  );
}

// 7. Red Panda
function CharacterRedPanda({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="26" cy="28" r="9.5" fill="#ea580c" />
      <circle cx="74" cy="28" r="9.5" fill="#ea580c" />
      <ellipse cx="50" cy="52" rx="22" ry="18" fill="#ea580c" />
      {/* White cheek patches */}
      <path d="M28 48 C20 48 24 62 36 58 Z" fill="#ffffff" />
      <path d="M72 48 C80 48 76 62 64 58 Z" fill="#ffffff" />
      <ellipse cx="50" cy="56" rx="4" ry="2.5" fill="#1e293b" />
      <path d="M45 61 Q50 68 55 61 Z" fill="#1e293b" />
      <path d="M47 64 Q50 68 53 64" fill="#f43f5e" />
      <circle cx="38" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="38" cy="44" r="1.5" fill="#000000" />
      <circle cx="62" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="62" cy="44" r="1.5" fill="#000000" />
    </g>
  );
}

// 8. Rabbit
function CharacterRabbit({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <path d="M34 38 C30 6 42 6 42 38 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M36 34 C33 12 40 12 40 34 Z" fill="#fee2e2" />
      <path d="M66 38 C70 6 58 6 58 38 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M64 34 C67 12 60 12 60 34 Z" fill="#fee2e2" />
      <ellipse cx="50" cy="56" rx="21" ry="18" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
      <circle cx="41" cy="48" r="4.5" fill="#000000" />
      <circle cx="59" cy="48" r="4.5" fill="#000000" />
      <polygon points="50,56 46,51 54,51" fill="#fca5a5" />
    </g>
  );
}

// 9. Hare
function CharacterHare({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <path d="M32 38 C28 4 40 4 40 38 Z" fill="#b45309" />
      <path d="M68 38 C72 4 60 4 60 38 Z" fill="#b45309" />
      <ellipse cx="50" cy="56" rx="21" ry="18" fill="#d97706" />
      <circle cx="41" cy="48" r="4.5" fill="#000000" />
      <circle cx="59" cy="48" r="4.5" fill="#000000" />
      <polygon points="50,56 46,51 54,51" fill="#fca5a5" />
    </g>
  );
}

// 10. Squirrel (holding acorn)
function CharacterSquirrel({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="50" rx="21" ry="19" fill="#ea580c" />
      <path d="M26 34 L18 20 L30 30 Z" fill="#ea580c" />
      <path d="M74 34 L82 20 L70 30 Z" fill="#ea580c" />
      <circle cx="39" cy="42" r="4.5" fill="#ffffff" />
      <circle cx="39" cy="42" r="2.2" fill="#000000" />
      <circle cx="61" cy="42" r="4.5" fill="#ffffff" />
      <circle cx="61" cy="42" r="2.2" fill="#000000" />
      {/* Brown Acorn */}
      <circle cx="50" cy="68" r="7.5" fill="#78350f" />
      <polygon points="42,64 58,64 50,58" fill="#451a03" />
    </g>
  );
}

// 11. Beaver
function CharacterBeaver({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="28" cy="28" r="8.5" fill="#78350f" />
      <circle cx="72" cy="28" r="8.5" fill="#78350f" />
      <ellipse cx="50" cy="52" rx="25" ry="23" fill="#78350f" />
      <ellipse cx="38" cy="57" rx="9" ry="7" fill="#fed7aa" />
      <ellipse cx="62" cy="57" rx="9" ry="7" fill="#fed7aa" />
      <rect x="44" y="61" width="5.5" height="11" fill="#ffffff" />
      <rect x="50.5" y="61" width="5.5" height="11" fill="#ffffff" />
      <ellipse cx="50" cy="49" rx="5" ry="3.5" fill="#1e293b" />
      <circle cx="36" cy="40" r="7.5" fill="#ffffff" />
      <circle cx="36" cy="40" r="3.2" fill="#000000" />
      <circle cx="64" cy="40" r="7.5" fill="#ffffff" />
      <circle cx="64" cy="40" r="3.2" fill="#000000" />
    </g>
  );
}

// 12. Otter
function CharacterOtter({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="52" rx="22" ry="20" fill="#7c2d12" />
      <ellipse cx="50" cy="58" rx="10" ry="7" fill="#ffedd5" />
      <circle cx="50" cy="55" r="3" fill="#1e293b" />
      <circle cx="39" cy="42" r="5" fill="#ffffff" />
      <circle cx="39" cy="42" r="2" fill="#000000" />
      <circle cx="61" cy="42" r="5" fill="#ffffff" />
      <circle cx="61" cy="42" r="2" fill="#000000" />
    </g>
  );
}

// 13. Raccoon
function CharacterRaccoon({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="54" rx="24" ry="18" fill="#64748b" />
      <ellipse cx="36" cy="50" rx="12" ry="8" fill="#0f172a" transform="rotate(-12 36 50)" />
      <ellipse cx="64" cy="50" rx="12" ry="8" fill="#0f172a" transform="rotate(12 64 50)" />
      <circle cx="37" cy="48" r="3.5" fill="#ffffff" />
      <circle cx="37" cy="48" r="1.5" fill="#000000" />
      <circle cx="63" cy="48" r="3.5" fill="#ffffff" />
      <circle cx="63" cy="48" r="1.5" fill="#000000" />
      <polygon points="50,59 46,53 54,53" fill="#000000" />
    </g>
  );
}

// 14. Badger
function CharacterBadger({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="54" rx="23" ry="19" fill="#475569" />
      {/* Distinct Badger vertical white stripes */}
      <rect x="44" y="35" width="12" height="38" fill="#ffffff" />
      <ellipse cx="34" cy="50" rx="7" ry="9" fill="#0f172a" />
      <ellipse cx="66" cy="50" rx="7" ry="9" fill="#0f172a" />
      <circle cx="34" cy="48" r="3" fill="#ffffff" />
      <circle cx="66" cy="48" r="3" fill="#ffffff" />
      <circle cx="50" cy="62" r="3" fill="#1e293b" />
    </g>
  );
}

// 15. Hedgehog (Prickly brown spine curves)
function CharacterHedgehog({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      {/* Spine points */}
      <path d="M50 14 C20 14 12 38 12 56 C12 74 20 86 50 86 C80 86 88 74 88 56 Z" fill="#451a03" />
      {/* Spikes */}
      <polygon points="20,30 10,24 24,38" fill="#451a03" />
      <polygon points="80,30 90,24 76,38" fill="#451a03" />
      <polygon points="50,14 50,2 45,18" fill="#451a03" />
      <circle cx="50" cy="56" r="21" fill="#fed7aa" />
      <circle cx="39" cy="48" r="3.5" fill="#1e293b" />
      <circle cx="61" cy="48" r="3.5" fill="#1e293b" />
      <circle cx="50" cy="58" r="2.5" fill="#f43f5e" />
    </g>
  );
}

// 16. Hamster
function CharacterHamster({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="32" cy="30" r="7" fill="#f59e0b" />
      <circle cx="68" cy="30" r="7" fill="#f59e0b" />
      <circle cx="50" cy="54" r="23" fill="#d97706" />
      <ellipse cx="36" cy="58" rx="8" ry="6" fill="#fca5a5" />
      <ellipse cx="64" cy="58" rx="8" ry="6" fill="#fca5a5" />
      <ellipse cx="50" cy="52" rx="4" ry="2.5" fill="#1e293b" />
      <circle cx="38" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="38" cy="44" r="2.2" fill="#000000" />
      <circle cx="62" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="62" cy="44" r="2.2" fill="#000000" />
    </g>
  );
}

// 17. Mouse (round big ears)
function CharacterMouse({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="24" cy="34" r="14" fill="#94a3b8" />
      <circle cx="24" cy="34" r="8" fill="#fda4af" />
      <circle cx="76" cy="34" r="14" fill="#94a3b8" />
      <circle cx="76" cy="34" r="8" fill="#fda4af" />
      <ellipse cx="50" cy="54" rx="20" ry="18" fill="#94a3b8" />
      <ellipse cx="50" cy="57" rx="3.5" ry="2.5" fill="#fda4af" />
      <circle cx="40" cy="46" r="3.5" fill="#1e293b" />
      <circle cx="60" cy="46" r="3.5" fill="#1e293b" />
    </g>
  );
}

// 18. Cat
function CharacterCat({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <polygon points="25,14 36,34 16,32" fill="#f97316" />
      <polygon points="75,14 64,34 84,32" fill="#f97316" />
      <circle cx="50" cy="38" r="22" fill="#f97316" />
      <path d="M32 36 Q38 40 44 36" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      <path d="M56 36 Q62 40 68 36" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      <polygon points="50,42 46,39 54,39" fill="#e11d48" />
    </g>
  );
}

// 19. Dog
function CharacterDog({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <path d="M20 34 C16 48 22 66 25 66 C28 66 30 48 30 34 Z" fill="#78350f" />
      <path d="M80 34 C84 48 78 66 75 66 C72 66 70 48 70 34 Z" fill="#78350f" />
      <ellipse cx="50" cy="54" rx="22" ry="20" fill="#d97706" />
      <circle cx="50" cy="52" r="3.5" fill="#1e293b" />
      <circle cx="39" cy="42" r="5.5" fill="#ffffff" />
      <circle cx="39" cy="42" r="2" fill="#000000" />
      <circle cx="61" cy="42" r="5.5" fill="#ffffff" />
      <circle cx="61" cy="42" r="2" fill="#000000" />
    </g>
  );
}

// 20. Donkey
function CharacterDonkey({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <path d="M22 28 C10 0 25 15 32 44 Z" fill="#6b7280" />
      <path d="M78 28 C90 0 75 15 68 44 Z" fill="#6b7280" />
      <ellipse cx="50" cy="54" rx="20" ry="24" fill="#6b7280" />
      <circle cx="39" cy="45" r="8" fill="#ffffff" />
      <circle cx="39" cy="46" r="3.5" fill="#000000" />
      <circle cx="61" cy="45" r="8" fill="#ffffff" />
      <circle cx="62" cy="44" r="3.5" fill="#000000" />
      <ellipse cx="50" cy="70" rx="15" ry="12" fill="#e2e8f0" />
    </g>
  );
}

// 21. Horse
function CharacterHorse({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="52" rx="18" ry="25" fill="#8a5729" />
      <path d="M38 18 L32 2 L42 12 Z" fill="#8a5729" />
      <path d="M62 18 L68 2 L58 12 Z" fill="#8a5729" />
      {/* Mane */}
      <path d="M50 18 Q50 6 52 0 Z" fill="#1e293b" />
      <ellipse cx="50" cy="66" rx="11" ry="10" fill="#fca5a5" opacity="0.8" />
      <circle cx="40" cy="42" r="4.5" fill="#ffffff" />
      <circle cx="40" cy="42" r="2" fill="#000000" />
      <circle cx="60" cy="42" r="4.5" fill="#ffffff" />
      <circle cx="60" cy="42" r="2" fill="#000000" />
    </g>
  );
}

// 22. Zebra
function CharacterZebra({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="52" rx="18" ry="24" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />
      <path d="M38 18 L32 2 L42 12 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M62 18 L68 2 L58 12 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
      {/* Stripes */}
      <line x1="32" y1="36" x2="42" y2="36" stroke="#000000" strokeWidth="3" />
      <line x1="68" y1="36" x2="58" y2="36" stroke="#000000" strokeWidth="3" />
      <line x1="50" y1="28" x2="50" y2="38" stroke="#000000" strokeWidth="3.5" />
      <circle cx="41" cy="42" r="4.5" fill="#000000" />
      <circle cx="59" cy="42" r="4.5" fill="#000000" />
    </g>
  );
}

// 23. Deer
function CharacterDeer({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="52" rx="20" ry="18" fill="#d97706" />
      <ellipse cx="50" cy="58" rx="8" ry="5" fill="#ffedd5" />
      <circle cx="50" cy="56" r="2.5" fill="#1e293b" />
      <circle cx="39" cy="44" r="5" fill="#ffffff" />
      <circle cx="39" cy="44" r="2.2" fill="#000000" />
      <circle cx="61" cy="44" r="5" fill="#ffffff" />
      <circle cx="61" cy="44" r="2.2" fill="#000000" />
    </g>
  );
}

// 24. Moose (antlers)
function CharacterMoose({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      {/* Massive antlers (y=12) */}
      <path d="M30 24 C10 10 18 2 28 14 Z" fill="#ca8a04" />
      <path d="M70 24 C90 10 82 2 72 14 Z" fill="#ca8a04" />
      <ellipse cx="50" cy="54" rx="20" ry="21" fill="#78350f" />
      <circle cx="39" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="39" cy="44" r="2" fill="#000000" />
      <circle cx="61" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="61" cy="44" r="2" fill="#000000" />
    </g>
  );
}

// 25. Goat (horns)
function CharacterGoat({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <path d="M36 28 Q24 10 24 2 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" />
      <path d="M64 28 Q76 10 76 2 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" />
      <ellipse cx="50" cy="54" rx="19" ry="21" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      {/* Chin beard */}
      <polygon points="46,74 54,74 50,86" fill="#f1f5f9" />
      <circle cx="39" cy="45" r="4.5" fill="#1e293b" />
      <circle cx="61" cy="45" r="4.5" fill="#1e293b" />
    </g>
  );
}

// 26. Sheep (wool cloud)
function CharacterSheep({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="34" cy="44" r="12" fill="#f8fafc" />
      <circle cx="66" cy="44" r="12" fill="#f8fafc" />
      <circle cx="50" cy="36" r="14" fill="#f8fafc" />
      <circle cx="50" cy="62" r="14" fill="#f8fafc" />
      <ellipse cx="50" cy="52" rx="16" ry="14" fill="#fed7aa" />
      <circle cx="44" cy="48" r="3" fill="#1e293b" />
      <circle cx="56" cy="48" r="3" fill="#1e293b" />
    </g>
  );
}

// 27. Cow (spots)
function CharacterCow({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="52" rx="23" ry="20" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />
      <ellipse cx="38" cy="44" rx="8" ry="6" fill="#0f172a" /> {/* Spot */}
      <circle cx="62" cy="48" r="4" fill="#0f172a" />
      <ellipse cx="50" cy="62" rx="11" ry="8" fill="#fda4af" />
      <circle cx="44" cy="62" r="1.5" fill="#475569" />
      <circle cx="56" cy="62" r="1.5" fill="#475569" />
      <circle cx="38" cy="40" r="4.5" fill="#ffffff" />
      <circle cx="38" cy="40" r="1.5" fill="#000000" />
      <circle cx="62" cy="40" r="4.5" fill="#ffffff" />
      <circle cx="62" cy="40" r="1.5" fill="#000000" />
    </g>
  );
}

// 28. Buffalo (curled horns)
function CharacterBuffalo({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <path d="M30 36 C10 32 12 10 26 18 Z" fill="#1e293b" />
      <path d="M70 36 C90 32 88 10 74 18 Z" fill="#1e293b" />
      <ellipse cx="50" cy="54" rx="23" ry="21" fill="#475569" />
      <circle cx="39" cy="46" r="4.5" fill="#ffffff" />
      <circle cx="39" cy="46" r="2.2" fill="#000000" />
      <circle cx="61" cy="46" r="4.5" fill="#ffffff" />
      <circle cx="61" cy="46" r="2.2" fill="#000000" />
    </g>
  );
}

// 29. Elephant
function CharacterElephant({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="24" cy="48" rx="15" ry="20" fill="#94a3b8" />
      <ellipse cx="76" cy="48" rx="15" ry="20" fill="#94a3b8" />
      <circle cx="50" cy="54" r="23" fill="#94a3b8" />
      <path d="M50 54 Q50 84 40 82" fill="none" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />
      <circle cx="41" cy="45" r="3.5" fill="#ffffff" />
      <circle cx="41" cy="45" r="1.5" fill="#000000" />
      <circle cx="59" cy="45" r="3.5" fill="#ffffff" />
      <circle cx="59" cy="45" r="1.5" fill="#000000" />
    </g>
  );
}

// 30. Giraffe
function CharacterGiraffe({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="34" cy="22" r="3" fill="#ca8a04" /><line x1="42" y1="34" x2="34" y2="22" stroke="#ca8a04" strokeWidth="2.5" />
      <circle cx="66" cy="22" r="3" fill="#ca8a04" /><line x1="58" y1="34" x2="66" y2="22" stroke="#ca8a04" strokeWidth="2.5" />
      <ellipse cx="50" cy="48" rx="18" ry="22" fill="#eab308" />
      <circle cx="38" cy="40" r="3.2" fill="#78350f" />
      <circle cx="44" cy="54" r="3" fill="#78350f" />
      <ellipse cx="50" cy="58" rx="9" ry="6" fill="#fef08a" />
      <circle cx="41" cy="42" r="4.2" fill="#ffffff" />
      <circle cx="41" cy="42" r="2" fill="#000000" />
      <circle cx="59" cy="42" r="4.2" fill="#ffffff" />
      <circle cx="59" cy="42" r="2" fill="#000000" />
    </g>
  );
}

// 31. Rhinoceros (nose horn)
function CharacterRhinoceros({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="54" rx="23" ry="20" fill="#64748b" />
      {/* White sharp horn */}
      <polygon points="50,46 44,24 56,42" fill="#f8fafc" />
      <circle cx="38" cy="48" r="4" fill="#ffffff" />
      <circle cx="38" cy="48" r="1.5" fill="#000000" />
      <circle cx="62" cy="48" r="4" fill="#ffffff" />
      <circle cx="62" cy="48" r="1.5" fill="#000000" />
    </g>
  );
}

// 32. Hippopotamus (grey thick snout)
function CharacterHippopotamus({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="50" cy="52" r="23" fill="#94a3b8" />
      <ellipse cx="50" cy="62" rx="15" ry="11" fill="#475569" />
      {/* Teeth */}
      <rect x="42" y="66" width="3.5" height="5" fill="#ffffff" />
      <rect x="54.5" y="66" width="3.5" height="5" fill="#ffffff" />
      <circle cx="39" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="39" cy="44" r="1.5" fill="#000000" />
      <circle cx="61" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="61" cy="44" r="1.5" fill="#000000" />
    </g>
  );
}

// 33. Monkey
function CharacterMonkey({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="20" cy="44" r="11" fill="#fed7aa" stroke="#7c2d12" strokeWidth="4.5" />
      <circle cx="80" cy="44" r="11" fill="#fed7aa" stroke="#7c2d12" strokeWidth="4.5" />
      <circle cx="50" cy="44" r="24" fill="#7c2d12" />
      <path d="M32 50 C32 32 68 32 68 50 C68 64 32 64 32 50 Z" fill="#fed7aa" />
      <circle cx="41" cy="42" r="5.5" fill="#ffffff" />
      <circle cx="41" cy="42" r="2.2" fill="#000000" />
      <circle cx="59" cy="42" r="5.5" fill="#ffffff" />
      <circle cx="59" cy="42" r="2.2" fill="#000000" />
    </g>
  );
}

// 34. Gorilla (Heavy brow)
function CharacterGorilla({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="50" rx="25" ry="24" fill="#0f172a" />
      {/* Heavy brow plate */}
      <rect x="30" y="32" width="40" height="10" rx="4.5" fill="#334155" />
      <circle cx="40" cy="44" r="4" fill="#ffffff" />
      <circle cx="40" cy="44" r="2" fill="#000000" />
      <circle cx="60" cy="44" r="4" fill="#ffffff" />
      <circle cx="60" cy="44" r="2" fill="#000000" />
    </g>
  );
}

// 35. Chimpanzee
function CharacterChimpanzee({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="22" cy="44" r="10" fill="#451a03" />
      <circle cx="78" cy="44" r="10" fill="#451a03" />
      <circle cx="50" cy="48" r="23" fill="#451a03" />
      <ellipse cx="50" cy="56" rx="15" ry="12" fill="#fed7aa" />
      <circle cx="42" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="42" cy="44" r="1.5" fill="#000000" />
      <circle cx="58" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="58" cy="44" r="1.5" fill="#000000" />
    </g>
  );
}

// 36. Sloth (hugging blue pillow)
function CharacterSloth({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="48" rx="22" ry="18" fill="#a16207" />
      <ellipse cx="38" cy="48" rx="8" ry="6" fill="#78350f" />
      <ellipse cx="62" cy="48" rx="8" ry="6" fill="#78350f" />
      <path d="M34 47 Q38 51 42 47" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M58 47 Q62 51 66 47" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="25" y="68" width="50" height="18" rx="5" fill="#60a5fa" stroke="#3b82f6" strokeWidth="2" />
    </g>
  );
}

// 37. Koala
function CharacterKoala({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="25" cy="38" r="11" fill="#94a3b8" />
      <circle cx="75" cy="38" r="11" fill="#94a3b8" />
      <ellipse cx="50" cy="52" rx="21" ry="19" fill="#94a3b8" />
      <ellipse cx="50" cy="50" rx="5" ry="8" fill="#1e293b" />
      <circle cx="41" cy="44" r="3.2" fill="#ffffff" />
      <circle cx="41" cy="44" r="1.5" fill="#000000" />
      <circle cx="59" cy="44" r="3.2" fill="#ffffff" />
      <circle cx="59" cy="44" r="1.5" fill="#000000" />
    </g>
  );
}

// 38. Kangaroo
function CharacterKangaroo({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <path d="M34 34 L28 4 L40 24 Z" fill="#d97706" />
      <path d="M66 34 L72 4 L60 24 Z" fill="#d97706" />
      <ellipse cx="50" cy="52" rx="19" ry="22" fill="#d97706" />
      {/* Pouch / baby head */}
      <ellipse cx="50" cy="66" rx="9" ry="6" fill="#78350f" />
      <circle cx="39" cy="42" r="4.2" fill="#ffffff" />
      <circle cx="39" cy="42" r="1.5" fill="#000000" />
      <circle cx="59" cy="42" r="4.2" fill="#ffffff" />
      <circle cx="59" cy="42" r="1.5" fill="#000000" />
    </g>
  );
}

// 39. Penguin
function CharacterPenguin({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="52" rx="25" ry="26" fill="#0f172a" />
      <ellipse cx="50" cy="58" rx="17" ry="19" fill="#ffffff" />
      <circle cx="40" cy="45" r="5.5" fill="#000000" />
      <circle cx="40" cy="45" r="2.2" fill="#ffffff" />
      <circle cx="60" cy="45" r="5.5" fill="#000000" />
      <circle cx="60" cy="45" r="2.2" fill="#ffffff" />
      <polygon points="50,58 44,51 56,51" fill="#f97316" />
    </g>
  );
}

// 40. Owl
function CharacterOwl({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="54" rx="27" ry="23" fill="#78350f" stroke="#451a03" strokeWidth="2.5" />
      <circle cx="37" cy="48" r="12" fill="#fde047" />
      <circle cx="37" cy="48" r="4.8" fill="#000000" />
      <circle cx="63" cy="48" r="12" fill="#fde047" />
      <circle cx="63" cy="48" r="4.8" fill="#000000" />
      <polygon points="50,56 45,49 55,49" fill="#f97316" />
    </g>
  );
}

// 41. Eagle
function CharacterEagle({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="50" cy="52" r="24" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      <polygon points="50,56 42,46 58,46" fill="#fbbf24" />
      <circle cx="38" cy="42" r="5" fill="#ffffff" />
      <circle cx="38" cy="42" r="2.2" fill="#000000" />
      <circle cx="62" cy="42" r="5" fill="#ffffff" />
      <circle cx="62" cy="42" r="2.2" fill="#000000" />
    </g>
  );
}

// 42. Falcon (Sharp brow lines)
function CharacterFalcon({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="50" cy="52" r="23" fill="#475569" />
      {/* Yellow intense brow */}
      <path d="M30 36 Q50 30 70 36" stroke="#fbbf24" strokeWidth="3.5" fill="none" />
      <polygon points="50,58 44,48 56,48" fill="#fbbf24" />
      <circle cx="38" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="38" cy="44" r="2" fill="#000000" />
      <circle cx="62" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="62" cy="44" r="2" fill="#000000" />
    </g>
  );
}

// 43. Parrot (bright colors)
function CharacterParrot({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="50" cy="52" r="24" fill="#ef4444" />
      {/* Yellow/blue feathers side */}
      <ellipse cx="26" cy="52" rx="6" ry="12" fill="#eab308" />
      <ellipse cx="74" cy="52" rx="6" ry="12" fill="#3b82f6" />
      <polygon points="50,57 44,48 56,48" fill="#fbbf24" />
      <circle cx="39" cy="42" r="5" fill="#ffffff" />
      <circle cx="39" cy="42" r="2" fill="#000000" />
      <circle cx="61" cy="42" r="5" fill="#ffffff" />
      <circle cx="61" cy="42" r="2" fill="#000000" />
    </g>
  );
}

// 44. Chicken
function CharacterChicken({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="50" cy="54" r="26" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />
      <path d="M42 30 C42 16 58 16 58 30 Z" fill="#ef4444" />
      <polygon points="50,59 44,52 56,52" fill="#f97316" />
      <circle cx="38" cy="46" r="4.5" fill="#000000" />
      <circle cx="62" cy="46" r="4.5" fill="#000000" />
    </g>
  );
}

// 45. Duck (Mallard green/white, orange bill)
function CharacterDuck({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="50" cy="52" r="24" fill="#15803d" />
      {/* White collar ring */}
      <rect x="36" y="68" width="28" height="6" fill="#ffffff" rx="2" />
      {/* Flat bill */}
      <ellipse cx="50" cy="54" rx="10" ry="5.5" fill="#f97316" />
      <circle cx="39" cy="42" r="4" fill="#ffffff" />
      <circle cx="39" cy="42" r="1.5" fill="#000000" />
      <circle cx="61" cy="42" r="4" fill="#ffffff" />
      <circle cx="61" cy="42" r="1.5" fill="#000000" />
    </g>
  );
}

// 46. Frog
function CharacterFrog({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="56" rx="28" ry="22" fill="#22c55e" />
      <circle cx="36" cy="34" r="10" fill="#ffffff" stroke="#15803d" strokeWidth="4" />
      <circle cx="36" cy="34" r="4.5" fill="#000000" />
      <circle cx="64" cy="34" r="10" fill="#ffffff" stroke="#15803d" strokeWidth="4" />
      <circle cx="64" cy="34" r="4.5" fill="#000000" />
      <path d="M28 58 Q50 78 72 58" fill="none" stroke="#14532d" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

// 47. Turtle
function CharacterTurtle({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <circle cx="50" cy="52" r="23" fill="#22c55e" stroke="#16a34a" strokeWidth="2" />
      <circle cx="37" cy="46" r="7" fill="#ffffff" />
      <circle cx="37" cy="46" r="3" fill="#000000" />
      <circle cx="63" cy="46" r="7" fill="#ffffff" />
      <circle cx="63" cy="46" r="3" fill="#000000" />
      <path d="M42 59 Q50 65 58 59" fill="none" stroke="#14532d" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

// 48. Shark
function CharacterShark({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <polygon points="50,12 42,34 58,34" fill="#475569" />
      <ellipse cx="50" cy="54" rx="24" ry="24" fill="#475569" />
      <ellipse cx="50" cy="62" rx="16" ry="12" fill="#f8fafc" />
      <path d="M36 60 Q50 52 64 60 Z" fill="#ef4444" />
      <polygon points="44,57 46,62 48,57" fill="#ffffff" />
      <polygon points="52,57 54,62 56,57" fill="#ffffff" />
      <circle cx="39" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="39" cy="44" r="2" fill="#000000" />
      <circle cx="61" cy="44" r="4.5" fill="#ffffff" />
      <circle cx="61" cy="44" r="2" fill="#000000" />
    </g>
  );
}

// 49. Dolphin (Curved snout, blowhole)
function CharacterDolphin({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="54" rx="24" ry="21" fill="#38bdf8" />
      {/* Dolphin snout beak */}
      <path d="M50 54 Q68 56 76 66 L58 72 Z" fill="#38bdf8" />
      <circle cx="48" cy="28" r="1.5" fill="#0284c7" /> {/* Blowhole */}
      <circle cx="41" cy="44" r="4.2" fill="#ffffff" />
      <circle cx="41" cy="44" r="1.8" fill="#000000" />
    </g>
  );
}

// 50. Octopus
function CharacterOctopus({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-char-shadow)`}>
      <ellipse cx="50" cy="46" rx="23" ry="21" fill="#a855f7" />
      <circle cx="34" cy="74" r="5.5" fill="#a855f7" />
      <circle cx="50" cy="77" r="5.5" fill="#a855f7" />
      <circle cx="66" cy="74" r="5.5" fill="#a855f7" />
      <circle cx="39" cy="42" r="6" fill="#ffffff" />
      <circle cx="39" cy="42" r="2.5" fill="#000000" />
      <circle cx="61" cy="42" r="6" fill="#ffffff" />
      <circle cx="61" cy="42" r="2.5" fill="#000000" />
    </g>
  );
}

// Master router matching all 46 database slugs to a unique animal mascot out of the 50
function renderMascotForSlug(slug: string, id: string) {
  const norm = slug.toLowerCase();

  // CREATOR CATEGORY
  if (norm === 'first-problem') return <CharacterLion id={id} />;          // 1
  if (norm === 'problem-pioneer') return <CharacterTiger id={id} />;        // 2
  if (norm === 'problem-architect') return <CharacterFox id={id} />;        // 3
  if (norm === 'problem-scholar') return <CharacterWolf id={id} />;        // 4
  if (norm === 'problem-master') return <CharacterBear id={id} />;          // 5
  if (norm === 'problem-legend') return <CharacterPanda id={id} />;        // 6
  if (norm === 'problem-deity') return <CharacterRedPanda id={id} />;      // 7

  // COMMUNITY CATEGORY
  if (norm === 'first-comment') return <CharacterRabbit id={id} />;        // 8
  if (norm === 'active-commenter') return <CharacterHare id={id} />;      // 9
  if (norm === 'helpful-member') return <CharacterSquirrel id={id} />;      // 10
  if (norm === 'conversation-starter') return <CharacterBeaver id={id} />;  // 11
  if (norm === 'community-voice') return <CharacterOtter id={id} />;        // 12
  if (norm === 'community-hero') return <CharacterRaccoon id={id} />;      // 13

  // POPULARITY CATEGORY
  if (norm === 'first-100-upvotes' || norm === 'rising-star') return <CharacterBadger id={id} />; // 14
  if (norm === 'thousand-upvotes' || norm === 'fan-favorite') return <CharacterHedgehog id={id} />; // 15
  if (norm === 'views-10k') return <CharacterHamster id={id} />;          // 16
  if (norm === 'views-100k') return <CharacterMouse id={id} />;            // 17
  if (norm === 'trending-creator') return <CharacterCat id={id} />;        // 18
  if (norm === 'viral-problem') return <CharacterDog id={id} />;            // 19

  // CONSISTENCY CATEGORY
  if (norm === 'streak-3') return <CharacterDonkey id={id} />;            // 20
  if (norm === 'streak-7') return <CharacterHorse id={id} />;              // 21
  if (norm === 'streak-30') return <CharacterZebra id={id} />;            // 22
  if (norm === 'streak-100' || norm === 'centurion') return <CharacterDeer id={id} />; // 23
  if (norm === 'streak-365') return <CharacterMoose id={id} />;            // 24

  // FOUNDER CATEGORY
  if (norm === 'startup-founder') return <CharacterGoat id={id} />;        // 25
  if (norm === 'product-launch') return <CharacterSheep id={id} />;        // 26
  if (norm === 'first-customer') return <CharacterCow id={id} />;          // 27
  if (norm === 'revenue-milestone') return <CharacterBuffalo id={id} />;    // 28
  if (norm === 'founder-legend') return <CharacterElephant id={id} />;      // 29

  // KNOWLEDGE CATEGORY
  if (norm === 'business-thinker') return <CharacterGiraffe id={id} />;    // 30
  if (norm === 'marketing-expert') return <CharacterRhinoceros id={id} />;  // 31
  if (norm === 'ai-expert') return <CharacterHippopotamus id={id} />;      // 32
  if (norm === 'problem-solver') return <CharacterMonkey id={id} />;        // 33
  if (norm === 'innovator') return <CharacterGorilla id={id} />;          // 34

  // SPECIAL CATEGORY
  if (norm === 'early-adopter') return <CharacterChimpanzee id={id} />;    // 35
  if (norm === 'beta-member') return <CharacterSloth id={id} />;          // 36
  if (norm === 'verified-user') return <CharacterKoala id={id} />;          // 37
  if (norm === 'contributor') return <CharacterKangaroo id={id} />;        // 38
  if (norm === 'hall-of-fame') return <CharacterPenguin id={id} />;        // 39
  if (norm === 'moderator') return <CharacterOwl id={id} />;              // 40
  if (norm === 'ambassador') return <CharacterEagle id={id} />;            // 41

  // HIDDEN CATEGORY
  if (norm === 'night-owl') return <CharacterFalcon id={id} />;            // 42
  if (norm === 'early-bird') return <CharacterParrot id={id} />;          // 43
  if (norm === 'lucky-creator') return <CharacterChicken id={id} />;        // 44
  if (norm === 'silent-observer') return <CharacterDuck id={id} />;        // 45
  if (norm === 'trend-starter') return <CharacterFrog id={id} />;          // 46
  if (norm === 'master-explorer') return <CharacterTurtle id={id} />;      // 47

  // Fallbacks for extra slugs
  if (norm.includes('upvote')) return <CharacterShark id={id} />;          // 48
  if (norm.includes('view')) return <CharacterDolphin id={id} />;          // 49
  return <CharacterOctopus id={id} />;                                    // 50
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOCKED ENAMEL PIN COIN
   ═══════════════════════════════════════════════════════════════════════════ */
function LockedBadge({ shape }: { shape: string }) {
  return (
    <svg viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="locked-plate-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22242b" />
          <stop offset="100%" stopColor="#121318" />
        </radialGradient>
        <filter id="locked-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      <circle cx="50" cy="56" r="38" fill="rgba(0,0,0,0.3)" filter="url(#locked-shadow)" />
      <circle cx="50" cy="56" r="38" fill="#1b1c22" stroke="#25272f" strokeWidth="2.5" />
      <circle cx="50" cy="56" r="32" fill="url(#locked-plate-grad)" />

      <g transform="translate(38, 44)" opacity="0.4">
        <rect x="0" y="10" width="24" height="18" rx="3" fill="#cbd5e1" />
        <path d="M4 10 Q4 0 12 0 Q20 0 20 10" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
        <circle cx="12" cy="19" r="3" fill="#0f172a" />
      </g>
    </svg>
  );
}

let _badgeIdCounter = 0;

export default function BadgeArtwork({
  slug,
  rarity,
  category,
  size = 48,
  locked = false,
  animated = true,
  transparentBackground = false,
}: BadgeArtworkProps) {
  const id = React.useMemo(() => `badge-${slug}-${++_badgeIdCounter}`, [slug]);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [sheenPos, setSheenPos] = useState({ x: 50, y: 56 });

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  };

  if (locked) {
    return (
      <div style={containerStyle} className="badge-artwork-wrapper badge-locked">
        <LockedBadge shape="coin" />
      </div>
    );
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!animated) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const svgX = (x / rect.width) * 100;
    const svgY = (y / rect.height) * 110;

    const xc = rect.width / 2;
    const yc = rect.height / 2;
    const rotateY = ((x - xc) / xc) * 22; // max 22deg rotation
    const rotateX = -((y - yc) / yc) * 22;

    setTilt({ x: rotateX, y: rotateY });
    setSheenPos({ x: svgX, y: svgY });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setSheenPos({ x: 50, y: 56 });
    setIsHovered(false);
  };

  return (
    <div
      style={{
        ...containerStyle,
        perspective: '800px',
      }}
      className={`badge-artwork-wrapper badge-rarity-${rarity}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        viewBox="0 0 100 110"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          transform: animated ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.08 : 1})` : 'none',
          transition: isHovered ? 'transform 0.05s ease-out' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transformStyle: 'preserve-3d',
        }}
      >
        <EnamelDiscDefs rarity={rarity} id={id} />
        
        {/* Dynamic Sheen Gradient for this instance */}
        <defs>
          <radialGradient id={`${id}-sheen-grad`} cx={`${sheenPos.x}%`} cy={`${sheenPos.y}%`} r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Render base coin disc background */}
        {!transparentBackground && <BaseEnamelDisc rarity={rarity} id={id} />}

        {/* Render character mascot in its own 3D floating group */}
        <g style={{
          transform: animated && isHovered ? 'translateZ(16px)' : 'translateZ(0px)',
          transition: 'transform 0.25s ease',
        }}>
          {renderMascotForSlug(slug, id)}
        </g>

        {/* Render sparkles */}
        {!transparentBackground && <Sparkles rarity={rarity} />}

        {/* Glass sheen cover & Dynamic Glint */}
        {!transparentBackground && <GlassSheen id={id} sheenPos={sheenPos} isHovered={isHovered} />}
      </svg>
    </div>
  );
}

'use client';

import React from 'react';
import BadgeArtwork from './BadgeArtwork';
import type { BadgeRarity, BadgeCategory } from '@/lib/badgeDefinitions';

interface BadgeCardProps {
  slug: string;
  name: string;
  description: string;
  hint_text: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  rep_reward: number;
  is_hidden?: boolean;
  earned?: boolean;
  earned_at?: string | null;
  onClick?: () => void;
  progressCurrent?: number;
  progressTarget?: number;
  progressUnit?: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

export default function BadgeCard({
  slug,
  name,
  description,
  hint_text,
  category,
  rarity,
  rep_reward,
  is_hidden = false,
  earned = false,
  earned_at,
  onClick,
  progressCurrent,
  progressTarget,
  progressUnit = '',
}: BadgeCardProps) {
  const isHiddenLocked = is_hidden && !earned;
  const displayName = isHiddenLocked ? '???' : name;

  const hasProgress = progressCurrent !== undefined && progressTarget !== undefined && progressTarget > 0;
  const progressPct = hasProgress ? Math.min(100, Math.round((progressCurrent / progressTarget) * 100)) : 0;

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`clean-badge-card ${earned ? 'clean-badge-card-earned' : 'clean-badge-card-locked'} ${isHiddenLocked ? 'clean-badge-card-hidden-locked' : ''}`}
      onClick={handleCardClick}
      title={isHiddenLocked ? 'Hidden Achievement' : description}
    >
      {/* Badge Artwork Container */}
      <div className="clean-badge-artwork-container">
        <BadgeArtwork
          slug={slug}
          rarity={rarity}
          category={category}
          size={120}
          locked={!earned}
          animated={true}
        />
      </div>

      {/* Badge Title */}
      <span className="clean-badge-name" title={displayName}>
        {displayName}
      </span>

      {/* Unlock Date / Progress Subtitle */}
      {earned && earned_at ? (
        <span className="clean-badge-date">
          {formatDate(earned_at)}
        </span>
      ) : isHiddenLocked ? (
        <span className="clean-badge-date" style={{ opacity: 0.5, marginTop: '0.5rem' }}>
          Locked
        </span>
      ) : hasProgress ? (
        <div className="clean-badge-progress-container">
          <div className="clean-badge-progress-bar">
            <div
              className="clean-badge-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="clean-badge-progress-text">
            {progressCurrent} / {progressTarget} {progressUnit}
          </span>
          <span className="clean-badge-hint">
            {hint_text}
          </span>
        </div>
      ) : (
        <div className="clean-badge-progress-container">
          <span className="clean-badge-date" style={{ opacity: 0.6 }}>
            Locked
          </span>
          <span className="clean-badge-hint">
            {hint_text}
          </span>
        </div>
      )}
    </div>
  );
}

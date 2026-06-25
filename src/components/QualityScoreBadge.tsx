'use client';

import React, { useEffect, useRef, useState } from 'react';

interface QualityScoreBadgeProps {
  qualityScore?: number | null;
  uniqueViewers?: number | null;
  /** Small animation pulse when score updates live */
  animate?: boolean;
}

/**
 * QualityScoreBadge
 *
 * Displays an AI-calculated community quality score inline next to the post type badge.
 *
 * - < 20 unique viewers → 🆕 New  (provisional, not enough data)
 * - 20–99 viewers      → ⭐ 8.7   (provisional score)
 * - 100+ viewers       → ⭐ 8.7   (official score)
 *
 * Hovering shows: "Community Quality Score — calculated automatically from real user engagement."
 */
export default function QualityScoreBadge({
  qualityScore,
  uniqueViewers,
  animate = false,
}: QualityScoreBadgeProps) {
  const [flash, setFlash] = useState(false);
  const prevScore = useRef(qualityScore);

  // Flash animation when score changes
  useEffect(() => {
    if (animate && prevScore.current !== qualityScore && qualityScore != null) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevScore.current = qualityScore;
      return () => clearTimeout(t);
    }
  }, [qualityScore, animate]);

  const viewers = uniqueViewers ?? 0;
  const isNew = viewers < 20;
  const isProvisional = viewers >= 20 && viewers < 100;

  const tooltipText = isNew
    ? 'Not enough data yet — needs 20+ viewers to get a score.'
    : isProvisional
      ? `Community Quality Score (provisional) — based on ${viewers} viewers. Needs 100+ for official score.`
      : `Community Quality Score — calculated automatically from real user engagement (${viewers} viewers).`;

  return (
    <span
      className={`quality-score-badge${isNew ? ' quality-score-badge--new' : ''}${flash ? ' quality-score-badge--flash' : ''}`}
      title={tooltipText}
      aria-label={isNew ? 'New post — no quality score yet' : `Quality score: ${qualityScore?.toFixed(1)}`}
    >
      {isNew ? (
        <span className="quality-score-badge__new">New</span>
      ) : (
        <>
          <span className="quality-score-badge__star" aria-hidden="true">⭐</span>
          <span className="quality-score-badge__value">
            {qualityScore != null ? qualityScore.toFixed(1) : '—'}
          </span>
          {isProvisional && (
            <span className="quality-score-badge__provisional" aria-hidden="true" title="Provisional score">~</span>
          )}
        </>
      )}
    </span>
  );
}

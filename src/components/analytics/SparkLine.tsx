'use client';

import React, { useEffect, useState } from 'react';

interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export default function SparkLine({
  data,
  width = 80,
  height = 28,
  color = 'var(--accent-blue)',
  className = '',
}: SparkLineProps) {
  if (!data.length) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg width={width} height={height} className={`analytics-sparkline ${className}`} aria-hidden>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="analytics-sparkline-line"
      />
    </svg>
  );
}

export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    let frame: number;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

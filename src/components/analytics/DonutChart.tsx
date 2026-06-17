'use client';

import React, { useMemo, useState } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  title?: string;
}

const DEFAULT_COLORS = [
  'var(--accent-blue)',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
];

export default function DonutChart({
  data,
  size = 180,
  centerLabel,
  centerValue,
  title,
}: DonutChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.62;

  const segments = useMemo(() => {
    let angle = -Math.PI / 2;
    return data.map((d, i) => {
      const slice = (d.value / total) * Math.PI * 2;
      const start = angle;
      const end = angle + slice;
      angle = end;

      const x1o = cx + outerR * Math.cos(start);
      const y1o = cy + outerR * Math.sin(start);
      const x2o = cx + outerR * Math.cos(end);
      const y2o = cy + outerR * Math.sin(end);
      const x1i = cx + innerR * Math.cos(end);
      const y1i = cy + innerR * Math.sin(end);
      const x2i = cx + innerR * Math.cos(start);
      const y2i = cy + innerR * Math.sin(start);
      const large = slice > Math.PI ? 1 : 0;

      const path = [
        `M ${x1o} ${y1o}`,
        `A ${outerR} ${outerR} 0 ${large} 1 ${x2o} ${y2o}`,
        `L ${x1i} ${y1i}`,
        `A ${innerR} ${innerR} 0 ${large} 0 ${x2i} ${y2i}`,
        'Z',
      ].join(' ');

      return {
        ...d,
        path,
        color: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        percentage: Math.round((d.value / total) * 1000) / 10,
      };
    });
  }, [data, cx, cy, innerR, outerR, total]);

  return (
    <div className="analytics-donut-wrap">
      {title && <h3 className="analytics-chart-title">{title}</h3>}
      <div className="analytics-donut-layout">
        <svg width={size} height={size} className="analytics-donut-chart" role="img">
          {segments.map((seg, i) => (
            <path
              key={seg.label}
              d={seg.path}
              fill={seg.color}
              opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.45}
              className="analytics-donut-segment"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          ))}
          {(centerLabel || centerValue) && (
            <text x={cx} y={cy - 4} textAnchor="middle" className="analytics-donut-center-value">
              {centerValue ?? (hoverIndex !== null ? `${segments[hoverIndex].percentage}%` : `${Math.round(total)}`)}
            </text>
          )}
          {centerLabel && (
            <text x={cx} y={cy + 14} textAnchor="middle" className="analytics-donut-center-label">
              {hoverIndex !== null ? segments[hoverIndex].label : centerLabel}
            </text>
          )}
        </svg>
        <ul className="analytics-donut-legend">
          {segments.map((seg, i) => (
            <li
              key={seg.label}
              className={hoverIndex === i ? 'active' : ''}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <span className="analytics-legend-dot" style={{ background: seg.color }} />
              <span className="analytics-legend-label">{seg.label}</span>
              <span className="analytics-legend-value">{seg.percentage}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

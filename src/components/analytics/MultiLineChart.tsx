'use client';

import React, { useMemo, useState } from 'react';

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  data: { label: string; value: number }[];
}

interface MultiLineChartProps {
  series: LineSeries[];
  height?: number;
  title?: string;
}

export default function MultiLineChart({ series, height = 220, title }: MultiLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 600;
  const padding = { top: 20, right: 16, bottom: 36, left: 48 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const labels = series[0]?.data.map(d => d.label) ?? [];
  const maxVal = Math.max(...series.flatMap(s => s.data.map(d => d.value)), 1);

  const paths = useMemo(() => {
    return series.map(s => {
      const pts = s.data.map((d, i) => {
        const x = padding.left + (i / Math.max(s.data.length - 1, 1)) * innerW;
        const y = padding.top + innerH - (d.value / maxVal) * innerH;
        return { x, y };
      });
      const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return { ...s, path, pts };
    });
  }, [series, innerH, innerW, maxVal, padding.left, padding.top]);

  return (
    <div className="analytics-chart-wrap">
      {title && <h3 className="analytics-chart-title">{title}</h3>}
      <div className="analytics-line-legend">
        {series.map(s => (
          <span key={s.key} className="analytics-line-legend-item">
            <span className="analytics-legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="analytics-multiline-chart" role="img">
        {[0, 0.5, 1].map((t, i) => {
          const y = padding.top + innerH - t * innerH;
          return (
            <line
              key={i}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              className="analytics-grid-line"
            />
          );
        })}
        {paths.map(s => (
          <path key={s.key} d={s.path} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
        ))}
        {labels.map((label, i) => {
          const x = padding.left + (i / Math.max(labels.length - 1, 1)) * innerW;
          return (
            <g key={i}>
              <rect
                x={x - innerW / labels.length / 2}
                y={padding.top}
                width={innerW / labels.length}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
              {(i === 0 || i === labels.length - 1 || i % Math.ceil(labels.length / 6) === 0) && (
                <text x={x} y={height - 8} className="analytics-axis-label" textAnchor="middle">
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hoverIndex !== null && (
        <div className="analytics-chart-tooltip">
          <strong>{labels[hoverIndex]}</strong>
          {series.map(s => (
            <span key={s.key}>{s.label}: {s.data[hoverIndex]?.value.toLocaleString()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

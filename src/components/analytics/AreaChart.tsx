'use client';

import React, { useMemo, useState } from 'react';

export interface ChartPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: ChartPoint[];
  height?: number;
  color?: string;
  title?: string;
  valueFormatter?: (v: number) => string;
}

export default function AreaChart({
  data,
  height = 220,
  color = 'var(--accent-blue)',
  title,
  valueFormatter = (v) => v.toLocaleString(),
}: AreaChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 600;
  const padding = { top: 20, right: 16, bottom: 36, left: 48 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const { path, areaPath, points, maxVal } = useMemo(() => {
    if (!data.length) return { path: '', areaPath: '', points: [] as Array<ChartPoint & { x: number; y: number }>, maxVal: 1 };
    const max = Math.max(...data.map(d => d.value), 1);
    const pts: Array<ChartPoint & { x: number; y: number }> = data.map((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * innerW;
      const y = padding.top + innerH - (d.value / max) * innerH;
      return { x, y, ...d };
    });
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${line} L ${pts[pts.length - 1].x} ${padding.top + innerH} L ${pts[0].x} ${padding.top + innerH} Z`;
    return { path: line, areaPath: area, points: pts, maxVal: max };
  }, [data, innerH, innerW, padding.left, padding.top]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: padding.top + innerH - t * innerH,
    label: valueFormatter(Math.round(maxVal * t)),
  }));

  return (
    <div className="analytics-chart-wrap">
      {title && <h3 className="analytics-chart-title">{title}</h3>}
      <svg viewBox={`0 0 ${width} ${height}`} className="analytics-area-chart" role="img">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
              className="analytics-grid-line"
            />
            <text x={padding.left - 8} y={tick.y + 4} className="analytics-axis-label" textAnchor="end">
              {tick.label}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#areaGrad)" className="analytics-area-fill" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="analytics-area-line" />

        {points.map((p, i) => (
          <g key={i}>
            <rect
              x={p.x - innerW / data.length / 2}
              y={padding.top}
              width={innerW / data.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
            {hoverIndex === i && (
              <>
                <line x1={p.x} y1={padding.top} x2={p.x} y2={padding.top + innerH} className="analytics-hover-line" />
                <circle cx={p.x} cy={p.y} r="5" fill={color} stroke="var(--bg-card)" strokeWidth="2" />
              </>
            )}
            {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0) && (
              <text x={p.x} y={height - 8} className="analytics-axis-label" textAnchor="middle">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {hoverIndex !== null && data[hoverIndex] && (
        <div className="analytics-chart-tooltip">
          <strong>{data[hoverIndex].label}</strong>
          <span>{valueFormatter(data[hoverIndex].value)}</span>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface HeatmapChartProps {
  data: number[][];
  title?: string;
}

export default function HeatmapChart({ data, title }: HeatmapChartProps) {
  const [tooltip, setTooltip] = useState<{ day: string; hour: number; value: number } | null>(null);
  const flat = data.flat();
  const max = Math.max(...flat, 1);

  const colorFor = (v: number) => {
    const t = v / max;
    const r = Math.round(0 + t * 0);
    const g = Math.round(100 + t * 32);
    const b = Math.round(200 + t * 55);
    return `rgba(${r}, ${g}, ${b}, ${0.15 + t * 0.85})`;
  };

  return (
    <div className="analytics-heatmap-wrap">
      {title && <h3 className="analytics-chart-title">{title}</h3>}
      <div className="analytics-heatmap-grid">
        <div className="analytics-heatmap-hours">
          {Array.from({ length: 24 }, (_, h) => (
            h % 3 === 0 ? <span key={h}>{h}</span> : <span key={h} className="empty" />
          ))}
        </div>
        {data.map((row, dayIdx) => (
          <div key={dayIdx} className="analytics-heatmap-row">
            <span className="analytics-heatmap-day">{DAYS[dayIdx]}</span>
            <div className="analytics-heatmap-cells">
              {row.map((val, hour) => (
                <div
                  key={hour}
                  className="analytics-heatmap-cell"
                  style={{ background: colorFor(val) }}
                  onMouseEnter={() => setTooltip({ day: DAYS[dayIdx], hour, value: val })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {tooltip && (
        <div className="analytics-chart-tooltip analytics-heatmap-tooltip">
          {tooltip.day} {tooltip.hour}:00 — activity {tooltip.value}
        </div>
      )}
    </div>
  );
}

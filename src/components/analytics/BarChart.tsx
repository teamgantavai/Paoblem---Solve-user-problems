'use client';

import React from 'react';

export interface BarItem {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarItem[];
  horizontal?: boolean;
  title?: string;
  color?: string;
  maxBars?: number;
}

export default function BarChart({
  data,
  horizontal = true,
  title,
  color = 'var(--accent-blue)',
  maxBars = 8,
}: BarChartProps) {
  const items = data.slice(0, maxBars);
  const max = Math.max(...items.map(d => d.value), 1);

  if (horizontal) {
    return (
      <div className="analytics-bar-chart horizontal">
        {title && <h3 className="analytics-chart-title">{title}</h3>}
        <div className="analytics-bar-list">
          {items.map((item) => (
            <div key={item.label} className="analytics-bar-row">
              <span className="analytics-bar-label">{item.label}</span>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                    background: color,
                  }}
                />
              </div>
              <span className="analytics-bar-value">{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const barW = 100 / items.length;
  return (
    <div className="analytics-bar-chart vertical">
      {title && <h3 className="analytics-chart-title">{title}</h3>}
      <svg viewBox="0 0 400 200" className="analytics-bar-chart-svg" role="img">
        {items.map((item, i) => {
          const h = (item.value / max) * 160;
          const x = i * (400 / items.length) + 8;
          const w = 400 / items.length - 16;
          return (
            <g key={item.label}>
              <rect
                x={x}
                y={180 - h}
                width={w}
                height={h}
                rx="4"
                fill={color}
                className="analytics-bar-rect"
              />
              <text x={x + w / 2} y={195} className="analytics-axis-label" textAnchor="middle">
                {item.label.slice(0, 6)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

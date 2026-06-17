'use client';

import React from 'react';
import type { FunnelStage } from '@/lib/types';

interface FunnelChartProps {
  stages: FunnelStage[];
  title?: string;
}

export default function FunnelChart({ stages, title }: FunnelChartProps) {
  const max = stages[0]?.count || 1;

  return (
    <div className="analytics-funnel-wrap">
      {title && <h3 className="analytics-chart-title">{title}</h3>}
      <div className="analytics-funnel">
        {stages.map((stage, i) => {
          const widthPct = Math.max(20, (stage.count / max) * 100);
          return (
            <div key={stage.stage} className="analytics-funnel-stage">
              <div
                className="analytics-funnel-bar"
                style={{ width: `${widthPct}%` }}
              >
                <span className="analytics-funnel-label">{stage.stage}</span>
                <span className="analytics-funnel-count">{stage.count.toLocaleString()}</span>
              </div>
              {stage.conversionFromPrevious !== null && (
                <span className="analytics-funnel-conversion">
                  {stage.conversionFromPrevious}% from prev
                </span>
              )}
              {i < stages.length - 1 && <div className="analytics-funnel-connector" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

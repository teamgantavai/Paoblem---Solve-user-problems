'use client';

import React from 'react';
import SparkLine, { useCountUp } from './SparkLine';
import type { AnalyticsMetric } from '@/lib/types';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface MetricCardProps {
  label: string;
  metric: AnalyticsMetric;
  icon: React.ReactNode;
  format?: (v: number) => string;
  accent?: string;
}

export default function MetricCard({
  label,
  metric,
  icon,
  format = (v) => v.toLocaleString(),
  accent = 'var(--accent-blue)',
}: MetricCardProps) {
  const animated = useCountUp(metric.value);
  const isPositive = metric.delta >= 0;

  return (
    <div className="analytics-metric-card">
      <div className="analytics-metric-header">
        <span className="analytics-metric-icon" style={{ color: accent }}>{icon}</span>
        <span className="analytics-metric-label">{label}</span>
      </div>
      <div className="analytics-metric-body">
        <span className="analytics-metric-value">{format(animated)}</span>
        <SparkLine data={metric.sparkline} color={accent} />
      </div>
      <div className={`analytics-metric-delta ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        <span>{Math.abs(metric.delta)}%</span>
        <span className="analytics-metric-delta-label">vs prev</span>
      </div>
    </div>
  );
}

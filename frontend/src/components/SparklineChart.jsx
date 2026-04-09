import React from 'react';
import { getTierColor } from '../utils/tierUtils.js';

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SparklineChart({ history, width = 160, height = 44 }) {
  if (!history || history.length === 0) return null;

  const allNull = history.every((h) => h.score === null || h.score === undefined);
  const paddingLeft = 4;
  const paddingRight = 4;
  const paddingTop = 6;
  const paddingBottom = 16;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  if (allNull) {
    // Learning mode: dashed horizontal line
    const midY = paddingTop + chartHeight / 2;
    return (
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <line
          x1={paddingLeft}
          y1={midY}
          x2={paddingLeft + chartWidth}
          y2={midY}
          stroke="var(--text-muted)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={paddingLeft + chartWidth / 2}
          y={paddingTop + chartHeight / 2 - 8}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={9}
          fontFamily="Inter, sans-serif"
        >
          Calibrating...
        </text>
      </svg>
    );
  }

  const n = history.length;
  const stepX = chartWidth / (n - 1);

  // Map score (0-1) to Y (inverted: higher score = lower y position = top)
  function scoreToY(score) {
    if (score === null || score === undefined) return paddingTop + chartHeight;
    const clamped = Math.max(0, Math.min(1, score));
    return paddingTop + chartHeight - clamped * chartHeight;
  }

  const points = history.map((h, i) => ({
    x: paddingLeft + i * stepX,
    y: scoreToY(h.score),
    score: h.score,
    tier: h.tier,
    date: h.date,
    isNull: h.score === null || h.score === undefined,
  }));

  // Build polyline from non-null points
  const validPoints = points.filter((p) => !p.isNull);
  let polylinePath = '';
  if (validPoints.length > 1) {
    polylinePath = validPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
  }

  const latestTier = history.filter((h) => h.tier !== null).slice(-1)[0]?.tier ?? 0;
  const lineColor = getTierColor(latestTier);

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {/* Line */}
      {polylinePath && (
        <path
          d={polylinePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
      )}

      {/* Points */}
      {points.map((p, i) => {
        if (p.isNull) {
          return (
            <circle
              key={i}
              cx={p.x}
              cy={paddingTop + chartHeight * 0.85}
              r={2}
              fill="var(--text-muted)"
              opacity={0.4}
            />
          );
        }
        const color = getTierColor(p.tier);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={color}
            stroke="var(--bg)"
            strokeWidth={1}
          />
        );
      })}

      {/* X-axis date labels — show first and last */}
      {n > 0 && (
        <>
          <text
            x={points[0].x}
            y={height}
            textAnchor="start"
            fill="var(--text-muted)"
            fontSize={8}
            fontFamily="Inter, sans-serif"
          >
            {formatDateLabel(history[0].date)}
          </text>
          <text
            x={points[n - 1].x}
            y={height}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize={8}
            fontFamily="Inter, sans-serif"
          >
            {formatDateLabel(history[n - 1].date)}
          </text>
        </>
      )}
    </svg>
  );
}

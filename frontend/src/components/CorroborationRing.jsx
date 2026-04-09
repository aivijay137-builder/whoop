import React from 'react';
import { getTierColor } from '../utils/tierUtils.js';

export default function CorroborationRing({ score, tier, isLearning }) {
  const size = 110;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 44;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  const tierColor = isLearning ? 'var(--learning)' : getTierColor(tier);

  const clampedScore = Math.max(0, Math.min(1, score || 0));
  const progress = isLearning ? 0 : clampedScore;
  const dashOffset = circumference - progress * circumference;

  const scoreDisplay = isLearning
    ? '—'
    : Math.round((score || 0) * 100).toString();

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0 }}
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />

      {/* Progress arc */}
      {!isLearning && (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={tierColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      )}

      {/* Learning dashed arc */}
      {isLearning && (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={tierColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="6 6"
          opacity={0.4}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}

      {/* Center score */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text-primary)"
        fontSize={isLearning ? 16 : 20}
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        {scoreDisplay}
      </text>

      {/* Sub-label */}
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize={9}
        fontFamily="Inter, sans-serif"
      >
        {isLearning ? 'calibrating' : 'score'}
      </text>

      {/* Learning extra label */}
      {isLearning && (
        <text
          x={cx}
          y={cy + 26}
          textAnchor="middle"
          fill="var(--learning)"
          fontSize={7.5}
          fontFamily="Inter, sans-serif"
          fontWeight="500"
        >
          Building baseline
        </text>
      )}
    </svg>
  );
}

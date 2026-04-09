import React from 'react';
import { formatDelta } from '../utils/tierUtils.js';

const METRIC_CONFIG = {
  hrv: { label: 'HRV', unit: 'ms', worsensWhenLower: true },
  rhr: { label: 'RHR', unit: 'bpm', worsensWhenLower: false },
  rr: { label: 'Resp Rate', unit: 'br/m', worsensWhenLower: false },
  temp: { label: 'Skin Temp', unit: '°C', worsensWhenLower: false },
  spo2: { label: 'SpO₂', unit: '%', worsensWhenLower: true },
};

function QualityDot({ quality, isLearning }) {
  if (isLearning || quality === null || quality === undefined) {
    return (
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--text-muted)',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
    );
  }
  let color;
  if (quality >= 80) color = 'var(--tier-0)';
  else if (quality >= 60) color = 'var(--tier-1)';
  else color = 'var(--tier-3)';

  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );
}

export default function MetricCard({ name, value, baseline, zScore, quality, unit, metricKey, isLearning }) {
  const config = METRIC_CONFIG[metricKey] || { label: name, unit: unit || '', worsensWhenLower: false };
  const isLowQuality = !isLearning && quality !== null && quality !== undefined && quality < 70;

  const delta = (!isLearning && !isLowQuality && value !== null && baseline !== null)
    ? formatDelta(value, baseline, metricKey)
    : null;

  // Border glow based on z-score
  let borderStyle = '1px solid var(--border)';
  let boxShadow = 'none';
  if (!isLearning && zScore !== null && zScore !== undefined) {
    const absZ = Math.abs(zScore);
    if (absZ > 2.5) {
      borderStyle = '1px solid rgba(232,64,64,0.4)';
      boxShadow = '0 0 12px rgba(232,64,64,0.2)';
    } else if (absZ > 2.0) {
      borderStyle = '1px solid rgba(255,140,0,0.4)';
      boxShadow = '0 0 10px rgba(255,140,0,0.15)';
    }
  }

  const cardOpacity = isLowQuality ? 0.55 : 1;

  // Format displayed value
  let displayValue = '—';
  if (!isLearning && value !== null && value !== undefined) {
    if (metricKey === 'hrv') displayValue = Math.round(value).toString();
    else if (metricKey === 'rhr') displayValue = Math.round(value).toString();
    else if (metricKey === 'rr') displayValue = value.toFixed(1);
    else if (metricKey === 'temp') displayValue = value.toFixed(1);
    else if (metricKey === 'spo2') displayValue = value.toFixed(1);
    else displayValue = String(value);
  }

  // Delta color
  let deltaColor = 'var(--text-muted)';
  if (delta) {
    if (delta.direction === 'neutral') deltaColor = 'var(--text-muted)';
    else if (delta.isBad) deltaColor = 'var(--tier-2)';
    else deltaColor = 'var(--tier-0)';
  }

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        borderRadius: 14,
        padding: '14px 12px',
        width: 130,
        flexShrink: 0,
        border: borderStyle,
        boxShadow: boxShadow,
        opacity: cardOpacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Top row: label + quality dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {config.label}
        </span>
        <QualityDot quality={quality} isLearning={isLearning} />
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
          {displayValue}
        </span>
        {!isLearning && value !== null && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
            {config.unit}
          </span>
        )}
      </div>

      {/* Bottom: delta or low quality badge */}
      {isLowQuality ? (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--tier-1)',
            background: 'var(--tier-1-bg)',
            borderRadius: 6,
            padding: '2px 6px',
            alignSelf: 'flex-start',
            letterSpacing: '0.03em',
          }}
        >
          Low quality
        </span>
      ) : delta && delta.direction !== 'neutral' ? (
        <span style={{ fontSize: 11, color: deltaColor, fontWeight: 500 }}>
          {delta.displayText}
        </span>
      ) : (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ Baseline</span>
      )}
    </div>
  );
}

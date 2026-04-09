import React from 'react';

const TYPE_STYLES = {
  alcohol: {
    borderColor: '#9b59b6',
    bg: 'rgba(155,89,182,0.08)',
    icon: '⚡',
  },
  quality: {
    borderColor: 'var(--tier-1)',
    bg: 'rgba(245,197,24,0.07)',
    icon: 'ℹ️',
  },
  altitude: {
    borderColor: 'var(--learning)',
    bg: 'rgba(91,141,239,0.08)',
    icon: 'ℹ️',
  },
  luteal: {
    borderColor: '#e8659b',
    bg: 'rgba(232,101,155,0.08)',
    icon: 'ℹ️',
  },
  overtraining: {
    borderColor: 'var(--tier-2)',
    bg: 'rgba(255,140,0,0.08)',
    icon: '⚡',
  },
};

export default function ConfounderNote({ confounder }) {
  if (!confounder) return null;

  const style = TYPE_STYLES[confounder.type] || TYPE_STYLES.quality;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        background: style.bg,
        borderLeft: `3px solid ${style.borderColor}`,
        borderRadius: '0 10px 10px 0',
        padding: '10px 12px',
        marginTop: 12,
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>{style.icon}</span>
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
          fontWeight: 400,
        }}
      >
        {confounder.message}
      </p>
    </div>
  );
}

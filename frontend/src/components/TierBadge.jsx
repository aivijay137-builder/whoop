import React from 'react';
import { TIER_CONFIG } from '../utils/tierUtils.js';

const SIZE_STYLES = {
  sm: { fontSize: '10px', padding: '3px 8px', borderRadius: '20px', dotSize: 5 },
  md: { fontSize: '12px', padding: '4px 10px', borderRadius: '20px', dotSize: 6 },
  lg: { fontSize: '14px', padding: '6px 14px', borderRadius: '22px', dotSize: 7 },
};

export default function TierBadge({ tier, size = 'md' }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG[0];
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: sizeStyle.fontSize,
        fontWeight: 600,
        padding: sizeStyle.padding,
        borderRadius: sizeStyle.borderRadius,
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.color}30`,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: sizeStyle.dotSize,
          height: sizeStyle.dotSize,
          borderRadius: '50%',
          background: config.color,
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      {config.label}
    </span>
  );
}

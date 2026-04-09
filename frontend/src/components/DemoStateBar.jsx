import React from 'react';
import { useDemoData } from '../context/DemoContext.jsx';
import { demoStates, mockStates } from '../data/mockData.js';
import { getTierColor, getTierBg } from '../utils/tierUtils.js';

function getStateAccentColor(key) {
  const state = mockStates[key];
  if (!state) return 'var(--text-muted)';
  if (state.today.learning_mode) return 'var(--learning)';
  return getTierColor(state.today.tier);
}

function getStateBg(key) {
  const state = mockStates[key];
  if (!state) return 'transparent';
  if (state.today.learning_mode) return 'var(--learning-bg)';
  return getTierBg(state.today.tier);
}

export default function DemoStateBar() {
  const { currentStateKey, setCurrentStateKey } = useDemoData();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        background: 'rgba(10,10,16,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        zIndex: 99,
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Label */}
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        Demo:
      </span>

      {/* Scrollable pills */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          flex: 1,
          paddingBottom: 1,
        }}
      >
        {demoStates.map((ds) => {
          const isActive = ds.key === currentStateKey;
          const accent = getStateAccentColor(ds.key);
          const bg = getStateBg(ds.key);

          return (
            <button
              key={ds.key}
              onClick={() => setCurrentStateKey(ds.key)}
              style={{
                flexShrink: 0,
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                padding: '4px 10px',
                borderRadius: 12,
                border: `1px solid ${isActive ? accent : 'var(--border)'}`,
                background: isActive ? bg : 'var(--surface-raised)',
                color: isActive ? accent : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {ds.label}
            </button>
          );
        })}
      </div>

      {/* Prototype label */}
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          flexShrink: 0,
          opacity: 0.6,
        }}
      >
        PROTO
      </span>
    </div>
  );
}

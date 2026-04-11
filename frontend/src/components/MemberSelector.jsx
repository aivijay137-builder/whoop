import React from 'react';
import { useDemoData } from '../context/DemoContext.jsx';

export default function MemberSelector() {
  const { memberIds, selectedMemberId, setSelectedMemberId, csvLoading, csvError } = useDemoData();

  if (csvLoading) {
    return (
      <div style={{
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
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Loading members…
        </span>
      </div>
    );
  }

  if (csvError || memberIds.length === 0) return null;

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
      <span style={{
        fontSize: 8,
        fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        Member:
      </span>

      {/* Scrollable member pills */}
      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        flex: 1,
        paddingBottom: 1,
        scrollbarWidth: 'none',
      }}>
        {memberIds.map(mid => {
          const isActive = mid === selectedMemberId;
          return (
            <button
              key={mid}
              onClick={() => setSelectedMemberId(mid)}
              style={{
                flexShrink: 0,
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                padding: '4px 10px',
                borderRadius: 12,
                border: `1px solid ${isActive ? 'var(--tier-0)' : 'var(--border)'}`,
                background: isActive ? 'rgba(0,200,128,0.12)' : 'var(--surface-raised)',
                color: isActive ? 'var(--tier-0)' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {mid}
            </button>
          );
        })}
      </div>

      {/* CSV label */}
      <span style={{
        fontSize: 7,
        fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        flexShrink: 0,
        opacity: 0.6,
      }}>
        CSV
      </span>
    </div>
  );
}

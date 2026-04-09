import React from 'react';
import { useNavigate } from 'react-router-dom';

function HomeIcon({ active }) {
  const color = active ? 'var(--tier-0)' : 'var(--text-muted)';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 21V12h6v9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartIcon({ active }) {
  const color = active ? 'var(--tier-0)' : 'var(--text-muted)';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="12" width="4" height="9" rx="1" stroke={color} strokeWidth="1.8" />
      <rect x="10" y="7" width="4" height="14" rx="1" stroke={color} strokeWidth="1.8" />
      <rect x="17" y="3" width="4" height="18" rx="1" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

function GearIcon({ active }) {
  const color = active ? 'var(--tier-0)' : 'var(--text-muted)';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color}
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function BottomNav({ active }) {
  const navigate = useNavigate();

  const tabs = [
    { key: 'home', label: 'Home', icon: HomeIcon, path: '/' },
    { key: 'history', label: 'Timeline', icon: ChartIcon, path: '/history' },
    { key: 'admin', label: 'Debug', icon: GearIcon, path: '/admin' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        height: 64,
        background: 'rgba(14,14,20,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '8px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: isActive ? 1 : 0.7,
            }}
          >
            <tab.icon active={isActive} />
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--tier-0)' : 'var(--text-muted)',
                letterSpacing: '0.03em',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

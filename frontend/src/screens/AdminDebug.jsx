import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoData } from '../context/DemoContext.jsx';
import { demoStates } from '../data/mockData.js';
import { getTierColor } from '../utils/tierUtils.js';
import BottomNav from '../components/BottomNav.jsx';
import DemoStateBar from '../components/DemoStateBar.jsx';

// ─── Static mock audit table data ────────────────────────────────────────────
// 3 rows matching the PNG (M-8942-X advisory, M-4401-B awareness, M-1092-Z guidance)

const MOCK_ALERTS = [
  {
    id: 'ALT-0431',
    dateLabel: 'Oct 19, 08:42',
    memberId: 'M-8942-X',
    tier: 2,
    tierLabel: 'ADVISORY',
    score: 0.94,
    zHrv: -2.8,
    zRr: +9.4,
    qualities: [92, 88, 95, 84, 77],   // HRV / RHR / RR / TEMP / SPO2
    dismissed: false,
    dismissReason: null,
    notification: true,
    adjustments: { alcohol: false, altitude: false, cycle: false, overtraining: false },
    rule: 'Sustained 3-day deviation in HRV & RHR > 2.0 Sigma',
    ruleVersion: 'v2.7-Clinical',
    topMetrics: [
      { label: 'HRV (rms)',          z: -2.8, sigmaLabel: '-2.8σ Deviation',  warning: false },
      { label: 'Respiratory Rate',   z:  9.4, sigmaLabel: '+9.4σ Warning',     warning: true  },
    ],
  },
  {
    id: 'ALT-0432',
    dateLabel: 'Oct 19',
    memberId: 'M-4401-B',
    tier: 1,
    tierLabel: 'AWARENESS',
    score: 0.78,
    zHrv: -1.2,
    zRr: +1.4,
    qualities: [88, 91, 84, 80, 90],
    dismissed: false,
    dismissReason: null,
    notification: true,
    adjustments: { alcohol: true, altitude: false, cycle: true, overtraining: false },
    rule: 'Sustained 3-day deviation in HRV & RHR > 2.0 Sigma',
    ruleVersion: 'v2.7-Clinical',
    topMetrics: [
      { label: 'HRV (rms)',          z: -1.2, sigmaLabel: '-1.2σ Deviation',  warning: false },
      { label: 'Resting Heart Rate', z:  1.4, sigmaLabel: '+1.6σ Warning',     warning: true  },
    ],
  },
  {
    id: 'ALT-0433',
    dateLabel: 'Oct 18, 22:30',
    memberId: 'M-1092-Z',
    tier: 3,
    tierLabel: 'GUIDANCE',
    score: 0.42,
    zHrv: +0.8,
    zRr: -2.1,
    qualities: [76, 80, 62, 71, 85],
    dismissed: true,
    dismissReason: 'Heavy training',
    notification: true,
    adjustments: { alcohol: false, altitude: false, cycle: false, overtraining: true },
    rule: 'Multi-signal deviation sustained > 48h, 3+ metrics > 2σ',
    ruleVersion: 'v2.7-Clinical',
    topMetrics: [
      { label: 'HRV (rms)',        z:  0.8, sigmaLabel: '+0.8σ Deviation', warning: false },
      { label: 'Respiratory Rate', z: -2.1, sigmaLabel: '-2.1σ Warning',   warning: true  },
    ],
  },
];

const TIER_BADGE_COLOR = {
  ADVISORY:  { bg: 'rgba(255,140,0,0.15)', text: 'var(--tier-2)',  border: 'rgba(255,140,0,0.3)' },
  AWARENESS: { bg: 'rgba(91,141,239,0.15)', text: '#5b8def',       border: 'rgba(91,141,239,0.3)' },
  GUIDANCE:  { bg: 'rgba(232,64,64,0.15)', text: 'var(--tier-3)', border: 'rgba(232,64,64,0.3)'  },
};

// ─── KPI Stats Row ────────────────────────────────────────────────────────────

function KpiStat({ label, value, sub, subColor }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'var(--surface)',
      borderRadius: 12, padding: '12px 14px',
      border: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 10, color: subColor || 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Signal Quality Bars ──────────────────────────────────────────────────────
// 5 tiny vertical bars for the 5 signal quality values.

function SignalBars({ qualities }) {
  const maxQ = 100;
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 18 }}>
      {qualities.map((q, i) => {
        const h = Math.max(3, (q / maxQ) * 18);
        const color = q >= 80 ? '#4db8b0' : q >= 65 ? 'var(--tier-1)' : 'var(--tier-3)';
        return (
          <div
            key={i}
            style={{ width: 4, height: h, background: color, borderRadius: 1, opacity: 0.85 }}
          />
        );
      })}
    </div>
  );
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────

function TierBadge({ label }) {
  const style = TIER_BADGE_COLOR[label] || TIER_BADGE_COLOR.ADVISORY;
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, letterSpacing: '0.07em',
      color: style.text,
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: 5, padding: '3px 6px',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ─── Z-Score Sigma Bar ───────────────────────────────────────────────────────
// Horizontal bar in the detail panel showing sigma deviation magnitude.

function SigmaBar({ z }) {
  const abs = Math.min(Math.abs(z ?? 0), 5);
  const pct = (abs / 5) * 100;
  const color = abs > 2.5 ? 'var(--tier-3)' : abs > 1.5 ? 'var(--tier-2)' : 'var(--tier-1)';
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  );
}

// ─── Mini Sparkline (detail panel header) ────────────────────────────────────

function MiniSparkline({ history }) {
  const W = 120, H = 28;
  if (!history || history.length < 2) return null;
  const n = history.length;
  const step = W / (n - 1);
  const points = history.map((h, i) => {
    const s = Math.max(0.02, 1 - (h.score ?? 0.04));
    return { x: i * step, y: H - s * H };
  });
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 120, height: 28 }}>
      <path d={d} fill="none" stroke="#4db8b0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={getTierColor(history[i].tier ?? 0)} />
      ))}
    </svg>
  );
}

// ─── Breakpoint hook ─────────────────────────────────────────────────────────
// Returns 'mobile' | 'tablet' | 'desktop' based on viewport width.
// Breakpoints: mobile < 768, tablet 768–1199, desktop ≥ 1200.

function useBreakpoint() {
  function classify(w) {
    if (w < 768) return 'mobile';
    if (w < 1200) return 'tablet';
    return 'desktop';
  }
  const [bp, setBp] = useState(() => classify(window.innerWidth));
  useEffect(() => {
    const handler = () => setBp(classify(window.innerWidth));
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return bp;
}

// ─── Detail Panel — "Why this alert fired" ────────────────────────────────────
// Responsive:
//   mobile   (< 768px)    → bottom sheet, max-height 85vh, rounded top corners
//   tablet   (768–1199px) → centered modal, max-width 520px, max-height 82vh
//   desktop  (≥ 1200px)  → right-side panel, 420px wide, full viewport height

const ADJUSTMENTS = [
  { key: 'alcohol',     icon: '🍷', label: 'Alcohol Detected'      },
  { key: 'altitude',   icon: '⛰',  label: 'High Altitude'         },
  { key: 'cycle',      icon: '🌙', label: 'Menstrual Phase Adjust' },
  { key: 'overtraining', icon: '⚡', label: 'Overtraining Flag'    },
];

function DetailPanel({ alert, history, onClose, onVerify, onFlag }) {
  const bp = useBreakpoint();

  // ── Overlay styles — vary by breakpoint ──────────────────────────────────
  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 300,
    backdropFilter: 'blur(4px)',
    // Alignment differs per pattern
    ...(bp === 'mobile' && {
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'flex-end',
    }),
    ...(bp === 'tablet' && {
      background: 'rgba(0,0,0,0.70)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }),
    ...(bp === 'desktop' && {
      background: 'rgba(0,0,0,0.40)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
    }),
  };

  // ── Panel container styles — vary by breakpoint ───────────────────────────
  const panelStyle = {
    background: 'var(--surface-raised)',
    overflowY: 'auto',
    // Webkit momentum scrolling on iOS
    WebkitOverflowScrolling: 'touch',
    ...(bp === 'mobile' && {
      width: '100%',
      maxHeight: '85vh',
      borderRadius: '20px 20px 0 0',
      padding: '20px 20px 40px',
      border: '1px solid var(--border)',
      borderBottom: 'none',
    }),
    ...(bp === 'tablet' && {
      width: '100%', maxWidth: 520,
      maxHeight: '82vh',
      borderRadius: 20,
      padding: '24px 22px 28px',
      border: '1px solid var(--border)',
      // Prevent the modal shrinking on small tablets
      flexShrink: 0,
    }),
    ...(bp === 'desktop' && {
      width: 420,
      height: '100vh',
      borderRadius: 0,
      padding: '24px 22px 32px',
      borderLeft: '1px solid var(--border)',
    }),
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={panelStyle}>
        {/* Mobile drag handle — visual affordance */}
        {bp === 'mobile' && (
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.18)',
            margin: '0 auto 18px',
          }} />
        )}
        {/* Panel header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: '#5b8def' }}>ℹ</span>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Why this alert fired</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Member ID + mini sparkline */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px',
          marginBottom: 16,
        }}>
          <div>
            <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>
              Selected Member
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              {alert.memberId}
            </p>
          </div>
          <MiniSparkline history={history} />
        </div>

        {/* Rule text */}
        <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>
            Rule
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: 6 }}>
            {alert.rule}
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Rule Version: {alert.ruleVersion}
          </p>
        </div>

        {/* Top contributing metrics */}
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
          Top Contributing Metrics
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {alert.topMetrics.map((m, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</p>
                <p style={{
                  fontSize: 11, fontWeight: 600,
                  color: m.warning ? 'var(--tier-2)' : 'var(--text-secondary)',
                }}>
                  {m.sigmaLabel}
                </p>
              </div>
              <SigmaBar z={m.z} />
            </div>
          ))}
        </div>

        {/* Applied adjustments */}
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
          Applied Adjustments
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {ADJUSTMENTS.map(adj => {
            const active = alert.adjustments[adj.key];
            return (
              <div
                key={adj.key}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: active ? 'rgba(77,184,176,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? 'rgba(77,184,176,0.25)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '9px 12px',
                  opacity: active ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 14 }}>{adj.icon}</span>
                  <span style={{ fontSize: 12, color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 500 : 400 }}>
                    {adj.label}
                  </span>
                </div>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.07em',
                  color: active ? '#4db8b0' : 'var(--text-muted)',
                  padding: '3px 7px',
                  background: active ? 'rgba(77,184,176,0.12)' : 'rgba(255,255,255,0.05)',
                  borderRadius: 4,
                  border: `1px solid ${active ? 'rgba(77,184,176,0.3)' : 'var(--border)'}`,
                }}>
                  {active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Dismiss state banner */}
        {alert.dismissed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(245,197,24,0.07)',
            borderLeft: '3px solid var(--tier-1)',
            borderRadius: '0 10px 10px 0',
            padding: '10px 12px',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 13 }}>ℹ️</span>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Dismissed by member — Reason: <strong style={{ color: 'var(--text-primary)' }}>{alert.dismissReason}</strong>
            </p>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onVerify}
            style={{
              width: '100%', padding: '13px',
              borderRadius: 12,
              background: '#00c880', color: '#000',
              fontSize: 14, fontWeight: 700,
              border: 'none', cursor: 'pointer',
            }}
          >
            ✓ Verify Clinical Logic
          </button>
          <button
            onClick={onFlag}
            style={{
              width: '100%', padding: '13px',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 14, fontWeight: 500,
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            Flag for Review
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Alert Table Row ──────────────────────────────────────────────────────────

function AlertRow({ alert, isSelected, onClick }) {
  const zSign = (z) => z == null ? '—' : `${z > 0 ? '+' : ''}${z.toFixed(1)}`;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '80px 72px 1fr 40px 56px 30px',
        gap: 8,
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: isSelected ? 'rgba(77,184,176,0.07)' : 'transparent',
        borderLeft: isSelected ? '2px solid #4db8b0' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.12s ease',
      }}
    >
      {/* Date/time */}
      <div>
        <p style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.35 }}>
          {alert.dateLabel}
        </p>
        {alert.dismissed && (
          <p style={{ fontSize: 8, color: 'var(--tier-1)', fontWeight: 600, marginTop: 2 }}>DISMISSED</p>
        )}
      </div>

      {/* Member ID */}
      <p style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace', lineHeight: 1.35 }}>
        {alert.memberId}
      </p>

      {/* Tier badge */}
      <div>
        <TierBadge label={alert.tierLabel} />
      </div>

      {/* Corr. score */}
      <p style={{ fontSize: 11, fontWeight: 700, color: getTierColor(alert.tier), textAlign: 'right' }}>
        {alert.score.toFixed(2)}
      </p>

      {/* Z-scores HRV/RR */}
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: 9, color: alert.zHrv < -1.5 ? 'var(--tier-3)' : 'var(--text-secondary)', lineHeight: 1.4 }}>
          {zSign(alert.zHrv)}
        </p>
        <p style={{ fontSize: 9, color: alert.zRr > 1.5 ? 'var(--tier-2)' : 'var(--text-muted)', lineHeight: 1.4 }}>
          {zSign(alert.zRr)}
        </p>
      </div>

      {/* Signal quality bars */}
      <SignalBars qualities={alert.qualities} />
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminDebug() {
  const navigate = useNavigate();
  const { demoData, currentStateKey, setCurrentStateKey } = useDemoData();
  const { today, history } = demoData;

  const [selectedAlert, setSelectedAlert] = useState(null);
  const [tierFilter, setTierFilter] = useState('ALL');
  const [verified, setVerified] = useState(new Set());
  const [flagged, setFlagged] = useState(new Set());

  const TIER_FILTERS = ['ALL', 'ADVISORY', 'AWARENESS', 'GUIDANCE'];

  const filteredAlerts = tierFilter === 'ALL'
    ? MOCK_ALERTS
    : MOCK_ALERTS.filter(a => a.tierLabel === tierFilter);

  function handleVerify() {
    if (selectedAlert) {
      setVerified(prev => new Set(prev).add(selectedAlert.id));
      setSelectedAlert(null);
    }
  }
  function handleFlag() {
    if (selectedAlert) {
      setFlagged(prev => new Set(prev).add(selectedAlert.id));
      setSelectedAlert(null);
    }
  }

  return (
    <div className="screen" style={{ paddingTop: 0 }}>

      {/* ── Internal header ──────────────────────────── */}
      <div style={{ padding: '20px 0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>
            ⚙
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            CLINICAL ADMIN
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>v2.4.1-Stable</span>
        </div>

        <h1 style={{
          fontSize: 22, fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em', lineHeight: 1.2,
          marginBottom: 6,
        }}>
          Admin Audit Debug View
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Reviewing clinical alert triggers and rule veracity across the member population.
        </p>
      </div>

      {/* ── KPI stats row ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <KpiStat label="Total Alerts (249)" value="1,284" sub="−12% vs. prior period" subColor="var(--tier-0)" />
        <KpiStat label="Avg Corroboration" value="0.82" sub="● High confidence" subColor="#4db8b0" />
        <KpiStat label="Dismissal Rate" value="4.2%" sub="Historical low" subColor="var(--text-muted)" />
      </div>

      {/* ── Filters ───────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        {/* Search + date range row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{
            flex: 1,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10, padding: '8px 12px',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔍</span>
            <input
              placeholder="Member ID or Alert ID"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 12, color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10, padding: '8px 10px',
            fontSize: 10, color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
          }}>
            📅 Oct 12–19
          </div>
        </div>

        {/* Tier filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIER_FILTERS.map(t => {
            const active = tierFilter === t;
            const style = TIER_BADGE_COLOR[t];
            return (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 10, fontWeight: active ? 700 : 500,
                  letterSpacing: '0.04em',
                  background: active ? (style?.bg || 'var(--surface-raised)') : 'transparent',
                  color: active ? (style?.text || 'var(--text-primary)') : 'var(--text-muted)',
                  border: active
                    ? `1px solid ${style?.border || 'var(--border)'}`
                    : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {t === 'ALL' ? 'All Tiers' : t}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Alert table ───────────────────────────────── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 14,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 72px 1fr 40px 56px 30px',
          gap: 8,
          padding: '8px 14px',
          background: 'var(--surface-raised)',
          borderBottom: '1px solid var(--border)',
        }}>
          {['DATE & TIME', 'MEMBER ID', 'TIER', 'SCORE', 'Z (HRV/RR)', 'SIG'].map(h => (
            <p key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {h}
            </p>
          ))}
        </div>

        {/* Rows */}
        {filteredAlerts.length === 0 ? (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No alerts match current filters</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              isSelected={selectedAlert?.id === alert.id}
              onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
            />
          ))
        )}
      </div>

      {/* ── Verified / flagged status chips ───────────── */}
      {(verified.size > 0 || flagged.size > 0) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {[...verified].map(id => (
            <span key={id} style={{
              fontSize: 10, padding: '4px 10px', borderRadius: 20,
              background: 'rgba(0,200,128,0.1)', color: '#00c880',
              border: '1px solid rgba(0,200,128,0.3)',
            }}>
              ✓ {id} verified
            </span>
          ))}
          {[...flagged].map(id => (
            <span key={id} style={{
              fontSize: 10, padding: '4px 10px', borderRadius: 20,
              background: 'rgba(245,197,24,0.1)', color: 'var(--tier-1)',
              border: '1px solid rgba(245,197,24,0.3)',
            }}>
              ⚑ {id} flagged
            </span>
          ))}
        </div>
      )}

      {/* ── Metric debug table (current demo state) ───── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 14, border: '1px solid var(--border)',
        overflow: 'hidden', marginBottom: 20,
      }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Live Signal Debug — {currentStateKey} state
          </p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Metric', 'Value', 'Baseline', 'Z-score', 'Quality'].map(h => (
                <th key={h} style={{
                  padding: '7px 10px', fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--text-muted)',
                  textAlign: h === 'Metric' ? 'left' : 'right',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'HRV (ms)',     v: today.hrv_rmssd,        b: today.baseline_hrv_rmssd,        z: today.z_hrv,  q: today.hrv_quality  },
              { label: 'RHR (bpm)',    v: today.rhr,               b: today.baseline_rhr,               z: today.z_rhr,  q: today.rhr_quality  },
              { label: 'Resp (br/m)', v: today.respiratory_rate,  b: today.baseline_respiratory_rate,  z: today.z_rr,   q: today.rr_quality   },
              { label: 'Temp (°C)',    v: today.skin_temp,         b: today.baseline_skin_temp,         z: today.z_temp, q: today.temp_quality  },
              { label: 'SpO₂ (%)',     v: today.spo2,              b: today.baseline_spo2,              z: today.z_spo2, q: today.spo2_quality  },
            ].map(row => {
              const zAbs = row.z != null ? Math.abs(row.z) : null;
              const zColor = zAbs == null ? 'var(--text-muted)' : zAbs > 2.5 ? 'var(--tier-3)' : zAbs > 1.5 ? 'var(--tier-2)' : zAbs > 1.0 ? 'var(--tier-1)' : 'var(--tier-0)';
              const fmt = v => v == null ? '—' : typeof v === 'number' ? v.toFixed(2) : String(v);
              return (
                <tr key={row.label}>
                  <td style={{ padding: '7px 10px', fontSize: 10, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{row.label}</td>
                  <td style={{ padding: '7px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{fmt(row.v)}</td>
                  <td style={{ padding: '7px 10px', fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{fmt(row.b)}</td>
                  <td style={{ padding: '7px 10px', fontSize: 10, fontWeight: 600, color: zColor, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {row.z != null ? (row.z > 0 ? '+' : '') + row.z.toFixed(2) : '—'}
                  </td>
                  <td style={{
                    padding: '7px 10px', fontSize: 10, textAlign: 'right', borderBottom: '1px solid var(--border)',
                    color: row.q != null && row.q < 70 ? 'var(--tier-1)' : 'var(--text-muted)',
                  }}>
                    {row.q != null ? `${row.q}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Demo state switcher ───────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
          Demo State Override
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {demoStates.map(ds => {
            const active = ds.key === currentStateKey;
            return (
              <button
                key={ds.key}
                onClick={() => setCurrentStateKey(ds.key)}
                style={{
                  padding: '6px 14px', borderRadius: 10,
                  fontSize: 11, fontWeight: active ? 700 : 400,
                  background: active ? 'var(--surface-raised)' : 'var(--surface)',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: active ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {ds.label}
              </button>
            );
          })}
        </div>
      </div>

      <DemoStateBar />
      <BottomNav active="admin" />

      {/* ── Detail panel (bottom drawer) ─────────────── */}
      {selectedAlert && (
        <DetailPanel
          alert={selectedAlert}
          history={history}
          onClose={() => setSelectedAlert(null)}
          onVerify={handleVerify}
          onFlag={handleFlag}
        />
      )}
    </div>
  );
}

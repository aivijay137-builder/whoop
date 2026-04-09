import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoData } from '../context/DemoContext.jsx';
import { getTierColor, getTierLabel } from '../utils/tierUtils.js';
import BottomNav from '../components/BottomNav.jsx';
import DemoStateBar from '../components/DemoStateBar.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgoFrom(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function formatAlertDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

// Build N-day history extending 7-day mock with synthetic quiet baseline earlier days.
// Adds context markers for demo richness.
function buildExtendedHistory(history7, days) {
  if (!history7 || history7.length === 0) return [];

  const anchor = history7[history7.length - 1]?.date || new Date().toISOString().split('T')[0];
  const result = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = daysAgoFrom(anchor, i);
    // Use real data for last 7 days
    const realIdx = history7.length - 1 - (i < 7 ? i : -1);
    if (i < 7) {
      const real = history7[history7.length - 1 - i];
      if (real) {
        result.push({
          ...real,
          date,
          strain_high: false,
          journal_alcohol: false,
          clinical_alert: (real.tier ?? 0) >= 1,
        });
        continue;
      }
    }

    // Older synthetic days — quiet baseline with occasional context events
    const seed = i % 17;
    result.push({
      date,
      score: 0.03 + (seed % 5) * 0.01,
      tier: 0,
      strain_high: seed === 4 || seed === 11,
      journal_alcohol: seed === 8,
      journal_altitude: seed === 14,
      clinical_alert: false,
    });
  }

  return result;
}

// ─── Biometric Core Stability SVG Chart ──────────────────────────────────────
// Each day = a vertical range line (thin) + circle dot at stability value.
// Stability = 1 - score. Higher = more stable.
// Alert day bars rendered in tier color; normal = teal.
// Marker icons hover above bars for context events.

const TEAL = '#4db8b0';

function BiometricStabilityChart({ history }) {
  const n = history.length;
  if (n === 0) return null;

  const W = 320;
  const H = 110;
  const PAD_L = 4;
  const PAD_R = 4;
  const PAD_TOP = 22;  // space for marker icons
  const PAD_BOT = 20;  // space for date labels

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_TOP - PAD_BOT;
  const step = n > 1 ? chartW / (n - 1) : chartW;

  // Determine which dates to label on x-axis
  const labelEvery = n <= 7 ? 1 : n <= 30 ? Math.ceil(n / 6) : Math.ceil(n / 7);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
    >
      {/* Faint baseline range band */}
      <rect
        x={PAD_L}
        y={PAD_TOP}
        width={chartW}
        height={chartH}
        fill="rgba(255,255,255,0.025)"
        rx={4}
      />

      {history.map((h, i) => {
        const stability = h.score != null ? Math.max(0.06, 1 - h.score) : 0.5;
        const cx = PAD_L + i * step;
        const barH = stability * chartH;
        const cy = PAD_TOP + chartH - barH;
        const color = h.clinical_alert
          ? getTierColor(h.tier ?? 0)
          : h.score == null
          ? 'var(--text-muted)'
          : TEAL;

        return (
          <g key={h.date || i}>
            {/* Vertical range line */}
            <line
              x1={cx} y1={PAD_TOP + chartH}
              x2={cx} y2={cy + 4}
              stroke={color}
              strokeWidth={h.clinical_alert ? 2.5 : 1.5}
              opacity={h.clinical_alert ? 1 : 0.55}
              strokeLinecap="round"
            />

            {/* Daily value dot */}
            <circle
              cx={cx} cy={cy}
              r={h.clinical_alert ? 4.5 : 3}
              fill={color}
              opacity={h.clinical_alert ? 1 : 0.75}
            />

            {/* Context markers — sit above the bar */}
            {h.clinical_alert && (
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize="10" fill={color}>▲</text>
            )}
            {h.strain_high && !h.clinical_alert && (
              <text x={cx} y={PAD_TOP - 4} textAnchor="middle" fontSize="9" fill="var(--tier-2)" opacity={0.85}>⚡</text>
            )}
            {h.journal_alcohol && !h.clinical_alert && (
              <text x={cx} y={PAD_TOP - 4} textAnchor="middle" fontSize="9" fill="#9b59b6" opacity={0.9}>🍷</text>
            )}
            {h.journal_altitude && !h.clinical_alert && (
              <text x={cx} y={PAD_TOP - 4} textAnchor="middle" fontSize="9" fill="#5b8def" opacity={0.9}>✈</text>
            )}

            {/* X-axis date label — every N days */}
            {i % labelEvery === 0 && (
              <text
                x={cx} y={H - 3}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize={7.5}
                fontFamily="inherit"
              >
                {formatShortDate(h.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Markers Legend ───────────────────────────────────────────────────────────
// 2×2 grid matching PNG right panel layout.

function MarkersLegend() {
  const items = [
    { icon: '🍷', label: 'Alcohol Intake',    color: '#9b59b6' },
    { icon: '✈',  label: 'Travel/Timezone',   color: '#5b8def' },
    { icon: '⚡', label: 'High Strain Day',    color: 'var(--tier-2)' },
    { icon: '▲',  label: 'Clinical Alert',     color: 'var(--tier-3)' },
  ];
  return (
    <div>
      <p style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: 10,
      }}>
        Markers Legend
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 12, color: item.color, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analysis Insight ─────────────────────────────────────────────────────────
// Context-aware copy driven by demo state tier.

function AnalysisInsight({ today, history }) {
  const alertNights = history.filter(h => (h.tier ?? 0) >= 1).length;
  const tier = today.tier ?? 0;

  let text;
  if (today.learning_mode) {
    text = 'Your baselines are still being established. Check back after 14 nights for personalized trend analysis.';
  } else if (tier === 0 && alertNights === 0) {
    text = 'Your biometric signals have remained stable over this period. No significant deviations detected.';
  } else if (today.journal_alcohol) {
    text = `Alcohol was logged on the most recent night. HRV and resting HR typically recover within 24–48 hours of rest and hydration.`;
  } else if (tier >= 3) {
    text = `Multiple signals have been deviating for ${alertNights} consecutive night${alertNights !== 1 ? 's' : ''}. Sustained deviation at this level warrants attention and extra recovery focus.`;
  } else if (tier >= 1) {
    text = `Signals began shifting ${alertNights} night${alertNights !== 1 ? 's' : ''} ago. Early deviations at this stage often resolve with adequate sleep and hydration.`;
  } else {
    text = 'Recent signals show a return toward baseline. Continue monitoring over the next few nights to confirm full recovery.';
  }

  return (
    <div>
      <p style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: 8,
      }}>
        Analysis Insight
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        {text}
      </p>
    </div>
  );
}

// ─── Past Alert Card ──────────────────────────────────────────────────────────
// Horizontal scroll card: date + tier badge + title + 2 metrics + blurb.
// Matches PNG "Clinical Timeline Alerts" cards.

function alertTitle(tier) {
  if (tier === 3) return 'Recovery Guidance';
  if (tier === 2) return 'Deviation Advisory';
  return 'Early Signal';
}

function alertBlurb(tier) {
  if (tier === 3) return 'Multiple biometrics sustained deviation from baseline.';
  if (tier === 2) return 'System detected early signs of physiological strain.';
  return 'Mild shift in one or more signals noted overnight.';
}

function TierChip({ tier }) {
  const label = tier === 3 ? 'GUIDANCE' : 'ADVISORY';
  const color  = getTierColor(tier);
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, letterSpacing: '0.07em',
      color, padding: '3px 7px',
      background: `${color}18`,
      borderRadius: 4,
      border: `1px solid ${color}44`,
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  );
}

function PastAlertCard({ entry, onClick }) {
  const tier = entry.tier ?? 1;
  const color = getTierColor(tier);
  return (
    <div
      onClick={onClick}
      style={{
        width: 200,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRadius: 14,
        padding: '14px 14px 12px',
        border: '1px solid var(--border)',
        cursor: 'pointer',
      }}
    >
      {/* Date + tier chip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em' }}>
          {formatAlertDate(entry.date)}
        </span>
        <TierChip tier={tier} />
      </div>

      {/* Alert title */}
      <p style={{
        fontSize: 13, fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 10, lineHeight: 1.3,
      }}>
        {alertTitle(tier)}
      </p>

      {/* 2-metric mini row */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Score</p>
          <p style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: '-0.02em' }}>
            {Math.round((entry.score ?? 0) * 100)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Night</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '-0.02em' }}>
            T{tier}
          </p>
        </div>
      </div>

      {/* Blurb */}
      <p style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {alertBlurb(tier)}
      </p>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { key: '7',  label: '7 Days',  days: 7  },
  { key: '30', label: '30 Days', days: 30 },
  { key: '90', label: '90 Days', days: 90 },
];

export default function TimelineHistory() {
  const navigate = useNavigate();
  const { demoData } = useDemoData();
  const [range, setRange] = useState('30');

  const { today, history: history7 } = demoData;
  const days = RANGE_OPTIONS.find(r => r.key === range)?.days ?? 30;

  const extendedHistory = useMemo(
    () => buildExtendedHistory(history7, days),
    [history7, days]
  );

  const pastAlerts = extendedHistory.filter(h => (h.tier ?? 0) >= 1).reverse();
  const hasAlerts = pastAlerts.length > 0;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>

      {/* ── Back nav + title ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 4px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 15, flexShrink: 0,
          }}
        >
          ←
        </button>
      </div>

      {/* ── Hero header ──────────────────────────────── */}
      <div style={{ padding: '14px 0 20px' }}>
        <h1 style={{
          fontSize: 26, fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em', lineHeight: 1.2,
          marginBottom: 8,
        }}>
          Member Timeline History
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          A unified view of your biometric stability and lifestyle context over the past {range === '7' ? 'week' : range === '30' ? 'month' : '3 months'}.
        </p>
      </div>

      {/* ── Time range tabs ───────────────────────────── */}
      {/* PNG: 7 DAYS / 30 DAYS / 90 DAYS pill tabs, active = filled */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {RANGE_OPTIONS.map(opt => {
          const active = range === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              style={{
                padding: '7px 14px',
                borderRadius: 20,
                fontSize: 11, fontWeight: active ? 700 : 500,
                letterSpacing: '0.04em',
                background: active ? 'var(--surface-raised)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                border: active ? '1px solid var(--border)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* ── Biometric Core Stability card ────────────── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 18, padding: '16px 16px 12px',
        border: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        {/* Card header: title + legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Biometric Core Stability
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
              <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>BASELINE RANGE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: TEAL }} />
              <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>DAILY VALUE</span>
            </div>
          </div>
        </div>

        <p style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Last {days} days vs. baseline
        </p>

        {/* Chart */}
        {today.learning_mode ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Calibrating baselines — chart available after 14 nights.
            </p>
          </div>
        ) : (
          <BiometricStabilityChart history={extendedHistory} />
        )}

        {/* Metric legend row at bottom — matches PNG */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px 14px',
          paddingTop: 12, marginTop: 4,
          borderTop: '1px solid var(--border)',
        }}>
          {[
            { label: 'HRV (ms)',     color: '#4db8b0' },
            { label: 'Resting HR',   color: '#a0a0c0' },
            { label: 'Skin Temp',    color: '#c08060' },
            { label: 'Respiratory',  color: '#7090d0' },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Markers legend + Analysis insight ─────────── */}
      {/* PNG: 2-col right sidebar → mobile: side-by-side card row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 24,
      }}>
        <div style={{
          background: 'var(--surface)',
          borderRadius: 14, padding: '14px 14px',
          border: '1px solid var(--border)',
        }}>
          <MarkersLegend />
        </div>
        <div style={{
          background: 'var(--surface)',
          borderRadius: 14, padding: '14px 14px',
          border: '1px solid var(--border)',
        }}>
          <AnalysisInsight today={today} history={extendedHistory} />
        </div>
      </div>

      {/* ── Clinical Timeline Alerts ───────────────────── */}
      <div style={{ marginBottom: 24 }}>
        {/* Section header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 14,
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Clinical Timeline Alerts
          </p>
          {hasAlerts && (
            <button
              style={{
                background: 'none', border: 'none',
                fontSize: 11, color: 'var(--text-muted)',
                cursor: 'pointer', fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              VIEW ALL HISTORY
            </button>
          )}
        </div>

        {/* Horizontal scroll cards */}
        {hasAlerts ? (
          <div style={{
            display: 'flex', gap: 12,
            overflowX: 'auto',
            paddingBottom: 8,
            scrollbarWidth: 'none',
            // negative margin trick to allow scroll to edge
            margin: '0 -20px',
            padding: '0 20px 8px',
          }}>
            {pastAlerts.map((entry, i) => (
              <PastAlertCard
                key={entry.date || i}
                entry={entry}
                onClick={() => navigate(entry.tier >= 3 ? '/guidance' : '/advisory')}
              />
            ))}
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)',
            borderRadius: 14, padding: '24px 20px',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              No recent alerts
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Your signals have stayed within baseline during this period.
            </p>
          </div>
        )}
      </div>

      <DemoStateBar />
      <BottomNav active="history" />
    </div>
  );
}

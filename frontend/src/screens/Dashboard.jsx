import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoData } from '../context/DemoContext.jsx';
import { TIER_CONFIG, getTierColor, formatDelta } from '../utils/tierUtils.js';
import BottomNav from '../components/BottomNav.jsx';
import DemoStateBar from '../components/DemoStateBar.jsx';
import ConfounderNote from '../components/ConfounderNote.jsx';

// ─── Icons ────────────────────────────────────────────────────────────────────

const HeartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const PulseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const LungsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 12V5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v7" />
    <path d="M15 12V5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v7" />
    <path d="M6 12c0 4 2 6 6 6s6-2 6-6" />
    <line x1="12" y1="4" x2="12" y2="18" />
  </svg>
);

const TempIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

const DropIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPageTitle() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning Insights';
  if (h < 17) return 'Afternoon Insights';
  return 'Evening Insights';
}

function getDashboardSubtitle(tier) {
  switch (tier) {
    case 0:  return 'Your biometric baseline is remarkably stable today.';
    case 1:  return 'A few signals have shifted slightly from your baseline.';
    case 2:  return 'Multiple signals are showing deviations from your baseline.';
    case 3:  return 'Several signals have been trending away from your baseline.';
    default: return 'Monitoring your physiological signals.';
  }
}

function getHeroMessage(tier) {
  switch (tier) {
    case 0:  return 'Your body is recovering well. Maintain light activity today.';
    case 1:  return 'A few signals have shifted. Keep a close eye on your recovery tonight.';
    case 2:  return 'Your body may be responding to something. Consider prioritizing rest and hydration.';
    case 3:  return 'Multiple signals have moved away from your baseline. Prioritize recovery tonight.';
    default: return 'Monitoring your baseline.';
  }
}

function countConsecutiveGoodDays(history) {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if ((history[i].tier ?? 0) === 0) count++;
    else break;
  }
  return count;
}

function countConsecutiveDeviantNights(history) {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if ((history[i].tier ?? 0) >= 1) count++;
    else break;
  }
  return count;
}

function getTrendCopy(tier, history) {
  if (!history || history.length === 0) return '';
  if (tier === 0) {
    const days = countConsecutiveGoodDays(history);
    if (days >= 2) return `Your scores have stayed close to baseline for ${days} consecutive days.`;
    return 'Your signals are within normal range.';
  }
  const nights = countConsecutiveDeviantNights(history);
  if (nights >= 2) return `Signals have trended away from baseline for ${nights} consecutive nights.`;
  return 'A deviation was detected in your most recent reading.';
}

function getDayLabel(dateStr, isToday) {
  if (isToday) return 'TODAY';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  } catch { return ''; }
}

// ─── Wellness Trend Bar Chart ─────────────────────────────────────────────────
// PNG: 7 bars, bar height = stability (1 − score), colored by tier.
// Taller bar = closer to baseline = healthier.

function WellnessTrendBarChart({ history }) {
  const last7 = history ? history.slice(-7) : [];
  if (last7.length === 0) return null;

  const BAR_W = 28;
  const GAP   = 7;
  const MAX_H = 52;
  const LBL_H = 18;
  const W     = last7.length * (BAR_W + GAP) - GAP;
  const H     = MAX_H + LBL_H;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {last7.map((entry, i) => {
        const stability = Math.max(0.06, 1 - (entry.score ?? 0));
        const barH      = Math.round(stability * MAX_H);
        const x         = i * (BAR_W + GAP);
        const y         = MAX_H - barH;
        const isToday   = i === last7.length - 1;
        const color     = entry.tier != null ? getTierColor(entry.tier) : 'var(--text-muted)';

        return (
          <g key={i}>
            <rect
              x={x} y={y} width={BAR_W} height={barH}
              rx={5}
              fill={color}
              opacity={isToday ? 1 : 0.55}
            />
            <text
              x={x + BAR_W / 2} y={H - 2}
              textAnchor="middle"
              fontSize="7"
              fill="var(--text-muted)"
              fontFamily="inherit"
              fontWeight={isToday ? '700' : '400'}
              letterSpacing="0.02em"
            >
              {getDayLabel(entry.date, isToday)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Learning Mode Banner ─────────────────────────────────────────────────────

function LearningModeBanner({ daysInto, total, onNavigate }) {
  const remaining = total - daysInto;
  const progress  = daysInto / total;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={e => e.key === 'Enter' && onNavigate()}
      style={{
        background: 'var(--learning-bg)',
        border: '1px solid rgba(91,141,239,0.25)',
        borderRadius: 18, padding: 20, marginBottom: 20,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--learning)', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--learning)', letterSpacing: '-0.01em' }}>
          Building Your Baseline
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 16 }}>
        Your personal baseline is being established. Monitoring will begin after{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{remaining} more night{remaining !== 1 ? 's' : ''}</strong>.
      </p>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Night {daysInto} of {total}</span>
          <span style={{ fontSize: 11, color: 'var(--learning)', fontWeight: 600 }}>{Math.round(progress * 100)}%</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--learning)', borderRadius: 3, transition: 'width 0.5s ease' }} />
        </div>
      </div>
    </div>
  );
}

// ─── Status Hero Card ─────────────────────────────────────────────────────────
// PNG: "CURRENT STATUS: NORMAL ●" → large message → score row (score | HRV | RHR | Resp)

function StatusHeroCard({ today, tier, confounder }) {
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG[0];
  const tierColor  = getTierColor(tier);
  const score      = today.corroboration_score_adjusted;
  const scoreNum   = score != null ? Math.round(score * 100) : null;

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 20, padding: 20,
      marginBottom: 16,
      border: `1px solid ${tierColor}22`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient tier glow — top-right corner */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 180, height: '100%',
        background: `radial-gradient(ellipse at top right, ${tierColor}12 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* "CURRENT STATUS: NORMAL ●" */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, position: 'relative' }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Current Status:
        </span>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: tierColor, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {tierConfig.label}
        </span>
      </div>

      {/* Large message */}
      <p style={{
        fontSize: 22, fontWeight: 700,
        color: 'var(--text-primary)',
        lineHeight: 1.3, letterSpacing: '-0.025em',
        marginBottom: 18, position: 'relative',
      }}>
        {getHeroMessage(tier)}
      </p>

      {/* Score + 3 key metrics — separated by vertical rules */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        paddingTop: 14, borderTop: '1px solid var(--border)',
      }}>
        {/* Corroboration Score */}
        <div style={{ flex: '1 1 auto', paddingRight: 10, minWidth: 0 }}>
          <p style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
            Corroboration Score
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, color: tierColor, lineHeight: 1, letterSpacing: '-0.03em' }}>
            {scoreNum != null ? scoreNum : '—'}
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>/100</span>
          </p>
        </div>

        <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', marginRight: 12, flexShrink: 0 }} />

        {/* HRV */}
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <p style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>HRV</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {today.hrv_rmssd != null ? Math.round(today.hrv_rmssd) : '—'}
            <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 1 }}>ms</span>
          </p>
        </div>

        <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '0 10px', flexShrink: 0 }} />

        {/* Resting HR */}
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <p style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Resting HR</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {today.rhr != null ? Math.round(today.rhr) : '—'}
            <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 1 }}>bpm</span>
          </p>
        </div>

        <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '0 10px', flexShrink: 0 }} />

        {/* Resp Rate */}
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <p style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Resp. Rate</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {today.respiratory_rate != null ? today.respiratory_rate.toFixed(1) : '—'}
            <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 1 }}>br/m</span>
          </p>
        </div>
      </div>

      {/* Confounder note if applicable */}
      {confounder && (
        <div style={{ marginTop: 14 }}>
          <ConfounderNote confounder={confounder} />
        </div>
      )}
    </div>
  );
}

// ─── Wellness Trend Card ──────────────────────────────────────────────────────
// PNG: "Wellness Trend ↗" + "View Details →" + 7-bar chart + streak copy

function WellnessTrendCard({ history, tier, onViewDetails }) {
  const trendCopy = getTrendCopy(tier, history);
  const tierColor = getTierColor(tier);

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 18, padding: 18,
      border: '1px solid var(--border)',
      marginBottom: 16,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Wellness Trend</p>
          <span style={{ color: tier === 0 ? 'var(--tier-0)' : tierColor }}>
            <TrendUpIcon />
          </span>
        </div>
        <button
          onClick={onViewDetails}
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 3,
          }}
        >
          View Details <span style={{ fontSize: 14 }}>→</span>
        </button>
      </div>

      {/* Bar chart */}
      <WellnessTrendBarChart history={history} />

      {/* Streak copy */}
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 12 }}>
        {trendCopy}
      </p>
    </div>
  );
}

// ─── Metric Tile ──────────────────────────────────────────────────────────────
// PNG "What Changed" tiles: icon (top-left) + delta % (top-right) + short label + full name.
// Low-quality metrics are visually de-emphasized.

function MetricTile({ icon, metricKey, shortLabel, fullLabel, value, baseline, quality }) {
  const isLowQuality = (quality ?? 100) < 70;
  const noData       = value == null || baseline == null;

  let deltaDisplay = 'Stable';
  let deltaColor   = 'var(--text-muted)';

  if (isLowQuality) {
    deltaDisplay = '—';
  } else if (!noData) {
    const d = formatDelta(value, baseline, metricKey);
    if (d.direction !== 'neutral') {
      deltaDisplay = d.displayText;
      deltaColor   = d.isBad ? 'var(--tier-3)' : 'var(--tier-0)';
    }
  }

  return (
    <div style={{
      background: 'var(--surface-raised)',
      borderRadius: 14, padding: '12px 10px',
      width: 90, flexShrink: 0,
      border: '1px solid var(--border)',
      opacity: isLowQuality ? 0.5 : 1,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Icon + delta row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ color: 'var(--text-muted)', opacity: 0.75 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor, textAlign: 'right', lineHeight: 1.2, maxWidth: 56 }}>
          {deltaDisplay}
        </span>
      </div>
      {/* Short label */}
      <p style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
        {shortLabel}
      </p>
      {/* Full name */}
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
        {fullLabel}
      </p>
    </div>
  );
}

// ─── Tier 0 (Normal State) Components — Screen 08 ────────────────────────────

function getGreeting(name) {
  const h = new Date().getHours();
  const t = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${t}, ${name || 'there'}.`;
}

function getTier0Label(metricKey, z) {
  if (z == null) return 'STABLE';
  const abs = Math.abs(z);
  if (metricKey === 'spo2') return abs < 0.4 ? 'IDEAL' : 'NORMAL';
  if (metricKey === 'temp')  return 'BASELINE';
  if (abs < 0.4)  return metricKey === 'rr' ? 'STEADY' : metricKey === 'rhr' ? 'NORMAL' : 'IDEAL';
  return metricKey === 'rhr' ? 'NORMAL' : metricKey === 'rr' ? 'STEADY' : 'STABLE';
}

// Normal Status card: "CURRENT STATUS / OPTIMAL STATE / Normal ✓ description"
function NormalStatusCard() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(0,200,128,0.07) 0%, rgba(0,0,0,0) 65%)',
      borderRadius: 18, padding: '18px 18px',
      border: '1px solid rgba(0,200,128,0.18)',
      marginBottom: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* Faint leaf watermark — visual warmth matching PNG */}
      <div style={{
        position: 'absolute', bottom: -10, right: -10,
        width: 90, height: 90, opacity: 0.06,
        background: 'radial-gradient(circle, #00c880 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          Current Status
        </p>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
          color: '#00c880', padding: '3px 8px',
          background: 'rgba(0,200,128,0.1)', borderRadius: 6,
          border: '1px solid rgba(0,200,128,0.25)',
        }}>
          OPTIMAL STATE
        </span>
      </div>

      <p style={{
        fontSize: 40, fontWeight: 800, color: '#00c880',
        letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 14,
      }}>
        Normal
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(0,200,128,0.15)', border: '1px solid rgba(0,200,128,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, color: '#00c880' }}>✓</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Your biomarkers indicate stable physiological recovery and high readiness levels.
        </p>
      </div>
    </div>
  );
}

// 5-metric grid card for tier 0: icon + STABLE/NORMAL/etc label + large value + unit + metric name
function NormalMetricCard({ icon, statusLabel, value, unit, label }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 14, padding: '11px 11px 10px',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
        <span style={{ color: '#4db8b0', opacity: 0.75 }}>{icon}</span>
        <span style={{
          fontSize: 7, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
          color: '#4db8b0',
        }}>
          {statusLabel}
        </span>
      </div>
      <p style={{
        fontSize: 22, fontWeight: 800, color: 'var(--text-primary)',
        letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 3,
      }}>
        {value}
        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>
      </p>
      <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
    </div>
  );
}

// 7-Day Trend card reusing WellnessTrendBarChart, adds Stability % header
function NormalTrendCard({ history }) {
  const avg = history.length ? history.reduce((s, h) => s + (h.score ?? 0), 0) / history.length : 0;
  const stability = Math.min(99, Math.round((1 - avg) * 100));
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 18, padding: '16px 16px 12px',
      border: '1px solid var(--border)',
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>7-Day Trend</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#00c880' }}>Stability: {stability}%</p>
      </div>
      <WellnessTrendBarChart history={history} />
    </div>
  );
}

// Daily Insights card: encouragement copy + link
function DailyInsightCard({ consecutiveGoodDays }) {
  const body = consecutiveGoodDays >= 3
    ? 'Your data patterns suggest that maintaining your current sleep schedule is contributing significantly to your baseline stability. Keep it up.'
    : 'Your signals are within your recent range. Continue your current routine to support your recovery.';
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 18, padding: '18px 18px',
      border: '1px solid var(--border)',
      marginBottom: 14,
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
        Daily Insights
      </p>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 10 }}>
        Consistency is the key to recovery.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 12 }}>
        {body}
      </p>
      <button style={{
        background: 'none', border: 'none', padding: 0,
        fontSize: 12, color: '#4db8b0', fontWeight: 500, cursor: 'pointer',
      }}>
        Learn more about baseline shifts →
      </button>
    </div>
  );
}

// Recommended activity card — dark warm gradient with title
function RecommendedCard() {
  return (
    <div style={{
      borderRadius: 18, padding: '20px 18px',
      marginBottom: 24, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(160deg, #12100e 0%, #0b0b0f 55%)',
      border: '1px solid rgba(160,100,40,0.2)',
      minHeight: 80,
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 140, height: '100%',
        background: 'radial-gradient(ellipse at top right, rgba(120,80,20,0.28) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <p style={{
        fontSize: 8, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
        color: 'rgba(190,145,65,0.9)', marginBottom: 6, position: 'relative',
      }}>
        Recommended
      </p>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, position: 'relative' }}>
        10-Minute Breathwork
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, position: 'relative', maxWidth: 240 }}>
        Maintain your recovery momentum with a short breathwork session tonight.
      </p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { demoData } = useDemoData();

  if (!demoData) return null;

  const { member, today, history, confounder } = demoData;
  const isLearning = today.learning_mode;
  const tier = today.tier ?? 0;

  // Tier-aware navigation for View Details
  function handleViewDetails() {
    if (tier === 3) navigate('/guidance');
    else if (tier === 2) navigate('/advisory');
    else navigate('/history');
  }

  // "What Changed" metric tiles — maps our 5 biometrics to PNG tile style
  const metricTiles = [
    { icon: <HeartIcon />,  metricKey: 'hrv',  shortLabel: 'HRV',       fullLabel: 'Heart Stability',    value: today.hrv_rmssd,        baseline: today.baseline_hrv_rmssd,        quality: today.hrv_quality  },
    { icon: <PulseIcon />,  metricKey: 'rhr',  shortLabel: 'RHR',       fullLabel: 'Resting Heart Rate', value: today.rhr,               baseline: today.baseline_rhr,               quality: today.rhr_quality  },
    { icon: <LungsIcon />,  metricKey: 'rr',   shortLabel: 'Resp. Rate', fullLabel: 'Respiratory Rate',  value: today.respiratory_rate,  baseline: today.baseline_respiratory_rate,  quality: today.rr_quality   },
    { icon: <TempIcon />,   metricKey: 'temp', shortLabel: 'Skin Temp', fullLabel: 'Skin Temperature',  value: today.skin_temp,         baseline: today.baseline_skin_temp,         quality: today.temp_quality  },
    { icon: <DropIcon />,   metricKey: 'spo2', shortLabel: 'SpO₂',      fullLabel: 'Blood Oxygen',       value: today.spo2,              baseline: today.baseline_spo2,              quality: today.spo2_quality  },
  ];

  return (
    <div className="screen" style={{ paddingTop: 0 }}>

      {/* ── Header ───────────────────────────────────── */}
      {/* PNG: "Morning Insights" + subtitle + "● Live Syncing" + bell */}
      <header style={{ padding: '24px 0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <h1 style={{
              fontSize: 26, fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em', lineHeight: 1.1,
              marginBottom: 4,
            }}>
              {tier === 0 && !isLearning ? getGreeting(member?.name) : getPageTitle()}
            </h1>
            {!isLearning && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {tier === 0 ? 'Your recent signals are close to baseline.' : getDashboardSubtitle(tier)}
              </p>
            )}
          </div>

          {/* Live syncing + bell */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--tier-0)' }} />
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Live Syncing</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}><BellIcon /></span>
          </div>
        </div>
      </header>

      {/* ── Learning mode ────────────────────────────── */}
      {isLearning && (
        <LearningModeBanner
          daysInto={today.daysIntoLearning}
          total={today.totalLearningDays}
          onNavigate={() => navigate('/learning')}
        />
      )}

      {/* ── Tier 0: Normal State (Screen 08) ─────────── */}
      {!isLearning && tier === 0 && (() => {
        const consecutiveGoodDays = countConsecutiveGoodDays(history);

        // Format values for metric grid cards
        const fmt = (v, key, b) => {
          if (v == null) return '—';
          if (key === 'temp' && b != null) {
            const d = v - b;
            return `${d >= 0 ? '+' : ''}${d.toFixed(1)}`;
          }
          if (key === 'hrv' || key === 'rhr') return String(Math.round(v));
          return v.toFixed(1);
        };

        const grid = [
          { icon: <HeartIcon />, key: 'hrv',  label: 'HRV',        unit: 'ms',   value: fmt(today.hrv_rmssd, 'hrv', today.baseline_hrv_rmssd),        z: today.z_hrv  },
          { icon: <PulseIcon />, key: 'rhr',  label: 'Resting HR', unit: 'bpm',  value: fmt(today.rhr, 'rhr', today.baseline_rhr),                     z: today.z_rhr  },
          { icon: <LungsIcon />, key: 'rr',   label: 'Resp. Rate', unit: 'br/m', value: fmt(today.respiratory_rate, 'rr', today.baseline_respiratory_rate), z: today.z_rr   },
          { icon: <TempIcon />,  key: 'temp', label: 'Skin Temp',  unit: '°C',   value: fmt(today.skin_temp, 'temp', today.baseline_skin_temp),          z: today.z_temp },
          { icon: <DropIcon />,  key: 'spo2', label: 'SpO₂',       unit: '%',    value: fmt(today.spo2, 'spo2', today.baseline_spo2),                    z: today.z_spo2 },
        ];

        return (
          <>
            {/* Current Status card */}
            <NormalStatusCard />

            {/* 5-metric grid: 3-col top row + 2-col bottom row */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                {grid.slice(0, 3).map(m => (
                  <NormalMetricCard
                    key={m.key}
                    icon={m.icon}
                    statusLabel={getTier0Label(m.key, m.z)}
                    value={m.value}
                    unit={m.unit}
                    label={m.label}
                  />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {grid.slice(3).map(m => (
                  <NormalMetricCard
                    key={m.key}
                    icon={m.icon}
                    statusLabel={getTier0Label(m.key, m.z)}
                    value={m.value}
                    unit={m.unit}
                    label={m.label}
                  />
                ))}
              </div>
            </div>

            {/* 7-Day Trend */}
            <NormalTrendCard history={history} />

            {/* Daily Insights */}
            <DailyInsightCard consecutiveGoodDays={consecutiveGoodDays} />

            {/* Recommended */}
            <RecommendedCard />
          </>
        );
      })()}

      {/* ── Status Hero Card (tier > 0 only) ─────────── */}
      {!isLearning && tier > 0 && (
        <StatusHeroCard
          today={today}
          tier={tier}
          confounder={confounder}
        />
      )}

      {/* ── Wellness Trend Card (tier > 0 only) ──────── */}
      {!isLearning && tier > 0 && (
        <WellnessTrendCard
          history={history}
          tier={tier}
          onViewDetails={handleViewDetails}
        />
      )}

      {/* ── What Changed (tier > 0 only) ─────────────── */}
      {!isLearning && tier > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{
              fontSize: 16, fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.015em',
            }}>
              What Changed
            </h2>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs. personal baseline</span>
          </div>

          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {metricTiles.map(m => <MetricTile key={m.metricKey} {...m} />)}
          </div>
        </section>
      )}

      {/* ── Primary CTA ──────────────────────────────── */}
      {/* Show for tier > 0. Tier 2/3 = colored primary; Tier 1 = subtle secondary */}
      {!isLearning && tier > 0 && (
        <button
          onClick={handleViewDetails}
          style={{
            width: '100%', padding: '15px',
            borderRadius: 14,
            background: tier >= 2 ? getTierColor(tier) : 'var(--surface-raised)',
            color: tier >= 2 ? '#fff' : 'var(--text-secondary)',
            fontSize: 15, fontWeight: 700,
            border: tier >= 2 ? 'none' : '1px solid var(--border)',
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          View Details
        </button>
      )}

      <DemoStateBar />
      <BottomNav active="home" />
    </div>
  );
}

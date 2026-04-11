import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoData } from '../context/DemoContext.jsx';
import { getTierColor } from '../utils/tierUtils.js';
import BottomNav from '../components/BottomNav.jsx';
import MemberSelector from '../components/MemberSelector.jsx';
import ConfounderNote from '../components/ConfounderNote.jsx';
import DismissModal from '../components/DismissModal.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countDeviantNights(history) {
  if (!history || history.length === 0) return 0;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if ((history[i].tier ?? 0) >= 1) count++;
    else break;
  }
  return count;
}

function getTopMetrics(today) {
  const all = [
    { key: 'hrv',  label: 'HEART RATE VAR', value: today.hrv_rmssd,        baseline: today.baseline_hrv_rmssd,        unit: 'ms',   z: today.z_hrv,  quality: today.hrv_quality  },
    { key: 'rhr',  label: 'RESTING HR',     value: today.rhr,               baseline: today.baseline_rhr,               unit: 'bpm',  z: today.z_rhr,  quality: today.rhr_quality  },
    { key: 'rr',   label: 'RESP. RATE',     value: today.respiratory_rate,  baseline: today.baseline_respiratory_rate,  unit: 'br/m', z: today.z_rr,   quality: today.rr_quality   },
    { key: 'temp', label: 'SKIN TEMP',      value: today.skin_temp,         baseline: today.baseline_skin_temp,         unit: '°C',   z: today.z_temp, quality: today.temp_quality  },
    { key: 'spo2', label: 'SPO₂',           value: today.spo2,              baseline: today.baseline_spo2,              unit: '%',    z: today.z_spo2, quality: today.spo2_quality  },
  ];
  const usable = all.filter(m => m.z != null && (m.quality ?? 0) >= 70);
  usable.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  return usable.slice(0, 3);
}

// Pipeline z-scores are directional positive-only (0 = no adverse deviation).
function isAdverse(key, z) {
  if (z == null) return false;
  return z > 0;
}

function formatMetricDelta(value, baseline, unit) {
  if (value == null || baseline == null) return '—';
  const diff = value - baseline;
  const pct = ((diff / baseline) * 100).toFixed(0);
  const sign = diff > 0 ? '+' : '';
  if (unit === 'ms' || unit === '%') return `${sign}${pct}%`;
  if (unit === 'bpm') return `${sign}${Math.round(diff)} bpm`;
  if (unit === 'br/m') return `${sign}${diff.toFixed(1)} br/m`;
  if (unit === '°C') return `${sign}${diff.toFixed(1)}°C`;
  return `${sign}${pct}%`;
}

function formatValue(value, unit) {
  if (value == null) return '—';
  if (unit === 'ms' || unit === 'bpm') return String(Math.round(value));
  return value.toFixed(1);
}

// Day label: first = PRIOR, last = TODAY, middle = MON/TUE/etc
function getDayLabel(dateStr, index, total) {
  if (index === total - 1) return 'TODAY';
  if (index === 0) return 'PRIOR';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  } catch {
    return `D-${total - 1 - index}`;
  }
}

// ─── Deviation Sparkline ──────────────────────────────────────────────────────
// Dotted baseline (top) + solid deviation line trending down. Matches PNG chart.

function DeviationSparkline({ history }) {
  const last5 = history ? history.slice(-5) : [];
  if (last5.length < 2) return null;

  const W = 300;
  const H = 80;
  const BASELINE_Y = 10;
  const BOTTOM_Y = 65;
  const RANGE = BOTTOM_Y - BASELINE_Y;
  const xStep = W / (last5.length - 1);

  const points = last5.map((h, i) => ({
    x: i * xStep,
    y: BASELINE_Y + (h.score ?? 0) * RANGE,
    tier: h.tier,
    date: h.date,
  }));

  const polylineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fillPath = [
    `M${points[0].x.toFixed(1)},${BASELINE_Y}`,
    ...points.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${points[points.length - 1].x.toFixed(1)},${BASELINE_Y}`,
    'Z',
  ].join(' ');

  return (
    <svg
      viewBox={`-4 0 ${W + 8} ${H + 20}`}
      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
    >
      {/* Dotted baseline at top */}
      <line
        x1="0" y1={BASELINE_Y} x2={W} y2={BASELINE_Y}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />

      {/* Deviation fill area */}
      <path d={fillPath} fill="rgba(232,64,64,0.06)" />

      {/* Deviation line */}
      <polyline
        points={polylineStr}
        fill="none"
        stroke="var(--tier-3)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x.toFixed(1)}
          cy={p.y.toFixed(1)}
          r={i === points.length - 1 ? 5 : 3.5}
          fill={getTierColor(p.tier)}
          stroke="var(--surface)"
          strokeWidth="1.5"
        />
      ))}

      {/* X-axis labels: PRIOR / TUE / WED / THU / TODAY */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.x.toFixed(1)}
          y={H + 16}
          fontSize="8"
          fill="var(--text-muted)"
          textAnchor="middle"
          fontWeight="500"
          fontFamily="inherit"
          letterSpacing="0.03em"
        >
          {getDayLabel(p.date, i, points.length)}
        </text>
      ))}
    </svg>
  );
}

// ─── Metric Column ────────────────────────────────────────────────────────────

function MetricColumn({ metric }) {
  const { key, label, value, baseline, unit, z, quality } = metric;
  const isLowQuality = (quality ?? 0) < 70;
  const bad = isAdverse(key, z);
  const deltaColor = bad ? 'var(--tier-3)' : 'var(--tier-0)';
  const arrow = bad ? '↓' : '↑';

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{
        fontSize: 8, fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: 5,
      }}>
        {label}
      </p>

      {isLowQuality ? (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Low quality</p>
      ) : (
        <>
          <p style={{
            fontSize: 20, fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em', lineHeight: 1,
            marginBottom: 4,
          }}>
            {formatValue(value, unit)}
            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>
              {unit}
            </span>
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
            Baseline: {formatValue(baseline, unit)}{unit}
          </p>
          <p style={{ fontSize: 11, fontWeight: 600, color: deltaColor }}>
            {arrow} {formatMetricDelta(value, baseline, unit)}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Action Item — colored dot bullet matching PNG sidebar style ──────────────

function ActionItem({ dotColor, title, description }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
      <div style={{
        width: 10, height: 10,
        borderRadius: '50%',
        background: dotColor,
        flexShrink: 0,
        marginTop: 4,
      }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</p>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GuidanceDetail() {
  const navigate = useNavigate();
  const { demoData } = useDemoData();
  const [showDismiss, setShowDismiss] = useState(false);
  // Spec: if dismissed, keep alert visible and show stored reason as a banner
  const [dismissedReason, setDismissedReason] = useState(null);

  const { today, history, confounder } = demoData;
  const topMetrics = getTopMetrics(today);
  const deviantNights = countDeviantNights(history);
  const nightsLabel = deviantNights >= 2 ? `${deviantNights} nights` : 'several days';

  // Context-aware recommended actions with per-dot colors matching PNG sidebar dots
  const actions = [
    {
      dotColor: 'var(--tier-3)',
      title: 'Prioritize Rest',
      description: today.possible_overtraining
        ? 'Aim for 9 hours. Avoid taxing activity 45 min before sleep — your training load is elevated.'
        : 'Aim for 9 hours. Avoid taxing activity 45 min before sleep.',
    },
    {
      dotColor: '#5b8def',
      title: 'Hydrate Well',
      description: today.journal_alcohol
        ? 'Alcohol increases overnight fluid loss. Increase water intake by 500 ml above your daily average.'
        : 'Increase water intake by 500 ml above your daily average.',
    },
    {
      dotColor: 'var(--tier-2)',
      title: 'Reduce Physical Exertion',
      description: today.possible_overtraining
        ? 'Your training load is contributing to these signals. Swap all sessions for light stretching or meditation.'
        : 'Swap any exercise or training for light stretching or meditation.',
    },
  ];

  return (
    <div className="screen" style={{ paddingTop: 0 }}>

      {/* ── Back nav ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '20px 0 4px' }}>
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

      {/* ── Hero: tier badge + headline + subtext ─────── */}
      {/* Matches PNG left column: icon + large headline + subtext paragraph */}
      <div style={{ padding: '14px 0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--tier-3)', flexShrink: 0 }} />
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--tier-3)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Tier 3 Guidance
          </span>
        </div>

        <h1 style={{
          fontSize: 28, fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1.2, letterSpacing: '-0.03em',
          marginBottom: 12,
        }}>
          Multiple metrics have moved away from your baseline for {nightsLabel}.
        </h1>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          Your body is signaling a need for recovery. We've noticed a sustained shift in your
          physiological signals over the past 72 hours. This isn't a diagnosis, but a quiet
          prompt to prioritize your wellbeing tonight.
        </p>
      </div>

      {/* ── Dismissed-reason banner ───────────────────── */}
      {/* Per spec: keep alert visible, show stored reason */}
      {dismissedReason && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'rgba(245,197,24,0.07)',
          borderLeft: '3px solid var(--tier-1)',
          borderRadius: '0 10px 10px 0',
          padding: '10px 12px',
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, lineHeight: 1, paddingTop: 1 }}>ℹ️</span>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            You noted: <strong style={{ color: 'var(--text-primary)' }}>"{dismissedReason}"</strong>.
            {' '}Your signals continue to be monitored tonight.
          </p>
        </div>
      )}

      {/* ── Confounder note ───────────────────────────── */}
      {confounder && (
        <div style={{ marginBottom: 16 }}>
          <ConfounderNote confounder={confounder} />
        </div>
      )}

      {/* ── Physiological Deviation card ─────────────── */}
      {/* Clicking opens Member Timeline History (per spec) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate('/history')}
        onKeyDown={e => e.key === 'Enter' && navigate('/history')}
        style={{
          background: 'var(--surface)',
          borderRadius: 18, padding: 18,
          border: '1px solid var(--border)',
          marginBottom: 16,
          cursor: 'pointer',
        }}
      >
        {/* Card title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Physiological Deviation
          </p>
          {/* Legend — right-aligned matching PNG */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="16" height="5" viewBox="0 0 16 5">
                <line x1="0" y1="2.5" x2="16" y2="2.5" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeDasharray="4 3" />
              </svg>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Baseline</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="16" height="5" viewBox="0 0 16 5">
                <line x1="0" y1="2.5" x2="16" y2="2.5" stroke="var(--tier-3)" strokeWidth="2" />
              </svg>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Current</span>
            </div>
          </div>
        </div>

        <p style={{
          fontSize: 9, fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--text-muted)', marginBottom: 14,
        }}>
          Last {Math.min(5, history?.length ?? 5)} days vs. baseline
        </p>

        {/* Sparkline chart */}
        <DeviationSparkline history={history} />

        {/* Metric columns below chart — separated by vertical rules */}
        {topMetrics.length > 0 && (
          <div style={{
            display: 'flex',
            marginTop: 16, paddingTop: 16,
            borderTop: '1px solid var(--border)',
          }}>
            {topMetrics.map((m, i) => (
              <React.Fragment key={m.key}>
                <MetricColumn metric={m} />
                {i < topMetrics.length - 1 && (
                  <div style={{ width: 1, background: 'var(--border)', margin: '0 12px', alignSelf: 'stretch' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {topMetrics.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, fontStyle: 'italic' }}>
            Signal quality was insufficient to identify specific contributors.
          </p>
        )}
      </div>

      {/* ── Why You're Seeing This ────────────────────── */}
      {/* PNG: plain section, no card background */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
          Why You're Seeing This
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 14 }}>
          Clinical Sanctuary's engine monitors your physiological signals continuously. When
          three or more key signals deviate by more than two standard deviations from your
          rolling 30-day mean for more than 48 hours, we categorize this as a Tier 3 Guidance
          event. This pattern often precedes physical fatigue or systemic stress before you feel
          it consciously.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Multi-signal Correlation', '72h Window Analysis', 'Predictive Recovery Model'].map(tag => (
            <span key={tag} style={{
              fontSize: 10, fontWeight: 500,
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              borderRadius: 20, padding: '4px 10px',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Recommended Tonight ───────────────────────── */}
      {/* Matches PNG right sidebar: dot bullets + provider note */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 18, padding: '18px 18px 0',
        border: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>
          Recommended Tonight
        </p>

        {actions.map((a, i) => <ActionItem key={i} {...a} />)}

        {/* Provider note — conditional language, never diagnostic */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          paddingTop: 14, paddingBottom: 16,
          borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 15, lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>⚕️</span>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Consider speaking with a healthcare provider if symptoms such as persistent
            fatigue, chest pain, or shortness of breath are present.
          </p>
        </div>
      </div>

      {/* ── Recovery priority card ────────────────────── */}
      {/* PNG: dark ambient photo with "Your recovery is our priority." overlay */}
      <div style={{
        borderRadius: 18,
        marginBottom: 24,
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(160deg, #1a1008 0%, #0b0b0f 55%)',
        border: '1px solid rgba(180,120,40,0.2)',
        padding: '22px 18px',
        minHeight: 90,
      }}>
        {/* Warm ambient glow — mimics photo warmth */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 140, height: '100%',
          background: 'radial-gradient(ellipse at top right, rgba(180,100,20,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <p style={{
          fontSize: 16, fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 4, lineHeight: 1.3,
          position: 'relative',
        }}>
          Your recovery is our priority.
        </p>
        <p style={{
          fontSize: 12, color: 'var(--text-secondary)',
          lineHeight: 1.5, position: 'relative', maxWidth: 240,
        }}>
          Consistent rest over the next few nights will help your signals return to baseline.
        </p>
      </div>

      {/* ── CTAs ─────────────────────────────────────── */}
      {/* PNG: "Understood" = dark charcoal button; "Dismiss with context" = plain text link */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%', padding: '15px',
            borderRadius: 14,
            background: '#1e1e2a',
            color: 'var(--text-primary)',
            fontSize: 15, fontWeight: 700,
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
          }}
        >
          Understood
        </button>

        {/* Plain text link — no border, no background (matches PNG) */}
        <button
          onClick={() => setShowDismiss(true)}
          style={{
            width: '100%', padding: '12px',
            background: 'none', border: 'none',
            color: 'var(--text-muted)',
            fontSize: 14, fontWeight: 400,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Dismiss with context
        </button>
      </div>

      <MemberSelector />
      <BottomNav active="home" />

      {/* ── Dismiss modal ─────────────────────────────── */}
      {showDismiss && (
        <DismissModal
          onClose={() => setShowDismiss(false)}
          onConfirm={(reason) => {
            setShowDismiss(false);
            setDismissedReason(reason);
          }}
          preselect={today.journal_alcohol ? 'alcohol' : null}
        />
      )}
    </div>
  );
}

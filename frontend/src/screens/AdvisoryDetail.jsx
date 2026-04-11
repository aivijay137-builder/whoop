import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoData } from '../context/DemoContext.jsx';
import { formatDelta } from '../utils/tierUtils.js';
import BottomNav from '../components/BottomNav.jsx';
import MemberSelector from '../components/MemberSelector.jsx';
import ConfounderNote from '../components/ConfounderNote.jsx';
import DismissModal from '../components/DismissModal.jsx';

// ─── Icons ────────────────────────────────────────────────────────────────────

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const DropletIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

// Metric mini-card icons — small size for use inside SignalCard
const MetricActivityIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const MetricHeartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const MetricLungsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 12V5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v7" />
    <path d="M15 12V5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v7" />
    <path d="M6 12c0 4 2 6 6 6s6-2 6-6" />
    <line x1="12" y1="4" x2="12" y2="18" />
  </svg>
);

const MetricTempIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

const MetricDropIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConfidenceLabel(score) {
  if (!score) return 'MODERATE CONFIDENCE';
  if (score >= 0.70) return 'HIGH CONFIDENCE';
  if (score >= 0.45) return 'MODERATE CONFIDENCE';
  return 'LOW CONFIDENCE';
}

function computeMetricDelta(value, baseline, unit) {
  if (value == null || baseline == null) return null;
  const diff = value - baseline;
  const pct  = ((diff / baseline) * 100).toFixed(0);
  const sign = diff > 0 ? '+' : '';
  if (unit === 'pct') return `${sign}${pct}%`;
  if (unit === 'bpm') return `${sign}${Math.round(diff)} bpm`;
  if (unit === 'br')  return `${sign}${diff.toFixed(1)} rpm`;
  if (unit === 'c')   return `${sign}${diff.toFixed(1)}°C`;
  return `${sign}${pct}%`;
}

function computeSubLabel(metricKey) {
  switch (metricKey) {
    case 'hrv':  return 'Below your 14-day average';
    case 'rhr':  return 'Slight deviation during REM';
    case 'rr':   return 'Elevated breathing frequency';
    case 'temp': return 'Mild temperature increase';
    case 'spo2': return 'Slight drop from baseline';
    default:     return '';
  }
}

// Top 3 metrics sorted by |z-score|, excluding low-quality
function getTopMetrics(today) {
  const all = [
    { key: 'hrv',  name: 'HRV',        value: today.hrv_rmssd,        baseline: today.baseline_hrv_rmssd,        unit: 'pct', z: today.z_hrv,  quality: today.hrv_quality,  icon: <MetricActivityIcon /> },
    { key: 'rhr',  name: 'RESTING HR', value: today.rhr,               baseline: today.baseline_rhr,               unit: 'bpm', z: today.z_rhr,  quality: today.rhr_quality,  icon: <MetricHeartIcon />    },
    { key: 'rr',   name: 'RESP RATE',  value: today.respiratory_rate,  baseline: today.baseline_respiratory_rate,  unit: 'br',  z: today.z_rr,   quality: today.rr_quality,   icon: <MetricLungsIcon />    },
    { key: 'temp', name: 'SKIN TEMP',  value: today.skin_temp,         baseline: today.baseline_skin_temp,         unit: 'c',   z: today.z_temp, quality: today.temp_quality, icon: <MetricTempIcon />     },
    { key: 'spo2', name: 'SpO₂',       value: today.spo2,              baseline: today.baseline_spo2,              unit: 'pct', z: today.z_spo2, quality: today.spo2_quality, icon: <MetricDropIcon />     },
  ];
  const usable = all.filter(m => m.z != null && (m.quality ?? 0) >= 70);
  usable.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  return usable.slice(0, 3);
}

// Pipeline z-scores are directional positive-only (0 = no adverse deviation;
// positive = adverse regardless of metric direction).
function isAdverse(key, z) {
  if (z == null) return false;
  return z > 0;
}

// ─── 3-Night Deviation Bar Chart ─────────────────────────────────────────────
// PNG: 3 bars labeled Normal / Deviation Day 1 / Deviation Day 2.
// Colors: monochromatic gray progression (transparent → light → dark).

function DeviationHistoryChart({ history }) {
  const reversed = [...history].reverse();
  const today    = reversed[0];
  const prev     = reversed[1];
  const baseline = [...history].find(h => (h.tier === 0 || h.tier === null) && h.score != null) || history[0];

  const bars = [
    { label: 'Normal',          score: baseline?.score ?? 0.05 },
    { label: 'Deviation Day 1', score: prev?.score     ?? 0.35 },
    { label: 'Deviation Day 2', score: today?.score    ?? 0.62 },
  ];

  // PNG: monochromatic gray — transparent → light gray → prominent gray-white
  const barColors = [
    'rgba(255,255,255,0.10)',
    'rgba(255,255,255,0.28)',
    'rgba(255,255,255,0.62)',
  ];

  const CHART_H = 72;

  return (
    <div style={{ marginTop: 20 }}>
      <p style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10,
      }}>
        3-Night Deviation History
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        {bars.map((bar, i) => {
          const h = Math.max(6, (bar.score / 1.0) * CHART_H);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: '100%', height: CHART_H, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{
                  width: '100%', height: h,
                  background: barColors[i],
                  borderRadius: '5px 5px 0 0',
                  transition: 'height 0.5s ease',
                }} />
              </div>
              <p style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
                {bar.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Signal Mini-Card ─────────────────────────────────────────────────────────
// PNG: icon (top-left) + metric name + large delta + sub-label text.

function SignalCard({ metric }) {
  const { key, name, value, baseline, unit, z, quality, icon } = metric;
  const isLowQuality = (quality ?? 0) < 70;
  const delta        = computeMetricDelta(value, baseline, unit, key);
  const bad          = isAdverse(key, z);
  const deltaColor   = bad ? 'var(--tier-2)' : '#00c880';

  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.045)',
      borderRadius: 10,
      padding: '11px 10px 10px',
      minWidth: 0,
      opacity: isLowQuality ? 0.45 : 1,
    }}>
      {/* Icon */}
      <div style={{ color: 'var(--text-muted)', marginBottom: 5, opacity: 0.7 }}>
        {icon}
      </div>
      {/* Metric name */}
      <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 5 }}>
        {name}
      </p>

      {isLowQuality ? (
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Low quality</p>
      ) : (
        <>
          <p style={{ fontSize: 17, fontWeight: 700, color: deltaColor, letterSpacing: '-0.02em' }}>
            {delta ?? '—'}
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.3 }}>
            {computeSubLabel(key)}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Suggested Action Row ─────────────────────────────────────────────────────

function ActionItem({ icon, title, description }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--tier-2)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, paddingTop: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</p>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdvisoryDetail() {
  const navigate = useNavigate();
  const { demoData } = useDemoData();
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissed, setDismissed]    = useState(null);

  const { today, history, confounder } = demoData;
  const score      = today.corroboration_score_adjusted;
  const topMetrics = getTopMetrics(today);

  // Context-aware recommended actions
  const actions = [
    {
      icon: <MoonIcon />,
      title: 'Prioritize sleep tonight',
      description: today.possible_overtraining
        ? 'Your recent training load is high. An extra 45–60 minutes of sleep supports recovery.'
        : 'Aim for an extra 45–60 minutes to assist natural recovery processes.',
    },
    {
      icon: <DropletIcon />,
      title: 'Focus on hydration',
      description: today.journal_alcohol
        ? 'Alcohol can increase fluid loss overnight. Drink extra water today — your RHR reflects mild fluid demand.'
        : 'Maintain steady fluid intake throughout the day. Your resting heart rate suggests slight fluid demand.',
    },
    {
      icon: <ActivityIcon />,
      title: 'Reduce physical strain',
      description: today.possible_overtraining
        ? 'Your recent training load is elevated and may be contributing to these signal shifts. Swap high-intensity sessions for light active recovery.'
        : 'Swap high-intensity training for light active recovery like yoga or walking.',
    },
  ];

  // ── Dismissed state ───────────────────────────────────────────────────────
  if (dismissed) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--tier-0-bg)', border: '1px solid rgba(0,200,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00c880', fontSize: 22 }}>
          ✓
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Alert dismissed</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
          We noted: "{dismissed}".<br />Your baseline will continue to monitor each night.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{ marginTop: 8, padding: '12px 28px', borderRadius: 12, background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Back to dashboard
        </button>
        <MemberSelector />
        <BottomNav active="home" />
      </div>
    );
  }

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

      {/* ── Alert header ─────────────────────────────── */}
      {/* PNG: "● TIER 2 ADVISORY" label + large headline + subtext */}
      <div style={{ padding: '14px 0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--tier-2)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tier-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Tier 2 Advisory
          </span>
        </div>

        <h1 style={{
          fontSize: 28, fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1.2, letterSpacing: '-0.03em',
          marginBottom: 12,
        }}>
          Your body may be responding to something.
        </h1>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          Our system has detected deviations from your typical physiological baseline
          over the last 2 nights. This suggests your body is under increased demand.
        </p>
      </div>

      {/* ── Confounder note ───────────────────────────── */}
      {confounder && (
        <div style={{ marginBottom: 16 }}>
          <ConfounderNote confounder={confounder} />
        </div>
      )}

      {/* ── Physiological Signals card ───────────────── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 18, padding: 18,
        border: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        {/* Card header: title + confidence badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Physiological Signals</p>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
            color: 'var(--tier-2)', padding: '4px 8px',
            background: 'var(--tier-2-bg)',
            borderRadius: 6, textTransform: 'uppercase',
            border: '1px solid rgba(255,140,0,0.2)',
          }}>
            {getConfidenceLabel(score)}
          </span>
        </div>

        {/* Metric mini-cards — PNG: icon + name + delta + sub-label */}
        {topMetrics.length > 0 ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {topMetrics.map(m => <SignalCard key={m.key} metric={m} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0', fontStyle: 'italic' }}>
            Signal quality was insufficient to identify specific contributors.
          </p>
        )}

        {/* PNG: 3-bar deviation history (monochromatic gray) */}
        <DeviationHistoryChart history={history} />
      </div>

      {/* ── Suggested Actions ────────────────────────── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 18, padding: '18px 18px 4px',
        border: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>
          Suggested Actions
        </p>
        {actions.map((a, i) => <ActionItem key={i} {...a} />)}
      </div>

      {/* ── Wellness disclaimer ───────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.025)',
        borderRadius: 12, padding: '12px 14px',
        border: '1px solid var(--border)',
        marginBottom: 28,
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Remember: This is a wellness insight, not a diagnosis.
          Consult a healthcare professional if you feel unwell or have ongoing concerns.
        </p>
      </div>

      {/* ── CTAs — horizontal row matching PNG ───────── */}
      {/* PNG: "Dismiss with context" plain text left | "Got it" green button right */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={() => setShowDismiss(true)}
          style={{
            flex: 1, padding: '14px',
            background: 'none', border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 14, fontWeight: 500,
            cursor: 'pointer', textAlign: 'center',
          }}
        >
          Dismiss with context
        </button>

        <button
          onClick={() => navigate('/')}
          style={{
            flex: 1, padding: '15px',
            borderRadius: 14,
            background: '#00c880', color: '#000',
            fontSize: 15, fontWeight: 700,
            border: 'none', cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>

      <MemberSelector />
      <BottomNav active="home" />

      {/* ── Dismiss modal — centered chip dialog (screen 04) ── */}
      {showDismiss && (
        <DismissModal
          onClose={() => setShowDismiss(false)}
          onConfirm={(reason) => {
            setShowDismiss(false);
            setDismissed(reason);
          }}
          preselect={today.journal_alcohol ? 'alcohol' : null}
        />
      )}
    </div>
  );
}

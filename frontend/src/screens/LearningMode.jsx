import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoData } from '../context/DemoContext.jsx';
import BottomNav from '../components/BottomNav.jsx';
import MemberSelector from '../components/MemberSelector.jsx';

// ─── Circular Progress Ring ───────────────────────────────────────────────────
// SVG arc showing nights collected out of total. Matches PNG center illustration.

const TEAL = '#00c880';

function CircleProgress({ collected, total }) {
  const R = 48;
  const CX = 60, CY = 60;
  const SIZE = 120;
  const circumference = 2 * Math.PI * R;
  const pct = Math.min(1, Math.max(0, collected / total));
  const filled = pct * circumference;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ display: 'block' }}>
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={8}
      />
      {/* Progress arc — starts from top (rotated -90°) */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke={TEAL}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Center: nights count */}
      <text
        x={CX} y={CY - 7}
        textAnchor="middle"
        fill="var(--text-primary)"
        fontSize={22}
        fontWeight={800}
        fontFamily="inherit"
        letterSpacing="-0.04em"
      >
        {collected}
      </text>
      <text
        x={CX} y={CY + 8}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize={11}
        fontFamily="inherit"
      >
        /{total}
      </text>
      <text
        x={CX} y={CY + 20}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize={8}
        fontFamily="inherit"
        letterSpacing="0.08em"
      >
        NIGHTS
      </text>
    </svg>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────
// Row of N dots, first `collected` filled in teal. Matches PNG dot row.

function ProgressDots({ collected, total }) {
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: i < collected ? TEAL : 'rgba(255,255,255,0.1)',
            border: i < collected ? 'none' : '1px solid rgba(255,255,255,0.15)',
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

// ─── Status Chip (What's happening now — 3 chips) ────────────────────────────

function StatusChip({ value, label, color }) {
  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 10px 9px',
      textAlign: 'center',
    }}>
      <p style={{
        fontSize: 14, fontWeight: 800,
        color: color || 'var(--text-primary)',
        letterSpacing: '-0.02em', lineHeight: 1,
        marginBottom: 4,
      }}>
        {value}
      </p>
      <p style={{
        fontSize: 8, fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {label}
      </p>
    </div>
  );
}

// ─── State helpers ────────────────────────────────────────────────────────────

function getPhaseLabel(collected, total) {
  const pct = collected / total;
  if (pct >= 1) return 'Calibration Complete';
  if (pct >= 0.7) return 'Nearly Calibrated';
  return 'Learning Mode';
}

function getProgressLine(collected, total) {
  const pct = Math.round((collected / total) * 100);
  const remaining = total - collected;
  if (remaining <= 0) return 'Calibration complete. Your personalized baselines are ready.';
  if (remaining <= 3) return `${pct}% complete. Just ${remaining} more night${remaining > 1 ? 's' : ''} to go.`;
  return `${pct}% complete. We expect full calibration in ${remaining} more nights.`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LearningMode() {
  const navigate = useNavigate();
  const { demoData } = useDemoData();
  const { today } = demoData;

  const collected = today.daysIntoLearning ?? 8;
  const total     = today.totalLearningDays ?? 14;
  const phaseLabel = getPhaseLabel(collected, total);
  const progressLine = getProgressLine(collected, total);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>

      {/* ── Back nav ────────────────────────────────── */}
      <div style={{ padding: '20px 0 4px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 15,
          }}
        >
          ←
        </button>
      </div>

      {/* ── Hero section ────────────────────────────── */}
      {/* PNG: "PHASE: LEARNING MODE" pill + headline (Calibrating in teal) + subtitle + 2 CTAs */}
      <div style={{ padding: '14px 0 24px' }}>
        {/* Phase pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,200,128,0.1)',
          border: '1px solid rgba(0,200,128,0.3)',
          borderRadius: 20, padding: '5px 12px',
          marginBottom: 18,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: TEAL }} />
          <span style={{
            fontSize: 10, fontWeight: 700, color: TEAL,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Phase: {phaseLabel}
          </span>
        </div>

        {/* Headline — "Calibrating" in teal accent */}
        <h1 style={{
          fontSize: 30, fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1.15, letterSpacing: '-0.03em',
          marginBottom: 14,
        }}>
          Your Health Monitor is{' '}
          <span style={{ color: TEAL }}>Calibrating</span>
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 22 }}>
          To provide you with the most accurate insights, Clinical Sanctuary needs a few more
          nights to learn your body's unique physiological patterns. This calibration period
          ensures that every alert we send is meaningful and tailored specifically to you.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/history')}
            style={{
              padding: '11px 18px',
              borderRadius: 12,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Explore other metrics
          </button>
          <button
            style={{
              padding: '11px 18px',
              background: 'none', border: 'none',
              color: 'var(--text-muted)',
              fontSize: 13, fontWeight: 400,
              cursor: 'pointer',
            }}
          >
            View Calibration Data
          </button>
        </div>
      </div>

      {/* ── Calibration Progress card ─────────────────── */}
      {/* PNG: circle progress (9/14 NIGHTS) + "Calibration Progress" + % line + dots row */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 18, padding: '22px 20px',
        border: '1px solid var(--border)',
        marginBottom: 14,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
      }}>
        <CircleProgress collected={collected} total={total} />

        <p style={{
          fontSize: 14, fontWeight: 700,
          color: 'var(--text-primary)',
          marginTop: 14, marginBottom: 6,
        }}>
          Calibration Progress
        </p>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16, maxWidth: 260 }}>
          {progressLine}
        </p>

        <ProgressDots collected={collected} total={total} />
      </div>

      {/* ── What's happening now card ─────────────────── */}
      {/* PNG: right panel with paragraph + 3 status chips (Intensive/Mapping/Learning) */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 18, padding: '18px 18px',
        border: '1px solid var(--border)',
        marginBottom: 14,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>📡</span>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            What's happening now?
          </p>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 16 }}>
          While you rest, our clinical algorithms are quietly mapping your biometric fluctuations.
          Even during calibration, we are tracking key vitals every night.
        </p>

        {/* 3 status chips — Intensive / Mapping / Learning */}
        <div style={{ display: 'flex', gap: 8 }}>
          <StatusChip value="●" label="Intensive"  color={TEAL} />
          <StatusChip value={String(collected * 9 + 14)} label="Mapping"    color="var(--text-primary)" />
          <StatusChip value="✓"  label="Learning"  color="#5b8def" />
        </div>
      </div>

      {/* ── Why we calibrate + Clinical Precision ────── */}
      {/* PNG: 2 small cards side by side below the main cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{
          background: 'var(--surface)',
          borderRadius: 14, padding: '14px 14px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#5b8def' }}>ℹ</span>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Why we calibrate</p>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            No two bodies are the same. A "normal" heart rate for one person might be an indicator
            of stress for another. We establish your unique baseline first to eliminate false alerts.
          </p>
        </div>

        <div style={{
          background: 'var(--surface)',
          borderRadius: 14, padding: '14px 14px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: TEAL }}>◎</span>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Clinical Precision</p>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            As we collect more nights, confidence in your baseline increases, enabling medical-grade
            analysis of your recovery and stress response.
          </p>
        </div>
      </div>

      {/* ── "Focus on your sleep" motivational footer ── */}
      {/* PNG: warm ambient card + member count line */}
      <div style={{
        borderRadius: 18, padding: '20px 18px',
        marginBottom: 24,
        background: 'linear-gradient(145deg, #0e1a14 0%, #0b0b0f 60%)',
        border: '1px solid rgba(0,200,128,0.15)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 120, height: 120,
          background: 'radial-gradient(ellipse, rgba(0,200,128,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <p style={{
          fontSize: 16, fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.35, marginBottom: 8,
          position: 'relative',
        }}>
          Focus on your sleep, we'll do the rest.
        </p>
        <p style={{
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          marginBottom: 16, maxWidth: 280, position: 'relative',
        }}>
          Consistency is key during these next few nights. Wear your device comfortably
          and maintain your regular routine. The more consistent your environment, the
          faster we can protect your health.
        </p>

        {/* Member count row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          {/* Avatar stack (3 placeholder circles) */}
          <div style={{ display: 'flex' }}>
            {['#5b8def', '#e8659b', TEAL].map((c, i) => (
              <div
                key={i}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: c, border: '2px solid var(--bg)',
                  marginLeft: i > 0 ? -6 : 0,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Joined by <strong style={{ color: 'var(--text-secondary)' }}>12,000+</strong> members this month
          </p>
        </div>
      </div>

      <MemberSelector />
      <BottomNav active="home" />
    </div>
  );
}

import React, { useState } from 'react';

// ─── Screen 04: Dismiss + Context Modal ──────────────────────────────────────
// Centered dialog, blurred backdrop, chip selectors, optional textarea.
// Matches 04-dismiss-context-modal.png exactly.
//
// Props:
//   onClose()              — close without submitting
//   onConfirm(reason, note) — called with selected cause label + optional note
//   preselect              — cause key to pre-select (e.g. 'alcohol' when journal_alcohol=true)
//   initialNote            — pre-fill textarea (for editable re-submission)

export const DISMISS_CAUSES = [
  { key: 'alcohol',  label: 'I had alcohol' },
  { key: 'altitude', label: "I'm at altitude" },
  { key: 'training', label: 'Heavy training' },
  { key: 'cycle',    label: 'Menstrual cycle' },
  { key: 'other',    label: 'Other' },
];

export default function DismissModal({ onClose, onConfirm, preselect = null, initialNote = '' }) {
  const [selected, setSelected] = useState(preselect);
  const [note, setNote]         = useState(initialNote);

  function handleSubmit() {
    if (!selected) return;
    const cause = DISMISS_CAUSES.find(r => r.key === selected);
    onConfirm(cause?.label ?? selected, note.trim());
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        padding: '0 20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 390,
          background: 'var(--surface-raised)',
          borderRadius: 20,
          padding: '24px 20px 20px',
          border: '1px solid var(--border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title + subtitle */}
        <h3 style={{
          fontSize: 18, fontWeight: 700,
          color: 'var(--text-primary)', marginBottom: 6,
        }}>
          Help us understand your data.
        </h3>
        <p style={{
          fontSize: 13, color: 'var(--text-secondary)',
          lineHeight: 1.5, marginBottom: 20,
        }}>
          Providing context helps refine your future health alerts.
        </p>

        {/* Cause chips */}
        <p style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-muted)', marginBottom: 10,
        }}>
          Select primary cause
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {DISMISS_CAUSES.map(r => {
            const active = selected === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setSelected(r.key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 20,
                  background: active ? 'rgba(0,188,212,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${active ? 'rgba(0,188,212,0.55)' : 'var(--border)'}`,
                  color: active ? '#00bcd4' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Optional textarea */}
        <p style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-muted)', marginBottom: 8,
        }}>
          Additional insights (optional)
        </p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="E.g. I was traveling / on medication / recovering from exercise..."
          rows={3}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 12px',
            color: 'var(--text-primary)',
            fontSize: 13,
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            marginBottom: 20,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Cancel / Submit */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '13px',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 14, fontWeight: 500,
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              flex: 1, padding: '13px',
              borderRadius: 12,
              background: selected ? '#1e1e2a' : 'rgba(255,255,255,0.05)',
              color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 700,
              border: `1px solid ${selected ? 'rgba(255,255,255,0.15)' : 'var(--border)'}`,
              cursor: selected ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

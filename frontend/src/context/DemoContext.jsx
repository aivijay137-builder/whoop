import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockStates } from '../data/mockData.js';

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  // ── Mock state (kept for AdminDebug / DemoStateBar) ──────────────────────
  const [currentStateKey, setCurrentStateKey] = useState('tier2');

  // ── CSV-derived state ─────────────────────────────────────────────────────
  const [csvMembers, setCsvMembers]       = useState(null);   // { memberIds, members }
  const [csvLoading, setCsvLoading]       = useState(true);
  const [csvError, setCsvError]           = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  useEffect(() => {
    fetch('/data/members.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setCsvMembers(data);
        if (data.memberIds?.length > 0) {
          setSelectedMemberId(data.memberIds[0]);
        }
      })
      .catch(err => {
        console.warn('Could not load members.json — falling back to mock data.', err);
        setCsvError(err.message);
      })
      .finally(() => setCsvLoading(false));
  }, []);

  // ── Resolve demoData ──────────────────────────────────────────────────────
  // When CSV is loaded and a member is selected, use real data.
  // Otherwise fall back to mock (e.g. if the JSON file is missing).
  let demoData;
  if (csvMembers && selectedMemberId && csvMembers.members[selectedMemberId]) {
    demoData = csvMembers.members[selectedMemberId];
  } else {
    demoData = mockStates[currentStateKey];
  }

  const memberIds = csvMembers?.memberIds ?? [];

  return (
    <DemoContext.Provider value={{
      // CSV member selection
      memberIds,
      selectedMemberId,
      setSelectedMemberId,
      csvLoading,
      csvError,
      // Resolved data (CSV or mock fallback)
      demoData,
      // Legacy mock-state controls (used by DemoStateBar / AdminDebug)
      currentStateKey,
      setCurrentStateKey,
    }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoData() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemoData must be used inside DemoProvider');
  return ctx;
}

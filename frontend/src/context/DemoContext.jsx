import React, { createContext, useContext, useState } from 'react';
import { mockStates } from '../data/mockData.js';

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [currentStateKey, setCurrentStateKey] = useState('tier2');

  const demoData = mockStates[currentStateKey];

  return (
    <DemoContext.Provider value={{ demoData, currentStateKey, setCurrentStateKey }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoData() {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error('useDemoData must be used inside DemoProvider');
  }
  return ctx;
}

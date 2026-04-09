import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DemoProvider } from './context/DemoContext.jsx';
import Dashboard from './screens/Dashboard.jsx';
import AdvisoryDetail from './screens/AdvisoryDetail.jsx';
import GuidanceDetail from './screens/GuidanceDetail.jsx';
import TimelineHistory from './screens/TimelineHistory.jsx';
import AdminDebug from './screens/AdminDebug.jsx';
import LearningMode from './screens/LearningMode.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <DemoProvider>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/advisory" element={<AdvisoryDetail />} />
            <Route path="/guidance" element={<GuidanceDetail />} />
            <Route path="/history" element={<TimelineHistory />} />
            <Route path="/admin" element={<AdminDebug />} />
            <Route path="/learning" element={<LearningMode />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </DemoProvider>
    </BrowserRouter>
  );
}

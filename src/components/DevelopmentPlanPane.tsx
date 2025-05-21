// src/components/DevelopmentPlanPane.tsx
import React from 'react';

const DevelopmentPlanPane: React.FC = () => {
  return (
    <div className="p-2 h-100 overflow-auto" style={{ backgroundColor: 'var(--anchor-panel-background)'}}>
      <h6>DEVELOPMENT PLAN</h6>
      <div className="text-muted small">Development Plan (Post-MVP). Pane toggle can exist.</div>
    </div>
  );
};
export default DevelopmentPlanPane;
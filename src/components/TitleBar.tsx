import React from 'react';
import type { ElectronDraggableStyle } from '../types'; // Assuming types are in src/types

interface TitleBarProps {
  onToggleMenu: () => void;
  onTogglePanes: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ onToggleMenu, onTogglePanes }) => {
  const titleBarStyle: ElectronDraggableStyle = { 
    height: '32px', 
    backgroundColor: 'var(--anchor-primary)', 
    color: 'var(--anchor-text-on-primary)', 
    WebkitAppRegion: 'drag', 
    userSelect: 'none',
    flexShrink: 0, // Prevent shrinking
  };
  const buttonStyle: ElectronDraggableStyle = { 
    WebkitAppRegion: 'no-drag', 
    color: 'var(--anchor-text-on-primary)', 
    border: 'none' 
  };

  return (
    <div
      className="d-flex align-items-center px-2 title-bar" // Added class for querySelector
      style={titleBarStyle}
    >
      <button 
        onClick={onToggleMenu} 
        className="btn btn-sm me-2" 
        style={buttonStyle} 
        title="Toggle Menu"
      >
        <i className="bi bi-list"></i>
      </button>
      <span className="fw-bold">AnchorIDE</span>
      <button 
        onClick={onTogglePanes} 
        className="btn btn-sm ms-auto" 
        style={buttonStyle} 
        title="Toggle Panes"
      >
        <i className="bi bi-layout-sidebar-inset"></i>
      </button>
    </div>
  );
};

export default TitleBar;
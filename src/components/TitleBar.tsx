// src/components/TitleBar.tsx
import React, { useState, useEffect, CSSProperties } from 'react'; 
// No longer need ElectronDraggableStyle if using CSS classes for -webkit-app-region
import {
  //MdMenu,
  MdOutlineViewSidebar, 
  MdFormatListBulleted, 
  MdOutlineChat,        
  MdOutlineTerminal,    
  MdOutlineArticle,
  MdOutlineMinimize,
  MdOutlineCropSquare, 
  MdOutlineClose,
  MdOutlineFilterNone 
} from 'react-icons/md';

interface TitleBarProps {
  onToggleMenu: () => void;
  onToggleFileExplorer: () => void; 
  onToggleOutlineView: () => void;  
  onToggleChatPanel: () => void;
  onToggleTerminalPanel: () => void;
  onToggleDevPlanPanel: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ 
  onToggleMenu, 
  onToggleFileExplorer,
  onToggleOutlineView,
  onToggleChatPanel,
  onToggleTerminalPanel,
  onToggleDevPlanPanel,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const cleanup = window.electronAPI?.onWindowMaximized?.((maximized) => {
      setIsMaximized(maximized);
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Base styles that don't involve WebkitAppRegion can remain inline
  const titleBarStyle: CSSProperties = { 
    height: '32px', 
    backgroundColor: 'var(--anchor-primary)', 
    color: 'var(--anchor-text-on-primary)', 
    userSelect: 'none',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '8px',
  };
  
  const buttonStyleBase: CSSProperties = { 
    color: 'var(--anchor-text-on-primary)', 
    border: 'none',
    background: 'none',
    padding: '0.25rem 0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default', 
  };
  
  const menuIconStyle: React.CSSProperties = {
    width: '20px', 
    height: '20px', 
  };

  const appNameStyle: CSSProperties = {
    fontWeight: 'bold',
    marginLeft: '4px',
  };
  
  const draggableSpacerStyle: CSSProperties = {
    flexGrow: 1, 
    height: '100%', 
  };

  const handleMinimize = () => window.electronAPI?.sendWindowControl('minimize');
  const handleMaximizeRestore = () => window.electronAPI?.sendWindowControl('maximize'); 
  const handleClose = () => window.electronAPI?.sendWindowControl('close');

  return (
    <div
      className="title-bar draggable" // Added 'draggable' class
      style={titleBarStyle}
    >
      {/* Left Section: Menu Icon and App Name */}
      <button 
        onClick={onToggleMenu} 
        className="btn btn-sm non-draggable" // Added 'non-draggable' class
        style={{...buttonStyleBase, marginRight: '4px'}} 
        title="Application Menu"
      >
        <img src="/src/assets/anchor_icon.png" alt="Menu" style={menuIconStyle} />
      </button>
      <span className="draggable" style={appNameStyle}>AnchorIDE</span> {/* Added 'draggable' class */}

      {/* Draggable Spacer */}
      <div className="draggable" style={draggableSpacerStyle}></div>

      {/* Right Section: Pane Toggles */}
      <div className="d-flex non-draggable"> {/* Added 'non-draggable' class to the container */}
        <button onClick={onToggleFileExplorer} className="btn btn-sm non-draggable" style={buttonStyleBase} title="Toggle File Explorer"><MdOutlineViewSidebar size={20} /></button>
        <button onClick={onToggleOutlineView} className="btn btn-sm non-draggable" style={buttonStyleBase} title="Toggle Outline View"><MdFormatListBulleted size={20} /></button>
        <button onClick={onToggleChatPanel} className="btn btn-sm non-draggable" style={buttonStyleBase} title="Toggle Chat Panel"><MdOutlineChat size={20} /></button>
        <button onClick={onToggleTerminalPanel} className="btn btn-sm non-draggable" style={buttonStyleBase} title="Toggle Terminal Panel"><MdOutlineTerminal size={20} /></button>
        <button onClick={onToggleDevPlanPanel} className="btn btn-sm non-draggable" style={buttonStyleBase} title="Toggle Development Plan Panel"><MdOutlineArticle size={20} /></button>
      </div>

      {/* Custom Window Controls */}
      <div className="window-controls d-flex non-draggable" style={{ marginLeft: '8px' }}> {/* Added 'non-draggable' class */}
        <button onClick={handleMinimize} className="btn btn-sm non-draggable" style={buttonStyleBase} title="Minimize">
          <MdOutlineMinimize size={18} />
        </button>
        <button onClick={handleMaximizeRestore} className="btn btn-sm non-draggable" style={buttonStyleBase} title={isMaximized ? "Restore" : "Maximize"}>
          {isMaximized ? <MdOutlineFilterNone size={16} /> : <MdOutlineCropSquare size={16} />}
        </button>
        <button onClick={handleClose} className="btn btn-sm non-draggable" style={{...buttonStyleBase, paddingRight: '8px'}} title="Close">
          <MdOutlineClose size={18} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;

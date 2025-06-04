import React from 'react';
interface TitleBarProps {
    onToggleMenu: () => void;
    onToggleFileExplorer: () => void;
    onToggleOutlineView: () => void;
    onToggleChatPanel: () => void;
    onToggleTerminalPanel: () => void;
    onToggleDevPlanPanel: () => void;
}
declare const TitleBar: React.FC<TitleBarProps>;
export default TitleBar;

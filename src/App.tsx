// src/App.tsx (Main App component - updated to import other components)
import React, { useState, useEffect, useRef } from 'react'; 
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as monacoApi from 'monaco-editor';

// Import types
import type { DirectoryItem, DocumentSymbol, ChatInputHandle } from './types';

// Import components
import TitleBar from './components/TitleBar';
import FileExplorer from './components/FileExplorer';
import OutlineView from './components/OutlineView';
import ChatWindow from './components/ChatWindow';
import EditorArea from './components/EditorArea';
import Terminal from './components/Terminal';
import DevelopmentPlanPane from './components/DevelopmentPlanPane';

// Constants for Panel IDs
const LEFT_SIDEBAR_STACK_ID = "leftSidebarStack"; 
const FILE_EXPLORER_PANEL_ID = "fileExplorerPanel";
const OUTLINE_VIEW_PANEL_ID = "outlineViewPanel";
const CHAT_PANEL_ID = "chatPanel"; 
const EDITOR_AREA_PANEL_ID = "editorAreaPanel";
const TERMINAL_PANEL_ID = "terminalPanel";
const DEV_PLAN_PANEL_ID = "devPlanPanel";


const App: React.FC = () => {
  const [showPanes, setShowPanes] = useState(true); 
  const [fileToOpenInEditor, setFileToOpenInEditor] = useState<DirectoryItem | null>(null);
  const [openedFolderPath, setOpenedFolderPath] = useState<string | null>(null); 
  const chatInputRef = useRef<ChatInputHandle | null>(null); 
  const [editorSymbols, setEditorSymbols] = useState<DocumentSymbol[]>([]); 
  const editorInstanceRef = useRef<monacoApi.editor.IStandaloneCodeEditor | null>(null); 


  const handleToggleMenu = () => {
    const hamburgerButton = document.querySelector('.title-bar button:first-child'); 
    if (hamburgerButton && window.electronAPI?.showAppMenu) {
        const rect = hamburgerButton.getBoundingClientRect();
        window.electronAPI.showAppMenu({ x: Math.round(rect.left), y: Math.round(rect.bottom) });
    } else if (window.electronAPI?.showAppMenu) {
        window.electronAPI.showAppMenu(); 
    }
  };

  const handleTogglePanes = () => {
    setShowPanes(prev => !prev);
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
    });
  };
  
  useEffect(() => {
    let cleanupThemeListener: (() => void) | undefined;
    if (window.electronAPI?.getInitialTheme && window.electronAPI?.onUpdateTheme) {
        window.electronAPI.getInitialTheme().then(initialIsDark => {
            document.documentElement.setAttribute('data-theme', initialIsDark ? 'dark' : 'light');
        });
        cleanupThemeListener = window.electronAPI.onUpdateTheme((isDarkMode) => {
          document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        });
    } else { 
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
    const cleanupOpenFolder = window.electronAPI?.on('trigger-open-folder', handleOpenFolder); 

    return () => {
        if (cleanupThemeListener) cleanupThemeListener();
        if (cleanupOpenFolder) cleanupOpenFolder();
    };
  }, []);

  const handleOpenFileInEditor = (file: DirectoryItem) => {
    if (file.isFile) {
      setFileToOpenInEditor(file); 
    }
  };

  const handleOpenFolder = async () => { 
    const selectedPath = await window.electronAPI?.openFolderDialog();
    if (selectedPath) {
      setOpenedFolderPath(selectedPath);
      setFileToOpenInEditor(null); 
      setEditorSymbols([]); 
    }
  };

  const handleAddPathToChatContext = (itemPath: string, isDirectory: boolean) => {
    const type = isDirectory ? 'Folder' : 'File';
    const normalizedPath = itemPath.replace(/\\/g, '/');
    const token = `@[${type}: ${normalizedPath}]`;
    console.log("Adding to context:", token); 
    chatInputRef.current?.addTextToInput(token); 
  };

  const handleSymbolClick = (symbol: DocumentSymbol) => {
    const currentEditor = editorInstanceRef.current;
    // monacoInstanceRef is now local to EditorArea, so we can't access it here directly
    // This logic needs to be handled within EditorArea or by passing the monaco instance up.
    // For now, we'll rely on editorRef.current which is the editor instance.
    if (currentEditor) { 
        currentEditor.revealRangeInCenterIfOutsideViewport(symbol.range, monacoApi.editor.ScrollType.Smooth);
        currentEditor.setPosition({ lineNumber: symbol.range.startLineNumber, column: symbol.range.startColumn });
        currentEditor.focus();
    }
  };
  
  return (
    <div className="app-container">
      <TitleBar onToggleMenu={handleToggleMenu} onTogglePanes={handleTogglePanes} />
      
      <PanelGroup direction="horizontal" className="main-content-area">
        {showPanes && (
          <>
            <Panel defaultSize={20} minSize={15} id={LEFT_SIDEBAR_STACK_ID} collapsible>
              <PanelGroup direction="vertical">
                <Panel defaultSize={65} minSize={20} id={FILE_EXPLORER_PANEL_ID} collapsible> 
                  <FileExplorer 
                    onOpenFile={handleOpenFileInEditor} 
                    rootPathToLoad={openedFolderPath}
                    onAddPathToChatContext={handleAddPathToChatContext} 
                  />
                </Panel>
                <PanelResizeHandle className="panel-resize-handle" style={{height: '4px'}}/>
                <Panel defaultSize={35} minSize={15} id={OUTLINE_VIEW_PANEL_ID} collapsible> 
                  <OutlineView symbols={editorSymbols} onSymbolClick={handleSymbolClick} />
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="panel-resize-handle" style={{width: '4px'}}/>
          </>
        )}

        {showPanes && (
          <>
            <Panel defaultSize={25} minSize={20} id={CHAT_PANEL_ID} collapsible>
              <ChatWindow chatInputRef={chatInputRef} /> 
            </Panel>
            <PanelResizeHandle className="panel-resize-handle" style={{width: '4px'}}/>
          </>
        )}

        <Panel minSize={30} id={EDITOR_AREA_PANEL_ID}> 
          <PanelGroup direction="vertical">
            <Panel defaultSize={70} minSize={30} id="editorActualPanel"> 
                 <EditorArea 
                    fileToOpen={fileToOpenInEditor} 
                    isFolderCurrentlyOpen={!!openedFolderPath} 
                    onOpenFolder={handleOpenFolder} 
                    onEditorSymbolsChange={setEditorSymbols}
                    editorRef={editorInstanceRef}
                 />
            </Panel>
            {showPanes && ( 
                <>
                    <PanelResizeHandle className="panel-resize-handle" style={{height: '4px'}}/>
                    <Panel defaultSize={30} minSize={15} id={TERMINAL_PANEL_ID} collapsible className="terminal-panel-wrapper">
                      <Terminal />
                    </Panel>
                </>
            )}
          </PanelGroup>
        </Panel>
        
        {showPanes && (
            <>
                <PanelResizeHandle className="panel-resize-handle" style={{width: '4px'}} />
                <Panel defaultSize={20} minSize={15} id={DEV_PLAN_PANEL_ID} collapsible>
                    <DevelopmentPlanPane />
                </Panel>
            </>
        )}
      </PanelGroup>
    </div>
  );
};

export default App;
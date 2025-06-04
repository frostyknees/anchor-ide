// src/App.tsx 
import React, { useState, useEffect, useRef } from 'react';
import type { ImperativePanelGroupHandle, ImperativePanelHandle } from 'react-resizable-panels'; 
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as monacoApi from 'monaco-editor';

// Import types
import type { DirectoryItem, DocumentSymbol, ChatInputHandle, AppSettings, PanelLayout } from './types'; 

// Import components
import TitleBar from './components/TitleBar';
import FileExplorer from './components/FileExplorer';
import OutlineView from './components/OutlineView';
import ChatWindow from './components/ChatWindow';
import EditorArea from './components/EditorArea';
import Terminal from './components/Terminal';
import DevelopmentPlanPane from './components/DevelopmentPlanPane';

// Constants for Panel IDs
const LEFT_SIDEBAR_STACK_PANEL_GROUP_ID = "leftSidebarStackPanelGroup"; 
const LEFT_SIDEBAR_FILE_EXPLORER_ID = "leftSidebarFileExplorer"; 
const LEFT_SIDEBAR_OUTLINE_VIEW_ID = "leftSidebarOutlineView";
const CHAT_PANEL_ID = "chatPanel"; 
const CENTER_STACK_PANEL_GROUP_ID = "centerStackPanelGroup"; 
const EDITOR_PANEL_ID = "editorActualPanel"; 
const TERMINAL_PANEL_ID = "terminalPanel";
const DEV_PLAN_PANEL_ID = "devPlanPanel";
const MAIN_HORIZONTAL_PANEL_GROUP_ID = "mainHorizontalPanelGroup";


// Helper for debounce
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced;
}


const App: React.FC = () => {
  const mainHorizontalPanelGroupRef = useRef<ImperativePanelGroupHandle>(null);
  const leftSidebarStackGroupRef = useRef<ImperativePanelGroupHandle>(null);
  const centerStackPanelGroupRef = useRef<ImperativePanelGroupHandle>(null); // For Editor/Terminal group

  // Refs for individual Panels to be collapsed/expanded
  const leftSidebarContainerPanelRef = useRef<ImperativePanelHandle>(null);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const devPlanPanelRef = useRef<ImperativePanelHandle>(null);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const fileExplorerPanelRef = useRef<ImperativePanelHandle>(null);
  const outlineViewPanelRef = useRef<ImperativePanelHandle>(null);
  // Visibility states
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [showOutlineView, setShowOutlineView] = useState(false); 
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [showTerminalPanel, setShowTerminalPanel] = useState(true);
  const [showDevPlanPanel, setShowDevPlanPanel] = useState(true); 
  
  // Content states
  const [fileToOpenInEditor, setFileToOpenInEditor] = useState<DirectoryItem | null>(null);
  const [openedFolderPath, setOpenedFolderPath] = useState<string | null>(null); 
  const chatInputRef = useRef<ChatInputHandle | null>(null); 
  const [chatHistoryForPersistence, setChatHistoryForPersistence] = useState<{ sender: string, text: string }[]>([]);
  const [editorSymbols, setEditorSymbols] = useState<DocumentSymbol[]>([]); 
  const editorInstanceRef = useRef<monacoApi.editor.IStandaloneCodeEditor | null>(null);
  const [openEditorFilePathsForPersistence, setOpenEditorFilePathsForPersistence] = useState<string[]>([]);
  const [activeEditorFileIdForPersistence, setActiveEditorFileIdForPersistence] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>('system');

  // --- Load settings on mount ---
  useEffect(() => {
    const loadSettings = async () => {
      const loadedSettings = await window.electronAPI?.getAppSettings();
      if (loadedSettings) {
        console.log("Loaded settings:", loadedSettings);
        if (loadedSettings.openedFolderPath !== undefined) setOpenedFolderPath(loadedSettings.openedFolderPath);
        if (loadedSettings.panelVisibility) {
          setShowFileExplorer(loadedSettings.panelVisibility.fileExplorer ?? true);
          setShowOutlineView(loadedSettings.panelVisibility.outlineView ?? false);
          setShowChatPanel(loadedSettings.panelVisibility.chatPanel ?? true);
          setShowTerminalPanel(loadedSettings.panelVisibility.terminalPanel ?? false);
          setShowDevPlanPanel(loadedSettings.panelVisibility.devPlanPanel ?? false);
        }
        setCurrentTheme(loadedSettings.theme || 'system');
        // panelLayoutsForPersistence is removed, autoSaveId handles this now
        setChatHistoryForPersistence(loadedSettings.chatHistory || []);
        setOpenEditorFilePathsForPersistence(loadedSettings.openFilePaths || []); // Corrected property name
        setActiveEditorFileIdForPersistence(loadedSettings.activeFileId || null); // Corrected property name
        setOpenedFolderPath(loadedSettings.openedFolderPath || '');
      }
    };
    loadSettings();
  }, []);

  // --- Save settings on change ---
  const saveCurrentAppSettings = () => {
    const settingsToSave: AppSettings = {
      panelVisibility: {
        fileExplorer: showFileExplorer,
        outlineView: showOutlineView,
        chatPanel: showChatPanel,
        terminalPanel: showTerminalPanel,
        devPlanPanel: showDevPlanPanel,
      },
      theme: currentTheme,
      // panelLayouts is removed, autoSaveId handles this now
      chatHistory: chatHistoryForPersistence,
      openFilePaths: openEditorFilePathsForPersistence, // Corrected property name
      activeFileId: activeEditorFileIdForPersistence, // Corrected property name
      openedFolderPath,
      // windowBounds and isMaximized are not saved from renderer
    };
    window.electronAPI?.saveAppSettings(settingsToSave);
  };

  const debouncedSaveSettings = useRef(debounce(saveCurrentAppSettings, 1000)).current;

  useEffect(() => {
    debouncedSaveSettings();
  }, [openedFolderPath, showFileExplorer, showOutlineView, showChatPanel, showTerminalPanel, showDevPlanPanel, chatHistoryForPersistence, openEditorFilePathsForPersistence, activeEditorFileIdForPersistence, currentTheme]);


  const handleToggleMenu = () => { 
    try {
      const hamburgerButton = document.querySelector('.title-bar button:first-child'); 
      if (hamburgerButton && window.electronAPI?.showAppMenu) {
        const rect = hamburgerButton.getBoundingClientRect();
        console.log('Showing menu at position:', { x: rect.left, y: rect.bottom });
        // Call the method and ignore the Promise since we can't await it here
        void window.electronAPI.showAppMenu({ x: Math.round(rect.left), y: Math.round(rect.bottom) });
      } else if (window.electronAPI?.showAppMenu) {
        console.log('Showing menu at default position');
        // Call the method and ignore the Promise since we can't await it here
        void window.electronAPI.showAppMenu();
      } else {
        console.error('window.electronAPI.showAppMenu is not available');
      }
    } catch (error) {
      console.error('Error in handleToggleMenu:', error);
    }
  };
  const handleToggleFileExplorer = () => {
    const nextShowFileExplorer = !showFileExplorer;
    setShowFileExplorer(nextShowFileExplorer);

    if (nextShowFileExplorer) {
      fileExplorerPanelRef.current?.expand();
      if (!showOutlineView) { // If outline is hidden, expanding FE means expanding the container
        leftSidebarContainerPanelRef.current?.expand();
      }
    } else {
      fileExplorerPanelRef.current?.collapse();
      if (!showOutlineView) { // If outline is also hidden (or becoming hidden), collapse container
        leftSidebarContainerPanelRef.current?.collapse();
      }
    }
  };
  const handleToggleOutlineView = () => {
    const nextShowOutlineView = !showOutlineView;
    setShowOutlineView(nextShowOutlineView);

    if (nextShowOutlineView) {
      outlineViewPanelRef.current?.expand();
      if (!showFileExplorer) { // If file explorer is hidden, expanding OV means expanding the container
        leftSidebarContainerPanelRef.current?.expand();
      }
    } else {
      outlineViewPanelRef.current?.collapse();
      if (!showFileExplorer) { // If file explorer is also hidden (or becoming hidden), collapse container
        leftSidebarContainerPanelRef.current?.collapse();
      }
    }
  };
  const handleToggleChatPanel = () => {
    const nextShowChatPanel = !showChatPanel;
    setShowChatPanel(nextShowChatPanel);
    if (nextShowChatPanel) {
      chatPanelRef.current?.expand();
    } else {
      chatPanelRef.current?.collapse();
    }
  };
  const handleToggleTerminalPanel = () => {
    const nextShowTerminalPanel = !showTerminalPanel;
    setShowTerminalPanel(nextShowTerminalPanel);
    if (nextShowTerminalPanel) {
      terminalPanelRef.current?.expand();
    } else {
      terminalPanelRef.current?.collapse();
    }
  };
  const handleToggleDevPlanPanel = () => {
    const nextShowDevPlanPanel = !showDevPlanPanel;
    setShowDevPlanPanel(nextShowDevPlanPanel);
    if (nextShowDevPlanPanel) {
      devPlanPanelRef.current?.expand();
    } else {
      devPlanPanelRef.current?.collapse();
    }
  };
  
  useEffect(() => { 
    const forceResize = () => requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    forceResize(); 

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
  // Re-run this effect if any pane visibility changes to ensure layout recalculates
  }, [showFileExplorer, showOutlineView, showChatPanel, showTerminalPanel, showDevPlanPanel]); 

  const handleOpenFileInEditor = (file: DirectoryItem) => { 
    if (file.isFile) {
      setFileToOpenInEditor(file); 
    }
  };
  const handleOpenFolder = async () => { 
    try {
      console.log('Opening folder dialog...');
      const selectedPath = await window.electronAPI?.openFolderDialog();
      console.log('Selected path:', selectedPath);
      if (selectedPath) {
        setOpenedFolderPath(selectedPath);
        setFileToOpenInEditor(null); 
        setEditorSymbols([]);
      } else {
        console.log('No folder selected');
      }
    } catch (error) {
      console.error('Error in handleOpenFolder:', error);
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
    if (currentEditor && symbol.range && monacoApi) { 
        currentEditor.revealRangeInCenterIfOutsideViewport(symbol.range, monacoApi.editor.ScrollType.Smooth);
        currentEditor.setPosition({ lineNumber: symbol.range.startLineNumber, column: symbol.range.startColumn });
        currentEditor.focus();
    } else {
        console.warn("Cannot navigate to symbol: Editor instance, symbol range, or monacoApi not available");
    }
  };
  
  const isLeftSidebarStackActuallyVisible = showFileExplorer || showOutlineView;

  return (
    <div className="app-container">
      <TitleBar 
        onToggleMenu={handleToggleMenu} 
        onToggleFileExplorer={handleToggleFileExplorer}
        onToggleOutlineView={handleToggleOutlineView}
        onToggleChatPanel={handleToggleChatPanel}
        onToggleTerminalPanel={handleToggleTerminalPanel}
        onToggleDevPlanPanel={handleToggleDevPlanPanel}
      />
      
      <PanelGroup 
        direction="horizontal" 
        ref={mainHorizontalPanelGroupRef} // Added ref
        className="main-content-area"
        id={MAIN_HORIZONTAL_PANEL_GROUP_ID} 
        autoSaveId={MAIN_HORIZONTAL_PANEL_GROUP_ID} // Added autoSaveId
      >
        {isLeftSidebarStackActuallyVisible && (
          <React.Fragment key="left-sidebar-fragment">
            <Panel 
              ref={leftSidebarContainerPanelRef} // Added ref
              key="left-sidebar-container-panel" 
              id="left-sidebar-container-panel" 
              defaultSize={20} // Simplified defaultSize, autoSave will handle persisted
              minSize={15} 
              collapsible 
              order={1}
            >
              <PanelGroup 
                id={LEFT_SIDEBAR_STACK_PANEL_GROUP_ID} 
                direction="vertical" 
                ref={leftSidebarStackGroupRef}
                autoSaveId={LEFT_SIDEBAR_STACK_PANEL_GROUP_ID} // Added autoSaveId
              >
                {showFileExplorer && (
                  <>
                    <Panel 
                        ref={fileExplorerPanelRef} // Added ref
                        defaultSize={showOutlineView ? 65 : 100} // Simplified defaultSize
                        minSize={20} id={LEFT_SIDEBAR_FILE_EXPLORER_ID} collapsible order={1}> 
                      <FileExplorer 
                        onOpenFile={handleOpenFileInEditor} 
                        rootPathToLoad={openedFolderPath}
                        onAddPathToChatContext={handleAddPathToChatContext} 
                      />
                    </Panel>
                    {showOutlineView && <PanelResizeHandle key="left-sidebar-resize-handle" className="panel-resize-handle" style={{height: '4px'}}/>}
                  </>
                )}
                {showOutlineView && (
                  <Panel 
                    ref={outlineViewPanelRef} // Added ref
                    defaultSize={showFileExplorer ? 35 : 100} // Simplified defaultSize
                    minSize={15} id={LEFT_SIDEBAR_OUTLINE_VIEW_ID} collapsible order={2}> 
                    <OutlineView symbols={editorSymbols} onSymbolClick={handleSymbolClick} />
                  </Panel>
                )}
              </PanelGroup>
            </Panel>
            <PanelResizeHandle key="left-main-resize-handle" className="panel-resize-handle" style={{width: '4px'}}/>
          </React.Fragment>
        )}

        {showChatPanel && (
          <>
            <Panel 
              ref={chatPanelRef} // Added ref
              defaultSize={25} // Simplified defaultSize
              minSize={20} id={CHAT_PANEL_ID} collapsible order={2}
            >
              <ChatWindow 
                chatInputRef={chatInputRef} 
                initialHistory={chatHistoryForPersistence} 
                onHistoryChange={setChatHistoryForPersistence} 
              /> 
            </Panel>
            <PanelResizeHandle key="chat-main-resize-handle" className="panel-resize-handle" style={{width: '4px'}}/>
          </>
        )}

        <Panel minSize={30} id="centerStackContainer" order={3}> {/* Changed ID for clarity */}
          <PanelGroup 
            direction="vertical" 
            id={CENTER_STACK_PANEL_GROUP_ID} 
            ref={centerStackPanelGroupRef} // Added ref
            autoSaveId={CENTER_STACK_PANEL_GROUP_ID} // Added autoSaveId
          >
            <Panel 
                defaultSize={showTerminalPanel ? 70 : 100} // Simplified defaultSize
                minSize={30} id={EDITOR_PANEL_ID} order={1}> 
                 <EditorArea 
                    fileToOpen={fileToOpenInEditor} 
                    isFolderCurrentlyOpen={!!openedFolderPath} 
                    onOpenFolder={handleOpenFolder} 
                    onEditorSymbolsChange={setEditorSymbols}
                    editorRef={editorInstanceRef}
                    initialOpenFiles={openEditorFilePathsForPersistence} 
                    initialActiveFileId={activeEditorFileIdForPersistence} 
                    onOpenFilesChange={setOpenEditorFilePathsForPersistence} 
                    onActiveFileChange={setActiveEditorFileIdForPersistence} 
                 />
            </Panel>
            {showTerminalPanel && ( 
                <>
                    <PanelResizeHandle key="center-terminal-resize-handle" className="panel-resize-handle" style={{height: '4px'}}/>
                    <Panel 
                        ref={terminalPanelRef} // Added ref
                        defaultSize={30} // Simplified defaultSize
                        minSize={15} id={TERMINAL_PANEL_ID} collapsible order={2} className="terminal-panel-wrapper">
                      <Terminal />
                    </Panel>
                </>
            )}
          </PanelGroup>
        </Panel>
        
        {showDevPlanPanel && (
            <>
                <PanelResizeHandle key="main-dev-plan-resize-handle" className="panel-resize-handle" style={{width: '4px'}} />
                <Panel 
                    ref={devPlanPanelRef} // Added ref
                    defaultSize={20} // Simplified defaultSize
                    minSize={15} id={DEV_PLAN_PANEL_ID} collapsible order={4}>
                    <DevelopmentPlanPane />
                </Panel>
            </>
        )}
      </PanelGroup>
    </div>
  );
};

export default App;

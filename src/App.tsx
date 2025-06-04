// src/App.tsx 
import React, { useState, useEffect, useRef } from 'react'; 
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

  const [panelLayoutsForPersistence, setPanelLayoutsForPersistence] = useState<PanelLayout>({});


  // --- Load settings on mount ---
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await window.electronAPI?.getAppSettings();
      if (settings) {
        console.log("Loaded settings:", settings);
        if (settings.openedFolderPath !== undefined) setOpenedFolderPath(settings.openedFolderPath);
        if (settings.panelVisibility) {
          setShowFileExplorer(settings.panelVisibility.fileExplorer ?? true);
          setShowOutlineView(settings.panelVisibility.outlineView ?? false); 
          setShowChatPanel(settings.panelVisibility.chatPanel ?? true);
          setShowTerminalPanel(settings.panelVisibility.terminalPanel ?? true);
          setShowDevPlanPanel(settings.panelVisibility.devPlanPanel ?? true);
        }
        if (settings.panelLayouts) {
            setPanelLayoutsForPersistence(settings.panelLayouts);
        }
        if (settings.chatHistory) setChatHistoryForPersistence(settings.chatHistory); 
        if (settings.openFilePaths) setOpenEditorFilePathsForPersistence(settings.openFilePaths); 
        if (settings.activeFileId !== undefined) setActiveEditorFileIdForPersistence(settings.activeFileId); 
      }
    };
    loadSettings();
  }, []);

  // --- Save settings on change ---
  const saveCurrentAppSettings = () => {
    const currentSettings: Partial<AppSettings> = {
      openedFolderPath,
      panelVisibility: {
        fileExplorer: showFileExplorer,
        outlineView: showOutlineView,
        chatPanel: showChatPanel,
        terminalPanel: showTerminalPanel,
        devPlanPanel: showDevPlanPanel,
      },
      panelLayouts: panelLayoutsForPersistence, 
      chatHistory: chatHistoryForPersistence, 
      openFilePaths: openEditorFilePathsForPersistence, 
      activeFileId: activeEditorFileIdForPersistence, 
    };
    window.electronAPI?.saveAppSettings(currentSettings);
  };

  const debouncedSaveSettings = useRef(debounce(saveCurrentAppSettings, 1000)).current;

  useEffect(() => {
    debouncedSaveSettings();
  }, [openedFolderPath, showFileExplorer, showOutlineView, showChatPanel, showTerminalPanel, showDevPlanPanel, chatHistoryForPersistence, openEditorFilePathsForPersistence, activeEditorFileIdForPersistence, panelLayoutsForPersistence]);


  const handleToggleMenu = () => { 
    const hamburgerButton = document.querySelector('.title-bar button:first-child'); 
    if (hamburgerButton && window.electronAPI?.showAppMenu) {
        const rect = hamburgerButton.getBoundingClientRect();
        window.electronAPI.showAppMenu({ x: Math.round(rect.left), y: Math.round(rect.bottom) });
    } else if (window.electronAPI?.showAppMenu) {
        window.electronAPI.showAppMenu(); 
    }
  };
  const handleToggleFileExplorer = () => setShowFileExplorer(prev => !prev);
  const handleToggleOutlineView = () => setShowOutlineView(prev => !prev);
  const handleToggleChatPanel = () => setShowChatPanel(prev => !prev);
  const handleToggleTerminalPanel = () => setShowTerminalPanel(prev => !prev);
  const handleToggleDevPlanPanel = () => setShowDevPlanPanel(prev => !prev);
  
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
        className="main-content-area"
        id={MAIN_HORIZONTAL_PANEL_GROUP_ID} 
        onLayout={(layout: number[]) => {
            setPanelLayoutsForPersistence(prev => ({...prev, [MAIN_HORIZONTAL_PANEL_GROUP_ID]: layout}));
        }}
      >
        {isLeftSidebarStackActuallyVisible && ( 
          <>
            <Panel 
              defaultSize={panelLayoutsForPersistence?.[MAIN_HORIZONTAL_PANEL_GROUP_ID]?.[0] ?? 20} 
              minSize={15} id={LEFT_SIDEBAR_STACK_PANEL_GROUP_ID} collapsible order={1}
            >
              <PanelGroup 
                direction="vertical" 
                id={LEFT_SIDEBAR_STACK_PANEL_GROUP_ID} 
                onLayout={(layout: number[]) => {
                    setPanelLayoutsForPersistence(prev => ({...prev, [LEFT_SIDEBAR_STACK_PANEL_GROUP_ID]: layout}));
                }}
              >
                {showFileExplorer && (
                  <>
                    <Panel 
                        defaultSize={panelLayoutsForPersistence?.[LEFT_SIDEBAR_STACK_PANEL_GROUP_ID]?.[0] ?? (showOutlineView ? 65 : 100)} 
                        minSize={20} id={LEFT_SIDEBAR_FILE_EXPLORER_ID} collapsible order={1}> 
                      <FileExplorer 
                        onOpenFile={handleOpenFileInEditor} 
                        rootPathToLoad={openedFolderPath}
                        onAddPathToChatContext={handleAddPathToChatContext} 
                      />
                    </Panel>
                    {showOutlineView && <PanelResizeHandle className="panel-resize-handle" style={{height: '4px'}}/>}
                  </>
                )}
                {showOutlineView && (
                  <Panel 
                    defaultSize={panelLayoutsForPersistence?.[LEFT_SIDEBAR_STACK_PANEL_GROUP_ID]?.[showFileExplorer ? 1 : 0] ?? (showFileExplorer ? 35 : 100)} 
                    minSize={15} id={LEFT_SIDEBAR_OUTLINE_VIEW_ID} collapsible order={2}> 
                    <OutlineView symbols={editorSymbols} onSymbolClick={handleSymbolClick} />
                  </Panel>
                )}
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="panel-resize-handle" style={{width: '4px'}}/>
          </>
        )}

        {showChatPanel && (
          <>
            <Panel 
              defaultSize={panelLayoutsForPersistence?.[MAIN_HORIZONTAL_PANEL_GROUP_ID]?.[isLeftSidebarStackActuallyVisible ? 1 : 0] ?? 25} 
              minSize={20} id={CHAT_PANEL_ID} collapsible order={2}
            >
              <ChatWindow 
                chatInputRef={chatInputRef} 
                initialHistory={chatHistoryForPersistence} 
                onHistoryChange={setChatHistoryForPersistence} 
              /> 
            </Panel>
            <PanelResizeHandle className="panel-resize-handle" style={{width: '4px'}}/>
          </>
        )}

        <Panel minSize={30} id="centerStackContainer" order={3}> {/* Changed ID for clarity */}
          <PanelGroup 
            direction="vertical" 
            id={CENTER_STACK_PANEL_GROUP_ID} 
            onLayout={(layout: number[]) => {
                setPanelLayoutsForPersistence(prev => ({...prev, [CENTER_STACK_PANEL_GROUP_ID]: layout}));
            }}
          >
            <Panel 
                defaultSize={panelLayoutsForPersistence?.[CENTER_STACK_PANEL_GROUP_ID]?.[0] ?? (showTerminalPanel ? 70 : 100)} 
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
                    <PanelResizeHandle className="panel-resize-handle" style={{height: '4px'}}/>
                    <Panel 
                        defaultSize={panelLayoutsForPersistence?.[CENTER_STACK_PANEL_GROUP_ID]?.[1] ?? 30} 
                        minSize={15} id={TERMINAL_PANEL_ID} collapsible order={2} className="terminal-panel-wrapper">
                      <Terminal />
                    </Panel>
                </>
            )}
          </PanelGroup>
        </Panel>
        
        {showDevPlanPanel && (
            <>
                <PanelResizeHandle className="panel-resize-handle" style={{width: '4px'}} />
                <Panel 
                    defaultSize={panelLayoutsForPersistence?.[MAIN_HORIZONTAL_PANEL_GROUP_ID]?.[(isLeftSidebarStackActuallyVisible ? 1 : 0) + (showChatPanel ? 1 : 0) + 1] ?? 20} 
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

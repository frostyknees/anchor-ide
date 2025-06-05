// src/App.tsx 
/// <reference path="./types/index.ts" />
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

// Define type for Terminal component handles
interface TerminalComponentHandles {
  fitTerminal: () => void;
  focusTerminal: () => void;
}


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
  const terminalComponentRef = useRef<TerminalComponentHandles>(null); // Ref for Terminal component instance
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
  const initialWorkspaceStateFetchedRef = useRef(false);

  const handleOpenFilesChangeForPersistence = useCallback((newOpenFilePaths: string[]) => {
    setOpenEditorFilePathsForPersistence(currentPaths => {
      if (currentPaths.length === newOpenFilePaths.length && currentPaths.every((val, index) => val === newOpenFilePaths[index])) {
        return currentPaths; // Avoid update if content is identical
      }
      console.log('[App.tsx] Propagated open files CHANGED, updating state for persistence:', newOpenFilePaths);
      return newOpenFilePaths;
    });
  }, []); // setOpenEditorFilePathsForPersistence is stable

  const handleActiveFileChangeForPersistence = useCallback((newActiveFileId: string | null) => {
    setActiveEditorFileIdForPersistence(currentActiveId => {
      if (currentActiveId === newActiveFileId) {
        return currentActiveId; // Avoid update if value is identical
      }
      console.log('[App.tsx] Propagated active file CHANGED, updating state for persistence:', newActiveFileId);
      return newActiveFileId;
    });
  }, []); // setActiveEditorFileIdForPersistence is stable
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>('system');

  // --- Load settings on mount ---
  useEffect(() => {
    const loadSettings = async () => {
      const loadedSettings = await window.electronAPI?.getAppSettings();
      if (loadedSettings) {
        console.log("[App.tsx] Loaded settings:", loadedSettings);
        const storedTheme = loadedSettings.theme;
        if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
          setCurrentTheme(storedTheme);
        } else {
          setCurrentTheme('system'); // Fallback for invalid or missing theme
        }
        setChatHistoryForPersistence(loadedSettings.chatHistory || []);
        // openedFolderPath, openFilePaths, activeFileId, and panelVisibility
        // are restored via dedicated IPC listeners or are not part of AppSettings.
      } else {
        // If no settings loaded at all, try to get initial theme
        console.log('[App.tsx] loadSettings: Attempting to get initial theme.');
        const initialThemeBoolean = await window.electronAPI?.getInitialTheme();
        if (initialThemeBoolean !== undefined) {
          setCurrentTheme(initialThemeBoolean ? 'dark' : 'light');
        } else {
          setCurrentTheme('system'); // Fallback if API call fails or returns undefined
        }
      }
    };
    loadSettings();
  }, []); // No dependencies, runs once on mount to load initial settings

  // --- Fetch initial open files and active file on mount ---
  useEffect(() => { // Fetches initial workspace state (open files, active file, folder path)
    const fetchInitialWorkspaceState = async () => {
      if (initialWorkspaceStateFetchedRef.current) {
        console.log('[App.tsx] Initial workspace state fetch already attempted, skipping.');
        return;
      }
      initialWorkspaceStateFetchedRef.current = true;
      console.log('[App.tsx] Attempting to fetch initial workspace state for the first time...');
      try {
        const openFiles = await window.electronAPI?.getOpenFiles();
        if (openFiles && Array.isArray(openFiles)) {
          console.log('[App.tsx] Fetched initial open files:', openFiles);
          setOpenEditorFilePathsForPersistence(openFiles);
        } else {
          console.log('[App.tsx] No initial open files found or invalid format.');
          setOpenEditorFilePathsForPersistence([]); // Ensure it's an empty array if nothing is found
        }

        const activeFile = await window.electronAPI?.getActiveFile();
        if (activeFile) {
          console.log('[App.tsx] Fetched initial active file:', activeFile);
          setActiveEditorFileIdForPersistence(activeFile);
        } else {
          console.log('[App.tsx] No initial active file found.');
          setActiveEditorFileIdForPersistence(null); // Ensure it's null if nothing is found
        }
      } catch (error) {
        console.error('[App.tsx] Error fetching initial workspace state:', error);
        setOpenEditorFilePathsForPersistence([]);
        setActiveEditorFileIdForPersistence(null);
      }
    };

    fetchInitialWorkspaceState();
  }, []);

  // --- Save settings on change (general app settings like theme, chat history) ---
  const saveCurrentAppSettingsInternal = useCallback(async () => {
    const settingsToSave: Partial<AppSettings> = {
      theme: currentTheme,
      chatHistory: chatHistoryForPersistence,
      // openedFolderPath, openFilePaths, activeFileId are persisted via dedicated IPCs
      // panelVisibility is not part of AppSettings
    };
    console.log('[App.tsx] (Debounced) Saving general app settings:', settingsToSave);
    // Ensure window.electronAPI and saveAppSettings are defined before calling
    if (window.electronAPI && typeof window.electronAPI.saveAppSettings === 'function') {
      await window.electronAPI.saveAppSettings(settingsToSave);
    } else {
      console.warn('[App.tsx] window.electronAPI.saveAppSettings is not available. Skipping save.');
    }
  }, [currentTheme, chatHistoryForPersistence]); // Dependencies for useCallback

  const debouncedSaveAppSettings = useMemo(() => {
    // This console.log helps verify if the debounced function is recreated too often.
    // console.log('[App.tsx] Re-creating debouncedSaveAppSettings function.');
    return debounce(saveCurrentAppSettingsInternal, 1000);
  }, [saveCurrentAppSettingsInternal]); // Dependency for useMemo

  useEffect(() => {
    // console.log('[App.tsx] Settings save effect triggered. Calling actual debounced function.');
    debouncedSaveAppSettings();
    // This effect should run when debouncedSaveAppSettings (the function itself) changes.
    // This happens when saveCurrentAppSettingsInternal changes, which happens when currentTheme or chatHistoryForPersistence changes.
  }, [debouncedSaveAppSettings]);

  // --- Save opened folder path to main process via dedicated IPC ---
  useEffect(() => {
    if (openedFolderPath !== null) { // Only save if a folder is actually open
      console.log('[App.tsx] Persisting opened folder path via IPC:', openedFolderPath);
      window.electronAPI?.saveOpenedFolder(openedFolderPath);
    }
    // We might also want to explicitly save 'null' if the folder is closed,
    // depending on how the main process handles null values for restoration.
    // For now, only saving actual paths.
  }, [openedFolderPath]);

  // --- Save open files to main process via dedicated IPC ---
  useEffect(() => {
    const saveFiles = async () => {
      console.log(`[App.tsx] SAVE_OPEN_FILES effect triggered. Persisting (async):`, openEditorFilePathsForPersistence);
      if (window.electronAPI && typeof window.electronAPI.saveOpenFiles === 'function') {
        try {
          const success = await window.electronAPI.saveOpenFiles(openEditorFilePathsForPersistence);
          console.log('[App.tsx] IPC saveOpenFiles success:', success);
        } catch (error) {
          console.error('[App.tsx] Error calling saveOpenFiles:', error);
        }
      }
    };
    saveFiles();
  }, [openEditorFilePathsForPersistence]);

  // --- Save active file to main process via dedicated IPC ---
  useEffect(() => {
    console.log('[App.tsx] Persisting active file via IPC:', activeEditorFileIdForPersistence);
    window.electronAPI?.saveActiveFile(activeEditorFileIdForPersistence);
  }, [activeEditorFileIdForPersistence]);

  // --- Restore workspace state from main process ---
  useEffect(() => {
    const cleanupRestoreFolder = window.electronAPI?.onRestoreOpenedFolder(async (folderPath: string) => {
      console.log('[App.tsx] Restoring opened folder via IPC:', folderPath);
      setOpenedFolderPath(folderPath);

      // Load open files and active file for the restored folder
      const openFiles = await window.electronAPI?.getOpenFiles();
      if (openFiles && openFiles.length > 0) {
        console.log(`[App.tsx] Restored open files for ${folderPath}:`, openFiles);
        setOpenEditorFilePathsForPersistence(openFiles);
      } else {
        console.log(`[App.tsx] No open files found in store for ${folderPath}, or list is empty.`);
        setOpenEditorFilePathsForPersistence([]); // Ensure it's reset if nothing found or empty
      }

      const activeFile = await window.electronAPI?.getActiveFile();
      if (activeFile) {
        console.log(`[App.tsx] Restored active file for ${folderPath}: ${activeFile}`);
        setActiveEditorFileIdForPersistence(activeFile);
      } else {
        console.log(`[App.tsx] No active file found in store for ${folderPath}.`);
        setActiveEditorFileIdForPersistence(null); // Ensure it's reset
      }
    });

    const cleanupRestoreFiles = window.electronAPI?.onRestoreOpenFiles((filePaths: string[]) => {
      console.log('[App.tsx] Restoring open files via IPC:', filePaths);
      setOpenEditorFilePathsForPersistence(filePaths);
    });

    const cleanupRestoreActive = window.electronAPI?.onRestoreActiveFile((activeFileId: string | null) => {
      console.log('[App.tsx] Restoring active file via IPC:', activeFileId);
      setActiveEditorFileIdForPersistence(activeFileId);
    });

    return () => {
      cleanupRestoreFolder();
      cleanupRestoreFiles();
      cleanupRestoreActive();
    };
  }, []);

  // --- Menu and Panel Toggling ---
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
    if (file.type === 'file') {
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

        <Panel minSize={30} id="centerStackContainer" order={3}>
          <PanelGroup
            direction="vertical"
            id={CENTER_STACK_PANEL_GROUP_ID}
            ref={centerStackPanelGroupRef}
            autoSaveId={CENTER_STACK_PANEL_GROUP_ID}
          >
            <Panel
              defaultSize={showTerminalPanel ? 70 : 100} // Adjusted based on terminal visibility
              minSize={30}
              id={EDITOR_PANEL_ID}
              order={1}
            >
              <EditorArea
                fileToOpen={fileToOpenInEditor}
                isFolderCurrentlyOpen={!!openedFolderPath}
                onOpenFolder={handleOpenFolder} // Make sure handleOpenFolder is the correct function
                onEditorSymbolsChange={setEditorSymbols}
                editorRef={editorInstanceRef}
                initialOpenFiles={openEditorFilePathsForPersistence}
                initialActiveFileId={activeEditorFileIdForPersistence}
                onOpenFilesChange={handleOpenFilesChangeForPersistence} // Optimized
                onActiveFileChange={handleActiveFileChangeForPersistence} // Optimized
              />
            </Panel>
            <PanelResizeHandle key="center-terminal-resize-handle" className="panel-resize-handle" style={{height: '4px'}}/>
            <Panel
              ref={terminalPanelRef}
              defaultSize={30}
              minSize={15}
              id={TERMINAL_PANEL_ID}
              collapsible
              order={2}
              className="terminal-panel-wrapper"
              onExpand={() => {
                console.log('[App.tsx] Terminal panel expanded, calling fitTerminal and focusTerminal.');
                terminalComponentRef.current?.fitTerminal();
                setTimeout(() => {
                  terminalComponentRef.current?.focusTerminal();
                }, 50);
              }}
              onCollapse={() => {
                console.log('[App.tsx] Terminal panel collapsed.');
              }}
            >
              <Terminal ref={terminalComponentRef} />
            </Panel>
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

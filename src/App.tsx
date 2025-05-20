// src/App.tsx
import React, { useState, useEffect, useRef, CSSProperties } from 'react'; 
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Editor from '@monaco-editor/react';
import { Terminal as XTermTerminal, ITerminalOptions } from '@xterm/xterm'; 
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// --- Declare electronAPI to TypeScript ---
interface DirectoryItem {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  path: string;
}
declare global {
  interface Window {
    electronAPI?: {
      onUpdateTheme: (callback: (isDarkMode: boolean) => void) => (() => void); 
      getInitialTheme: () => Promise<boolean>;
      toggleDarkMode: () => Promise<boolean>;
      setSystemTheme: () => Promise<void>;
      showAppMenu: (position?: { x: number; y: number }) => void;
      openFolderDialog: () => Promise<string | undefined>;
      readDir: (dirPath: string) => Promise<DirectoryItem[] | { error: string }>;
      readFile: (filePath: string) => Promise<{ content: string } | { error: string }>;
      ptyHostWrite: (data: string) => void;
      ptyHostResize: (cols: number, rows: number) => void;
      onPtyHostData: (callback: (data: string | Uint8Array) => void) => (() => void); 
      ptyHostInit: () => void;
      send: (channel: string, data?: any) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, func: (...args: any[]) => void) => (() => void); 
    };
  }
}

// --- Constants for Panel IDs ---
const LEFT_SIDEBAR_STACK_ID = "leftSidebarStack"; 
const FILE_EXPLORER_PANEL_ID = "fileExplorerPanel";
const OUTLINE_VIEW_PANEL_ID = "outlineViewPanel";
const CHAT_PANEL_ID = "chatPanel"; 
const EDITOR_AREA_PANEL_ID = "editorAreaPanel";
const TERMINAL_PANEL_ID = "terminalPanel";
const DEV_PLAN_PANEL_ID = "devPlanPanel";

// Define a custom style type for Electron's -webkit-app-region
interface ElectronDraggableStyle extends CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag'; 
}

// Helper function to get basename from a path string
const getBasename = (filePath: string): string => {
  if (!filePath) return '';
  // Replace backslashes with forward slashes for consistency
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  // Get the last part, or the second to last if there's a trailing slash
  return parts[parts.length - 1] || parts[parts.length - 2] || ''; 
};


// --- Custom Title Bar Component ---
const TitleBar: React.FC<{ onToggleMenu: () => void, onTogglePanes: () => void }> = ({ onToggleMenu, onTogglePanes }) => {
  const titleBarStyle: ElectronDraggableStyle = {
    height: '32px',
    backgroundColor: 'var(--anchor-primary)', 
    color: 'var(--anchor-text-on-primary)', 
    WebkitAppRegion: 'drag', 
    userSelect: 'none',
  };

  const buttonStyle: ElectronDraggableStyle = {
    WebkitAppRegion: 'no-drag',
    color: 'var(--anchor-text-on-primary)',
    border: 'none'
  };

  return (
    <div
      className="d-flex align-items-center px-2"
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

// --- File Explorer Item Component ---
interface FileExplorerItemProps {
  item: DirectoryItem;
  onOpenItem: (item: DirectoryItem) => void;
  level: number;
}

const FileExplorerItem: React.FC<FileExplorerItemProps> = ({ item, onOpenItem, level }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<DirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (item.isDirectory) {
      const newIsOpenState = !isOpen;
      setIsOpen(newIsOpenState);
      if (newIsOpenState && children.length === 0) { 
        setIsLoading(true);
        console.log(`FileExplorerItem: Reading directory for ${item.path}`);
        const result = await window.electronAPI?.readDir(item.path);
        console.log(`FileExplorerItem: Result for ${item.path}`, result);
        if (result && !('error' in result)) {
          setChildren(result.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
            return a.isDirectory ? -1 : 1;
          }));
        } else {
          console.error("Error reading directory in FileExplorerItem:", item.path, result?.error);
        }
        setIsLoading(false);
      }
    } else { // It's a file, call onOpenItem
      onOpenItem(item);
    }
  };
  
  const handleDoubleClick = () => {
    if (item.isFile) {
        onOpenItem(item);
    } else if (item.isDirectory) {
        handleToggle(); // Expand/collapse folder on double click too
    }
  };


  const indentStyle = { paddingLeft: `${level * 20}px` };

  return (
    <div>
      <div 
        className="d-flex align-items-center py-1 px-2 file-explorer-item" 
        style={{ ...indentStyle, cursor: 'pointer' }} 
        onClick={handleToggle} 
        onDoubleClick={handleDoubleClick}
      >
        {item.isDirectory && (
          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} me-2 small`}></i>
        )}
        <i className={`bi ${item.isDirectory ? 'bi-folder-fill text-warning' : 'bi-file-earmark-code'} me-2`}></i>
        <span>{item.name}</span>
      </div>
      {isOpen && item.isDirectory && (
        <div style={{ borderLeft: '1px dashed var(--anchor-border-color)', marginLeft: `${level * 10 + 8}px`, paddingLeft: '10px' }}> 
          {isLoading && <div style={{ paddingLeft: `10px` }} className="text-muted small">Loading...</div>}
          {children.map(child => (
            <FileExplorerItem key={child.path} item={child} onOpenItem={onOpenItem} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};


// --- File Explorer Component ---
interface FileExplorerProps {
  onOpenFile: (file: DirectoryItem) => void;
  rootPathToLoad: string | null; 
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onOpenFile, rootPathToLoad }) => {
  const [rootItems, setRootItems] = useState<DirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentRootPath, setCurrentRootPath] = useState<string | null>(null);


  const loadDirectoryContents = async (dirPath: string) => {
    if (!dirPath) {
      console.log("FileExplorer: loadDirectoryContents called with no dirPath");
      return;
    }
    console.log(`FileExplorer: Loading directory contents for path: ${dirPath}`);
    setIsLoading(true);
    setCurrentRootPath(dirPath); 
    const result = await window.electronAPI?.readDir(dirPath);
    console.log(`FileExplorer: readDir result for ${dirPath}:`, result);
    if (result && !('error' in result)) {
      const rootFolderItem: DirectoryItem = {
        name: getBasename(dirPath), 
        isDirectory: true,
        isFile: false,
        path: dirPath,
      };
      setRootItems([rootFolderItem]); // Display the root folder itself
      console.log(`FileExplorer: Set root item for ${dirPath}`);
    } else {
      console.error("Error reading root directory in FileExplorer:", dirPath, result?.error);
      setRootItems([]); 
    }
    setIsLoading(false);
  };
  
  useEffect(() => {
    console.log(`FileExplorer: useEffect triggered. rootPathToLoad: ${rootPathToLoad}`);
    if (rootPathToLoad) {
      loadDirectoryContents(rootPathToLoad);
    } else {
      console.log("FileExplorer: rootPathToLoad is null, clearing items.");
      setRootItems([]);
      setCurrentRootPath(null);
    }
  }, [rootPathToLoad]);


  return (
    <div className="p-2 h-100 overflow-auto" style={{ backgroundColor: 'var(--anchor-panel-background)'}}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6>EXPLORER</h6>
      </div>
      {isLoading && <div className="text-muted small">Loading project files...</div>}
      {!isLoading && !currentRootPath && <div className="text-muted small p-2">No folder opened.</div>}
      {!isLoading && currentRootPath && rootItems.length === 0 && <div className="text-muted small p-2">Folder is empty or could not be read.</div>}
      {rootItems.map(item => ( 
        <FileExplorerItem key={item.path} item={item} onOpenItem={onOpenFile} level={0} />
      ))}
    </div>
  );
};

// --- Outline View Component ---
const OutlineView: React.FC = () => {
  return (
    <div className="p-2 h-100 overflow-auto" style={{ backgroundColor: 'var(--anchor-panel-background)', borderTop: `1px solid var(--anchor-border-color)` }}>
      <h6>OUTLINE</h6>
      <div className="text-muted small">No active editor or symbols found.</div>
    </div>
  );
};

// --- Chat Window Component ---
const ChatWindow: React.FC = () => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ sender: string, text: string }[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const handleSend = () => {
    if (message.trim() === '') return;
    const newUserMessage = { sender: 'User', text: message };
    setChatHistory(prev => [...prev, newUserMessage]);
    setMessage('');
    setIsAiThinking(true);
    
    setTimeout(() => {
      setChatHistory(prev => [...prev, { sender: 'AI', text: `Received: "${newUserMessage.text}". I am processing...` }]);
      setIsAiThinking(false);
    }, 1500);
  };

  return (
    <div className="d-flex flex-column h-100 p-2" style={{ backgroundColor: 'var(--anchor-panel-background)'}}>
      <h6>CHAT</h6>
      <div className="flex-grow-1 overflow-auto mb-2 border rounded p-2" style={{ backgroundColor: 'var(--anchor-background)'}}>
        {chatHistory.map((chat, index) => (
          <div key={index} className={`mb-2 p-2 rounded ${chat.sender === 'User' ? 'bg-light text-dark ms-auto' : 'bg-primary text-white me-auto'}`} style={{maxWidth: '80%'}}>
            <strong>{chat.sender}:</strong> {chat.text}
          </div>
        ))}
        {isAiThinking && <div className="text-muted small fst-italic">AI is thinking...</div>}
      </div>
      <div className="d-flex">
        <input
          type="text"
          className="form-control me-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isAiThinking && handleSend()}
          placeholder="Chat with AnchorAI..."
          disabled={isAiThinking}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={isAiThinking || message.trim() === ''}>
          <i className={`bi ${isAiThinking ? 'bi-stop-circle' : 'bi-send'}`}></i>
        </button>
      </div>
    </div>
  );
};

// --- Editor Area Component ---
interface EditorFile {
  id: string; 
  name: string;
  content: string;
  language?: string; 
}

interface EditorAreaProps {
  fileToOpen: DirectoryItem | null;
  onCloseWelcomeScreen: () => void; 
  showWelcomeScreen: boolean;
  onOpenFolder: () => void; 
}

const EditorArea: React.FC<EditorAreaProps> = ({ fileToOpen, onCloseWelcomeScreen, showWelcomeScreen, onOpenFolder }) => {
  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false); 
  
  useEffect(() => {
    let cleanupThemeListener: (() => void) | undefined;
    if (window.electronAPI?.getInitialTheme && window.electronAPI?.onUpdateTheme) {
        window.electronAPI.getInitialTheme().then(initialIsDark => {
            setIsDarkMode(initialIsDark);
            document.documentElement.setAttribute('data-theme', initialIsDark ? 'dark' : 'light');
        });
        cleanupThemeListener = window.electronAPI.onUpdateTheme((darkMode) => {
            setIsDarkMode(darkMode);
            document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        });
    }
    return () => {
        if (cleanupThemeListener) cleanupThemeListener();
    };
  }, []);

  useEffect(() => {
    const loadFileContent = async (fileItem: DirectoryItem) => {
      if (fileItem && fileItem.isFile) {
        if (openFiles.find(f => f.id === fileItem.path)) {
          setActiveFileId(fileItem.path);
          onCloseWelcomeScreen(); 
          return;
        }
        const result = await window.electronAPI?.readFile(fileItem.path);
        if (result && 'content' in result) {
          const newFile: EditorFile = {
            id: fileItem.path,
            name: fileItem.name,
            content: result.content,
          };
          setOpenFiles(prev => [...prev, newFile]);
          setActiveFileId(newFile.id);
          onCloseWelcomeScreen(); 
        } else {
          console.error("Error reading file for editor:", result?.error);
        }
      }
    };

    if (fileToOpen) {
      loadFileContent(fileToOpen);
    }
  }, [fileToOpen, onCloseWelcomeScreen, openFiles]); 

  const handleCloseTab = (fileIdToClose: string, event: React.MouseEvent) => {
    event.stopPropagation(); 
    setOpenFiles(prev => prev.filter(f => f.id !== fileIdToClose));
    if (activeFileId === fileIdToClose) {
      const remainingFiles = openFiles.filter(f => f.id !== fileIdToClose);
      setActiveFileId(remainingFiles.length > 0 ? remainingFiles[0].id : null);
    }
  };
  
  const activeEditorFile = openFiles.find(f => f.id === activeFileId);

  if (showWelcomeScreen && openFiles.length === 0) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center p-4">
        <img src="/src/assets/anchor_icon.png" alt="AnchorIDE Icon" style={{width: '100px', opacity: 0.5, marginBottom: '1rem'}}/>
        <h1>Welcome to AnchorIDE</h1>
        <p className="lead text-muted">Your AI-first Integrated Development Environment.</p>
        <div className="mt-4">
          <button className="btn btn-primary me-2" onClick={onOpenFolder}>
            <i className="bi bi-folder2-open me-2"></i>Open Folder
          </button>
          <button className="btn btn-outline-secondary" disabled>
            <i className="bi bi-plus-circle me-2"></i>New Project (Coming Soon)
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="d-flex flex-column flex-grow-1 h-100">
      {openFiles.length > 0 && (
        <div className="d-flex p-1" style={{ backgroundColor: 'var(--anchor-secondary)', borderBottom: `1px solid var(--anchor-border-color)`, flexShrink: 0 }}>
          {openFiles.map(file => (
            <button 
              key={file.id}
              className={`btn btn-sm me-1 ${activeFileId === file.id ? 'active' : ''}`} 
              style={{
                backgroundColor: activeFileId === file.id ? 'var(--anchor-background)' : 'var(--anchor-secondary)', 
                color: activeFileId === file.id ? 'var(--anchor-text-primary)' : 'var(--anchor-text-on-secondary)', 
                border: `1px solid ${activeFileId === file.id ? 'var(--anchor-border-color)' : 'var(--anchor-secondary)'}`,
                borderBottomColor: activeFileId === file.id ? 'var(--anchor-accent)' : 'transparent',
                borderBottomWidth: activeFileId === file.id ? '2px' : '1px',
                display: 'flex',
                alignItems: 'center'
              }}
              onClick={() => setActiveFileId(file.id)}
            >
              {file.name} 
              <i className="bi bi-x small ms-2" onClick={(e) => handleCloseTab(file.id, e)} style={{cursor: 'pointer'}}></i>
            </button>
          ))}
        </div>
      )}
      
      <div className="flex-grow-1 position-relative">
        {activeEditorFile ? (
          <Editor
            height="100%" 
            path={activeEditorFile.id} 
            defaultValue={activeEditorFile.content} 
            theme={isDarkMode ? "vs-dark" : "light"} 
            options={{ minimap: { enabled: true }, automaticLayout: true }}
          />
        ) : (
          !showWelcomeScreen && ( 
            <div className="d-flex justify-content-center align-items-center h-100">
              <div>
                <img src="/src/assets/anchor_icon.png" alt="AnchorIDE Icon" style={{width: '100px', opacity: 0.5}}/>
                <h3 style={{color: 'var(--anchor-text-secondary)'}}>AnchorIDE</h3>
                <p className="text-muted small">Open a file or folder to get started.</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

// --- Terminal Component ---
const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const xtermThemeDark: ITerminalOptions['theme'] = { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4', selectionBackground: '#555555', selectionForeground: '#ffffff' };
  const xtermThemeLight: ITerminalOptions['theme'] = { background: '#ffffff', foreground: '#333333', cursor: '#333333', selectionBackground: '#bad6fd', selectionForeground: '#000000' };

  useEffect(() => {
    let term: XTermTerminal | null = null;
    let fit: FitAddon | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let onDataDisposable: { dispose: () => void } | null = null;
    let removePtyDataListener: (() => void) | undefined;
    let removeThemeListener: (() => void) | undefined;


    const initTerminal = (currentIsDark: boolean) => {
      if (terminalRef.current && !xtermRef.current) {
        term = new XTermTerminal({
          cursorBlink: true,
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 14,
          theme: currentIsDark ? xtermThemeDark : xtermThemeLight,
          allowProposedApi: true, 
        });
        fit = new FitAddon();
        fitAddonRef.current = fit;
        term.loadAddon(fit);
        
        try {
          term.open(terminalRef.current);
          requestAnimationFrame(() => {
            fit?.fit();
             if (xtermRef.current) { 
                window.electronAPI?.ptyHostResize?.(xtermRef.current.cols, xtermRef.current.rows);
            }
          });
        } catch (e) {
          console.error("Error opening terminal or fitting:", e);
          return; 
        }
        
        term.write('AnchorIDE Terminal :: MVP\r\n$ ');
        xtermRef.current = term;

        window.electronAPI?.ptyHostInit?.();

        removePtyDataListener = window.electronAPI?.onPtyHostData?.((data) => {
          xtermRef.current?.write(typeof data === 'string' ? data : new Uint8Array(data));
        });
        
        onDataDisposable = term.onData(data => {
          window.electronAPI?.ptyHostWrite?.(data);
        });

        resizeObserver = new ResizeObserver(() => {
          try {
            fitAddonRef.current?.fit();
            if (xtermRef.current) {
                window.electronAPI?.ptyHostResize?.(xtermRef.current.cols, xtermRef.current.rows);
            }
          } catch (e) {
            console.error("Error fitting terminal on resize:", e);
          }
        });
        
        const parentElement = terminalRef.current?.parentElement;
        if (parentElement) { 
          resizeObserver.observe(parentElement);
        }
      }
    };
    
    window.electronAPI?.getInitialTheme?.().then(initialIsDark => {
        setIsDarkMode(initialIsDark);
        initTerminal(initialIsDark); 
    });

    removeThemeListener = window.electronAPI?.onUpdateTheme?.((darkMode) => {
        setIsDarkMode(darkMode);
        if (xtermRef.current && xtermRef.current.options) { 
          xtermRef.current.options.theme = darkMode ? xtermThemeDark : xtermThemeLight;
        }
    });

    return () => {
      onDataDisposable?.dispose();
      if (removePtyDataListener) removePtyDataListener();
      if (removeThemeListener) removeThemeListener();
      resizeObserver?.disconnect();
      if (xtermRef.current) { 
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []); 

  return <div ref={terminalRef} className="terminal-instance-wrapper" style={{ height: '100%', width: '100%', padding: '5px', backgroundColor: isDarkMode ? xtermThemeDark.background : xtermThemeLight.background }}></div>;
};


// --- Development Plan Pane (Placeholder) ---
const DevelopmentPlanPane: React.FC = () => {
  return (
    <div className="p-2 h-100 overflow-auto" style={{ backgroundColor: 'var(--anchor-panel-background)'}}>
      <h6>DEVELOPMENT PLAN</h6>
      <div className="text-muted small">Development Plan (Post-MVP). Pane toggle can exist.</div>
    </div>
  );
};


// --- Main App Component ---
const App: React.FC = () => {
  const [showPanes, setShowPanes] = useState(true); 
  const [fileToOpenInEditor, setFileToOpenInEditor] = useState<DirectoryItem | null>(null);
  const [openedFolderPath, setOpenedFolderPath] = useState<string | null>(null); 
  const [showWelcome, setShowWelcome] = useState(true); 


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
    const cleanupOpenFolder = window.electronAPI?.on('trigger-open-folder', handleOpenFolderFromWelcome);

    return () => {
        if (cleanupThemeListener) cleanupThemeListener();
        if (cleanupOpenFolder) cleanupOpenFolder();
    };
  }, []);

  const handleOpenFileInEditor = (file: DirectoryItem) => {
    if (file.isFile) {
      console.log("App: Opening file in editor:", file.path); // Debug log
      setFileToOpenInEditor(file); 
      setShowWelcome(false); 
    }
  };

  const handleOpenFolderFromWelcome = async () => {
    console.log("App: handleOpenFolderFromWelcome triggered"); // Debug log
    const selectedPath = await window.electronAPI?.openFolderDialog();
    console.log("App: Selected path from dialog:", selectedPath); // Debug log
    if (selectedPath) {
      setOpenedFolderPath(selectedPath);
      setShowWelcome(false); 
      console.log("App: Set openedFolderPath to:", selectedPath); // Debug log
    } else {
      console.log("App: No folder selected or dialog cancelled."); // Debug log
    }
  };
  
  const handleCloseWelcomeScreen = () => {
    setShowWelcome(false);
  }


  return (
    <div className="app-container">
      <TitleBar onToggleMenu={handleToggleMenu} onTogglePanes={handleTogglePanes} />
      
      <PanelGroup direction="horizontal" className="main-content-area">
        {showPanes && (
          <>
            <Panel defaultSize={20} minSize={15} id={LEFT_SIDEBAR_STACK_ID} collapsible>
              <PanelGroup direction="vertical">
                <Panel defaultSize={65} minSize={20} id={FILE_EXPLORER_PANEL_ID} collapsible> 
                  <FileExplorer onOpenFile={handleOpenFileInEditor} rootPathToLoad={openedFolderPath} />
                </Panel>
                <PanelResizeHandle className="panel-resize-handle" style={{height: '4px'}}/>
                <Panel defaultSize={35} minSize={15} id={OUTLINE_VIEW_PANEL_ID} collapsible> 
                  <OutlineView />
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="panel-resize-handle" style={{width: '4px'}}/>
          </>
        )}

        {showPanes && (
          <>
            <Panel defaultSize={25} minSize={20} id={CHAT_PANEL_ID} collapsible>
              <ChatWindow />
            </Panel>
            <PanelResizeHandle className="panel-resize-handle" style={{width: '4px'}}/>
          </>
        )}

        <Panel minSize={30} id={EDITOR_AREA_PANEL_ID}> 
          <PanelGroup direction="vertical">
            <Panel defaultSize={70} minSize={30} id="editorActualPanel"> 
                 <EditorArea 
                    fileToOpen={fileToOpenInEditor} 
                    onCloseWelcomeScreen={handleCloseWelcomeScreen}
                    showWelcomeScreen={showWelcome && !openedFolderPath} 
                    onOpenFolder={handleOpenFolderFromWelcome}
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


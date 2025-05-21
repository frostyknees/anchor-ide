// src/components/EditorArea.tsx
import React, { useState, useEffect} from 'react';
import Editor, { OnMount } from '@monaco-editor/react'; 
import type * as monacoApi from 'monaco-editor'; 
import type { DirectoryItem, DocumentSymbol, EditorFile } from '../types'; 
import { getFileIcon } from '../utils'; 

interface EditorAreaProps { 
  fileToOpen: DirectoryItem | null; 
  isFolderCurrentlyOpen: boolean; 
  onOpenFolder: () => void; 
  onEditorSymbolsChange: (symbols: DocumentSymbol[]) => void; // Prop remains for future use
  editorRef: React.MutableRefObject<monacoApi.editor.IStandaloneCodeEditor | null>; 
}

const EditorArea: React.FC<EditorAreaProps> = ({ fileToOpen, isFolderCurrentlyOpen, onOpenFolder, onEditorSymbolsChange, editorRef }) => {
  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false); 
  // const monacoInstanceRef = useRef<typeof monacoApi | null>(null); // Keep if needed for other monaco API calls

  const handleEditorDidMount: OnMount = (editor, _monaco) => { 
    editorRef.current = editor; 
    // monacoInstanceRef.current = monaco; // Store if needed for other monaco API calls

    // Clear symbols when editor mounts or model changes, as we are not fetching them for MVP M1.1
    onEditorSymbolsChange([]); 

    editor.onDidChangeModelContent(() => { 
      // Debounced symbol update would go here in the future
      // For now, we can clear or do nothing specific on content change for symbols
      // onEditorSymbolsChange([]); // Optionally clear if content changes rapidly
    });
    
    editor.onDidChangeModel((_e: monacoApi.editor.IModelChangedEvent) => {
        // When model changes, clear symbols
        onEditorSymbolsChange([]); 
    });
  };
  
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
        const existingFile = openFiles.find(f => f.id === fileItem.path);
        if (existingFile) {
          if (activeFileId !== fileItem.path) {
            setActiveFileId(fileItem.path);
            onEditorSymbolsChange([]); // Clear symbols when tab changes
          }
          return;
        }

        const result = await window.electronAPI?.readFile(fileItem.path);
        if (result && 'content' in result) {
          const newFile: EditorFile = {
            id: fileItem.path,
            name: fileItem.name,
            content: result.content,
          };
          setOpenFiles(prev => {
            if (prev.find(f => f.id === newFile.id)) return prev;
            return [...prev, newFile];
          });
          setActiveFileId(newFile.id); 
          onEditorSymbolsChange([]); // Clear symbols for new file, will be updated if logic is added
        } else {
          console.error("Error reading file for editor:", result?.error);
        }
      }
    };

    if (fileToOpen) {
      loadFileContent(fileToOpen);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [fileToOpen]); 

  useEffect(() => {
    if (!isFolderCurrentlyOpen) {
        setOpenFiles([]);
        setActiveFileId(null);
        onEditorSymbolsChange([]); 
    }
  }, [isFolderCurrentlyOpen, onEditorSymbolsChange]);

  // When active file ID changes, clear symbols (as we are not fetching them yet)
  useEffect(() => {
    onEditorSymbolsChange([]);
  }, [activeFileId, onEditorSymbolsChange]); 


  const handleCloseTab = (fileIdToClose: string, event: React.MouseEvent) => {
    event.stopPropagation(); 
    const newOpenFiles = openFiles.filter(f => f.id !== fileIdToClose);
    setOpenFiles(newOpenFiles);
    if (activeFileId === fileIdToClose) {
      const newActiveFileId = newOpenFiles.length > 0 ? newOpenFiles[0].id : null;
      setActiveFileId(newActiveFileId);
      if (!newActiveFileId) {
        onEditorSymbolsChange([]); 
      }
    }
  };
  
  const activeEditorFile = openFiles.find(f => f.id === activeFileId);

  if (!isFolderCurrentlyOpen && openFiles.length === 0) { 
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
              {getFileIcon(file.name, false)} 
              <span className="ms-1">{file.name}</span>
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
            onMount={handleEditorDidMount}
          />
        ) : (
          isFolderCurrentlyOpen && ( 
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

export default EditorArea;

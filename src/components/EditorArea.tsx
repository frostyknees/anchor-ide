// src/components/EditorArea.tsx
import React, { useState, useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react'; 
import type * as monacoApi from 'monaco-editor'; 
import type { DirectoryItem, DocumentSymbol, EditorFile } from '../types'; 
import { getFileIcon, getBasename } from '../utils'; 

interface EditorAreaProps { 
  fileToOpen: DirectoryItem | null; 
  isFolderCurrentlyOpen: boolean; 
  onOpenFolder: () => void; 
  onEditorSymbolsChange: (symbols: DocumentSymbol[]) => void; 
  editorRef: React.MutableRefObject<monacoApi.editor.IStandaloneCodeEditor | null>;
  // Props for state persistence
  initialOpenFiles: string[]; // Paths of files that were open
  initialActiveFileId: string | null;
  onOpenFilesChange: (openFilePaths: string[]) => void;
  onActiveFileChange: (activeFileId: string | null) => void;
}

const EditorArea: React.FC<EditorAreaProps> = ({ 
  fileToOpen, 
  isFolderCurrentlyOpen, 
  onOpenFolder, 
  onEditorSymbolsChange, 
  editorRef,
  initialOpenFiles,
  initialActiveFileId,
  onOpenFilesChange,
  onActiveFileChange
}) => {
  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false); 
  //const monacoInstanceRef = useRef<typeof monacoApi | null>(null); 
  const autoSaveTimeoutRef = useRef<number | null>(null);

  // Effect to load initial open files and set active tab from persisted state
  useEffect(() => {
    const initializeEditorStateForSession = async () => {
      if (!isFolderCurrentlyOpen) {
        setOpenFiles([]);
        setActiveFileId(null);
        return;
      }

      // Folder is open, use current initial props to set state.
      // This assumes initialOpenFiles & initialActiveFileId are the correct persisted state
      // for the *newly opened* folder session.
      if (initialOpenFiles && initialOpenFiles.length > 0) {
        const loadedFiles: EditorFile[] = [];
        for (const filePath of initialOpenFiles) {
          const result = await window.electronAPI?.readFile(filePath);
          if (result && 'content' in result) {
            loadedFiles.push({
              id: filePath,
              name: getBasename(filePath),
              content: result.content,
              isDirty: false,
            });
          } else {
            console.warn(`Could not load persisted file: ${filePath}`);
          }
        }
        setOpenFiles(loadedFiles);
        if (initialActiveFileId && loadedFiles.find(f => f.id === initialActiveFileId)) {
          setActiveFileId(initialActiveFileId);
        } else if (loadedFiles.length > 0) {
          setActiveFileId(loadedFiles[0].id);
        } else {
          setActiveFileId(null); // No active file if loadedFiles is empty
        }
      } else { // Folder is open, but no initial files to load
        setOpenFiles([]);
        setActiveFileId(null);
      }
    };

    initializeEditorStateForSession();
    // This effect now primarily depends on whether a folder session is active.
    // It reads initialOpenFiles/initialActiveFileId but doesn't list them as dependencies
    // to avoid re-triggering when they change due to this component's own updates.
    // This is a common pattern for props that are for initial setup of a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFolderCurrentlyOpen]);

  // Propagate open files and active file changes upwards for persistence
  useEffect(() => {
    onOpenFilesChange(openFiles.map(f => f.id));
  }, [openFiles, onOpenFilesChange]);

  useEffect(() => {
    onActiveFileChange(activeFileId);
  }, [activeFileId, onActiveFileChange]);


  const handleAutoSave = async (filePath: string, content: string) => {
    console.log(`Auto-saving file: ${filePath}`);
    
    if (window.electronAPI?.saveFile) {
      const result = await window.electronAPI.saveFile(filePath, content);
      if (result.success) {
        console.log(`File ${filePath} auto-saved successfully.`);
        setOpenFiles(prevFiles => 
          prevFiles.map(file => 
            file.id === filePath ? { ...file, content, isDirty: false } : file 
          )
        );
      } else {
        console.error(`Error auto-saving file ${filePath}:`, result.error);
         setOpenFiles(prevFiles => 
          prevFiles.map(file => 
            file.id === filePath ? { ...file, isDirty: true } : file 
          )
        );
      }
    } else {
      console.warn("Save file API not available. Auto-save only updated local state.");
       setOpenFiles(prevFiles => 
        prevFiles.map(file => 
          file.id === filePath ? { ...file, content, isDirty: false } : file 
        )
      );
    }
  };

  const handleEditorDidMount: OnMount = (editor, _monaco) => { 
    editorRef.current = editor; 
    // monacoInstanceRef.current = monaco; // Not strictly needed if only using editor instance
    onEditorSymbolsChange([]); 

    editor.onDidChangeModelContent(() => { 
      if (activeFileId) {
        setOpenFiles(prevFiles =>
          prevFiles.map(file =>
            file.id === activeFileId ? { ...file, isDirty: true } : file
          )
        );
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = window.setTimeout(() => {
          const currentModel = editor.getModel();
          if (currentModel && activeFileId) { 
            handleAutoSave(activeFileId, currentModel.getValue());
          }
        }, 1000); // 1000ms delay for auto-save
      }
    });
    
    editor.onDidChangeModel((_e: monacoApi.editor.IModelChangedEvent) => {
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
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }
    };
  }, []);

  useEffect(() => {
    const loadFileContent = async (fileItem: DirectoryItem) => {
      if (fileItem && fileItem.isFile) {
        const existingFile = openFiles.find(f => f.id === fileItem.path);
        if (existingFile) {
          if (activeFileId !== fileItem.path) {
            setActiveFileId(fileItem.path);
          }
          return;
        }

        const result = await window.electronAPI?.readFile(fileItem.path);
        if (result && 'content' in result) {
          const newFile: EditorFile = {
            id: fileItem.path,
            name: fileItem.name,
            content: result.content,
            isDirty: false,
          };
          setOpenFiles(prev => {
            if (prev.find(f => f.id === newFile.id)) return prev;
            return [...prev, newFile];
          });
          setActiveFileId(newFile.id); 
        } else {
          console.error("Error reading file for editor:", result?.error);
        }
      }
    };

    if (fileToOpen && fileToOpen.path !== activeFileId) { // Only load if it's a new file to open
      loadFileContent(fileToOpen);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [fileToOpen]); // Removed openFiles from dependency to avoid re-triggering on setOpenFiles

  useEffect(() => {
    if (!isFolderCurrentlyOpen) {
        setOpenFiles([]);
        setActiveFileId(null);
        onEditorSymbolsChange([]); 
    }
  }, [isFolderCurrentlyOpen, onEditorSymbolsChange]);

  useEffect(() => {
    onEditorSymbolsChange([]); // Clear symbols when active file changes, to be repopulated if needed
  }, [activeFileId, onEditorSymbolsChange]); 


  const handleCloseTab = (fileIdToClose: string, event: React.MouseEvent) => {
    event.stopPropagation(); 
    const fileToClose = openFiles.find(f => f.id === fileIdToClose);
    // @ts-ignore
    if (fileToClose && fileToClose.isDirty) {
        if (editorRef.current && activeFileId === fileIdToClose) {
            const model = editorRef.current.getModel();
            if (model) {
                handleAutoSave(fileIdToClose, model.getValue()); 
            }
        }
    }

    setOpenFiles(prev => prev.filter(f => f.id !== fileIdToClose));
    if (activeFileId === fileIdToClose) {
      const remainingFiles = openFiles.filter(f => f.id !== fileIdToClose);
      const newActiveFileId = remainingFiles.length > 0 ? remainingFiles[0].id : null;
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
              data-file-id={file.id} 
            >
              {getFileIcon(file.name, false)} 
              <span className="ms-1">{file.name}</span>
              {/* @ts-ignore */}
              {file.isDirty && <span style={{width: '8px', height: '8px', backgroundColor: 'var(--anchor-accent)', borderRadius: '50%', marginLeft: '8px', display: 'inline-block'}}></span>}
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
            // value={activeEditorFile.content} // Using defaultValue to avoid issues with cursor position during auto-save
            theme={isDarkMode ? "vs-dark" : "light"} 
            options={{ minimap: { enabled: true }, automaticLayout: true }}
            onMount={handleEditorDidMount}
            onChange={(value) => { // Optional: if you need to react to changes for controlled component
                if (activeFileId && value !== undefined) {
                    // This would be for a controlled editor, but auto-save uses getModel().getValue()
                    // For now, onDidChangeModelContent is primary driver for auto-save
                }
            }}
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
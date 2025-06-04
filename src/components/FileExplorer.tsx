// src/components/FileExplorer.tsx
import React, { useState, useEffect } from 'react';
import type { DirectoryItem, FileSystemResult } from '../types';
import FileExplorerItem from './FileExplorerItem'; // Import the item component
import { getBasename, getDirname } from '../utils';

interface FileExplorerProps {
  onOpenFile: (file: DirectoryItem) => void;
  rootPathToLoad: string | null; 
  onAddPathToChatContext: (path: string, isDirectory: boolean) => void; 
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onOpenFile, rootPathToLoad, onAddPathToChatContext }) => {
  const [rootItems, setRootItems] = useState<DirectoryItem[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [currentRootPath, setCurrentRootPath] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0); 

  const loadRootFolder = async (dirPath: string | null) => {
    if (!dirPath) {
      setRootItems([]);
      setCurrentRootPath(null);
      return;
    }
    setIsLoading(true);
    setCurrentRootPath(dirPath); 
    // Create a single root item representing the selected folder
    const rootFolderItem: DirectoryItem = {
      name: getBasename(dirPath), 
      isDirectory: true,
      isFile: false,
      path: dirPath,
      // children will be fetched by FileExplorerItem when expanded
    };
    setRootItems([rootFolderItem]); 
    setIsLoading(false);
    // The refreshNonce in FileExplorer is primarily for context menu actions (new file/folder, delete)
    // to signal to FileExplorerItem instances that they might need to refresh their children.
    // If the root path itself changes (via rootPathToLoad prop), this loadRootFolder runs.
  };
  
  useEffect(() => {
    loadRootFolder(rootPathToLoad);
  }, [rootPathToLoad]);

  const triggerRefresh = () => {
    console.log("FileExplorer: Triggering refresh via nonce.");
    setRefreshNonce(prev => prev + 1);
  };

  useEffect(() => {
    const cleanupContextMenu = window.electronAPI?.onContextMenuCommand(async (args) => {
      console.log('Context menu command received:', args);
      const parentDirForNewItems = args.isDirectory ? args.path : getDirname(args.path);
      let newName: string | null = null;
      let result: FileSystemResult | undefined;

      switch (args.command) {
        case 'new-file':
          newName = `UntitledFile_${Date.now()}.txt`; 
          if (newName && newName.trim() !== "") {
            const fullPath = `${parentDirForNewItems}/${newName.trim()}`; 
            result = await window.electronAPI?.createFile(fullPath);
            if (result?.success) triggerRefresh(); 
            else alert(`Error creating file: ${result?.error || 'Unknown error'}`);
          }
          break;
        case 'new-folder':
          newName = `NewFolder_${Date.now()}`; 
          if (newName && newName.trim() !== "") {
            const fullPath = `${parentDirForNewItems}/${newName.trim()}`; 
            result = await window.electronAPI?.createFolder(fullPath);
             if (result?.success) triggerRefresh();
            else alert(`Error creating folder: ${result?.error || 'Unknown error'}`);
          }
          break;
        case 'rename':
          alert("Rename functionality requires a custom input UI.");
          break;
        case 'delete':
          result = await window.electronAPI?.deleteItem(args.path, args.isDirectory);
          if (result?.success) triggerRefresh();
          else if (result?.error) alert(`Error deleting item: ${result.error}`);
          break;
        case 'add-to-ai-context':
          onAddPathToChatContext(args.path, args.isDirectory);
          break;
        case 'open-in-terminal':
          const pathForTerminal = args.isDirectory ? args.path : getDirname(args.path);
          window.electronAPI?.openPathInTerminal(pathForTerminal);
          break;
        default:
          console.warn("Unknown context menu command:", args.command);
      }
    });
    return () => {
      if (cleanupContextMenu) cleanupContextMenu();
    };
  }, [currentRootPath, onAddPathToChatContext]); // Ensure dependencies are correct

  return (
    <div className="p-2 h-100 overflow-auto" style={{ backgroundColor: 'var(--anchor-panel-background)'}}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6>EXPLORER</h6>
      </div>
      {isLoading && <div className="text-muted small">Loading project files...</div>}
      {!isLoading && !currentRootPath && <div className="text-muted small p-2">No folder opened.</div>}
      {rootItems.map(item => ( 
        <FileExplorerItem 
            key={item.path} 
            item={item} 
            onOpenItem={onOpenFile} 
            level={0} 
            refreshNonce={refreshNonce}
        />
      ))}
    </div>
  );
};

export default FileExplorer;
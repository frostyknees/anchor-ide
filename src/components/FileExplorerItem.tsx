// src/components/FileExplorerItem.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { DirectoryItem } from '../types';
import { getFileIcon } from '../utils'; // Assuming utils.ts is in src/

interface FileExplorerItemProps {
  item: DirectoryItem;
  onOpenItem: (item: DirectoryItem) => void;
  level: number;
  refreshNonce: number; 
}

const FileExplorerItem: React.FC<FileExplorerItemProps> = ({ item, onOpenItem, level, refreshNonce }) => {
  const [isOpen, setIsOpen] = useState(item.type === 'directory' && level === 0); 
  const [children, setChildren] = useState<DirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; }
  }, []);

  const fetchChildren = async (forceRefresh = false) => {
    if (item.type !== 'directory') return;
    if (isOpen && (children.length === 0 || forceRefresh)) {
        setIsLoading(true);
        console.log(`FileExplorerItem (${item.name}): Fetching children (force: ${forceRefresh})`);
        const result = await window.electronAPI?.readDir(item.path);
        if (!isMounted.current) return;
        if (result && !('error' in result)) {
          setChildren(result.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
          }));
        } else {
          console.error("Error reading directory in FileExplorerItem:", item.path, result?.error);
          setChildren([]); 
        }
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (item.type === 'directory' && isOpen) {
      fetchChildren(true); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshNonce]); 

  useEffect(() => {
    if (item.type === 'directory' && isOpen && children.length === 0) { 
      fetchChildren();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item.path]); 


  const handleToggle = async () => {
    if (item.type === 'directory') {
      setIsOpen((prevIsOpen: boolean) => !prevIsOpen); 
    } else { 
      onOpenItem(item);
    }
  };
  
  const handleDoubleClick = () => {
    if (item.type === 'file') onOpenItem(item);
    else if (item.type === 'directory') handleToggle(); 
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.electronAPI?.showFileExplorerContextMenu(item.path, item.type === 'directory');
  };

  const indentStyle = { paddingLeft: `${level * 20}px` };

  return (
    <div>
      <div 
        className="d-flex align-items-center py-1 px-2 file-explorer-item" 
        style={{ ...indentStyle, cursor: 'pointer' }} 
        onClick={handleToggle} 
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {item.type === 'directory' && (
          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} me-1 small`}></i> 
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          {getFileIcon(item.name, item.type === 'directory', isOpen)}
          <span>{item.name}</span>
        </span>
      </div>
      {isOpen && item.type === 'directory' && (
        <div style={{ borderLeft: '1px dashed var(--anchor-border-color)', marginLeft: `${level * 10 + 12}px`, paddingLeft: '12px' }}> 
          {isLoading && <div style={{ paddingLeft: `10px` }} className="text-muted small">Loading...</div>}
          {children.map(child => (
            <FileExplorerItem 
              key={child.path} 
              item={child} 
              onOpenItem={onOpenItem} 
              level={level + 1} 
              refreshNonce={refreshNonce}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FileExplorerItem;
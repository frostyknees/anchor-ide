// src/utils.ts
// Helper functions for the application
//import React from 'react'; 
import * as monacoApi from 'monaco-editor'; // Changed from 'import type'
import { 
  MdOutlineFolder, MdInsertDriveFile, MdCode, MdDataObject, 
  MdTextFields, MdImage, MdPictureAsPdf, MdArchive,
  MdDescription, MdLockOutline, MdSettings,
  MdFunctions, MdClass, 
  MdLabelOutline
} from 'react-icons/md'; 

export const getBasename = (filePath: string): string => {
  if (!filePath) return '';
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  return parts[parts.length - 1] || parts[parts.length - 2] || ''; 
};

export const getDirname = (filePath: string): string => {
    if (!filePath) return '';
    const normalizedPath = filePath.replace(/\\/g, '/');
    const lastSlash = normalizedPath.lastIndexOf('/');
    if (lastSlash === -1) return '.'; 
    return normalizedPath.substring(0, lastSlash);
};

export const getFileIcon = (name: string, isDirectory: boolean, _isOpen?: boolean): JSX.Element => { 
  if (isDirectory) {
    return <MdOutlineFolder className="me-2 text-warning" />; 
  }
  const extension = name.split('.').pop()?.toLowerCase();
  const isDotfileWithOnlyName = name.startsWith('.') && !name.includes('.', 1); 
  const hasNoExtension = !name.includes('.'); 
  
  let effectiveSwitchValue: string;
  if (isDotfileWithOnlyName || hasNoExtension) {
    effectiveSwitchValue = name.toLowerCase(); 
  } else {
    effectiveSwitchValue = `.${extension}`; 
  }

  switch (effectiveSwitchValue) { 
    case '.ts': case '.tsx': case '.js': case '.jsx': return <MdCode className="me-2 text-info" />;
    case '.json': return <MdDataObject className="me-2 text-success" />;
    case '.md': return <MdDescription className="me-2 text-secondary" />;
    case '.html': case '.css': case '.scss': case '.less': return <MdTextFields className="me-2 text-primary" />;
    case '.png': case '.jpg': case '.jpeg': case '.gif': case '.svg': case '.ico': return <MdImage className="me-2 text-danger" />;
    case '.pdf': return <MdPictureAsPdf className="me-2 text-danger" />;
    case '.zip': case '.tar': case '.gz': case '.rar': return <MdArchive className="me-2" style={{color: 'var(--anchor-text-secondary)'}} />;
    case '.yaml': case '.yml': return <MdDataObject className="me-2" style={{color: 'var(--anchor-info)'}}/>; 
    case '.lock': return <MdLockOutline className="me-2" style={{color: 'var(--anchor-text-secondary)'}} />;
    case '.iml': case '.xml': case '.config': case '.editorconfig': 
      return <MdSettings className="me-2 text-secondary" />;
    case '.gitignore': case '.npmrc': case '.bashrc': case '.zshrc': 
        return <MdSettings className="me-2 text-secondary" />;
    case '.txt': case '.log':
      return <MdDescription className="me-2" style={{color: 'var(--anchor-text-secondary)'}} />; 
    default:
      return <MdInsertDriveFile className="me-2" style={{ color: 'var(--anchor-text-primary)' }} />;
  }
};

export const getSymbolIcon = (kind: monacoApi.languages.SymbolKind): JSX.Element => {
    switch (kind) {
        case monacoApi.languages.SymbolKind.Function:
        case monacoApi.languages.SymbolKind.Method:
        case monacoApi.languages.SymbolKind.Constructor:
            return <MdFunctions className="me-2 text-info" />;
        case monacoApi.languages.SymbolKind.Class:
        case monacoApi.languages.SymbolKind.Interface:
        case monacoApi.languages.SymbolKind.Struct:
        case monacoApi.languages.SymbolKind.Module:
            return <MdClass className="me-2 text-warning" />;
        case monacoApi.languages.SymbolKind.Variable:
        case monacoApi.languages.SymbolKind.Constant:
        case monacoApi.languages.SymbolKind.Field:
        case monacoApi.languages.SymbolKind.Property:
            return <MdLabelOutline className="me-2 text-success" />; 
        default:
            return <MdDataObject className="me-2 text-muted" />;
    }
};

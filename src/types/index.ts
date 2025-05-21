import type * as monacoApi from 'monaco-editor';

export interface DirectoryItem {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  path: string;
}

export interface FileSystemResult { 
  success: boolean;
  path?: string;
  error?: string;
  message?: string;
}

export interface ChatInputHandle { 
  addTextToInput: (textToAdd: string) => void;
}

export interface DocumentSymbol {
  name: string;
  kind: monacoApi.languages.SymbolKind; 
  range: monacoApi.IRange;             
  children?: DocumentSymbol[]; 
}

export interface EditorFile { 
  id: string; 
  name: string; 
  content: string; 
  language?: string; 
}

export interface ElectronDraggableStyle extends React.CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag'; 
}

// Declare global electronAPI if not already in a global .d.ts file
// For a cleaner setup, consider a dedicated global.d.ts or vite-env.d.ts
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
      createFile: (filePath: string) => Promise<FileSystemResult>;
      createFolder: (folderPath: string) => Promise<FileSystemResult>;
      renameItem: (oldPath: string, newName: string) => Promise<FileSystemResult>; 
      deleteItem: (itemPath: string, isDirectory: boolean) => Promise<FileSystemResult>; 
      showFileExplorerContextMenu: (itemPath: string, isDirectory: boolean) => void;
      onContextMenuCommand: (callback: (args: {command: string, path: string, isDirectory: boolean}) => void) => (() => void); 
      openPathInTerminal: (path: string) => void; 
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
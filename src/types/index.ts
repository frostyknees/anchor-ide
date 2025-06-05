// src/types/index.ts
// This file will hold shared type definitions for the application.

import type * as monacoApi from 'monaco-editor';
import React from 'react'; 

export interface DirectoryItem {
  id: string; // Unique identifier, typically the full path
  name: string;
  type: 'directory' | 'file';
  path: string; // Full path to the item
  children?: DirectoryItem[]; // Undefined for files, or an array for directories (can be empty)
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
  isDirty?: boolean; 
}

export interface ElectronDraggableStyle extends React.CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag'; 
}

export interface PanelLayout {
  [groupId: string]: number[]; 
}

export interface AppSettings {
  windowBounds?: { width: number; height: number; x?: number; y?: number }; // Made optional for renderer saving
  isMaximized?: boolean; // Made optional for renderer saving
  openedFolderPath: string | null; // Can be null if no folder is open
  openFilePaths: string[];
  activeFileId: string | null; // Can be null if no file is active
  chatHistory: { sender: string, text: string }[];
  panelVisibility: { // Non-optional
    fileExplorer: boolean;
    outlineView: boolean;
    chatPanel: boolean;
    terminalPanel: boolean;
    devPlanPanel: boolean;
  };
  // panelLayouts is removed, react-resizable-panels autoSaveId handles this
  theme: 'light' | 'dark' | 'system'; // Non-optional
}

// API exposed from preload script
export interface ElectronAPI {
  // Theme Management
  onUpdateTheme: (callback: (isDarkMode: boolean) => void) => () => void;
  getInitialTheme: () => Promise<boolean>;
  toggleDarkMode: () => Promise<boolean>;
  setSystemTheme: () => Promise<void>;

  // Application Menu
  showAppMenu: (position?: { x: number; y: number }) => void;
  
  // Window Controls
  sendWindowControl: (action: 'minimize' | 'maximize' | 'unmaximize' | 'close') => void;
  onWindowMaximized: (callback: (isMaximized: boolean) => void) => (() => void);

  // File System Operations
  openFolderDialog: () => Promise<string | undefined>; 
  readDir: (dirPath: string) => Promise<DirectoryItem[] | { error: string }>;
  readFile: (filePath: string) => Promise<{ content: string } | { error: string }>;
  saveFile: (filePath: string, content: string) => Promise<FileSystemResult>; 
  createFile: (filePath: string) => Promise<FileSystemResult>; 
  createFolder: (folderPath: string) => Promise<FileSystemResult>; 
  renameItem: (oldPath: string, newName: string) => Promise<FileSystemResult>; 
  deleteItem: (itemPath: string, isDirectory: boolean) => Promise<FileSystemResult>; 

  // File Explorer Context Menu
  showFileExplorerContextMenu: (itemPath: string, isDirectory: boolean) => void; 
  onContextMenuCommand: (callback: (args: {command: string, path: string, isDirectory: boolean}) => void) => (() => void); 
  
  // Terminal Interaction
  openPathInTerminal: (path: string) => void; 
  initTerminal: () => void;
  writeToTerminal: (data: string) => void;
  resizeTerminal: (cols: number, rows: number) => void;
  onTerminalData: (callback: (data: string | Uint8Array) => void) => (() => void); 
  onTerminalExit: (callback: (event: { exitCode: number, signal?: number }) => void) => (() => void);
  
  // State Persistence
  getAppSettings: () => Promise<Partial<AppSettings>>;
  saveAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  saveOpenedFolder: (folderPath: string | null) => void;
  saveOpenFiles: (openFilePaths: string[]) => Promise<boolean>;
  saveActiveFile: (activeFilePath: string | null) => Promise<void>;
  getOpenFiles: () => Promise<string[] | undefined>;
  getActiveFile: () => Promise<string | null | undefined>;
  onRestoreOpenedFolder: (callback: (folderPath: string) => void) => (() => void);
  onRestoreOpenFiles: (callback: (filePaths: string[]) => void) => (() => void);
  onRestoreActiveFile: (callback: (activeFilePath: string | null) => void) => (() => void);

  // Generic IPC (less used if specific methods are exposed)
  send: (channel: string, data?: any) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, func: (...args: any[]) => void) => (() => void);
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
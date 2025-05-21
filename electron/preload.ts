// electron/preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

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

export interface ElectronAPI {
  onUpdateTheme: (callback: (isDarkMode: boolean) => void) => () => void;
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
  deleteItem: (itemPath: string, isDirectory: boolean) => Promise<FileSystemResult>; // New
  showFileExplorerContextMenu: (itemPath: string, isDirectory: boolean) => void; 
  onContextMenuCommand: (callback: (args: {command: string, path: string, isDirectory: boolean}) => void) => () => void; 
  openPathInTerminal: (path: string) => void; // New
  ptyHostWrite: (data: string) => void;
  ptyHostResize: (cols: number, rows: number) => void;
  onPtyHostData: (callback: (data: string | Uint8Array) => void) => () => void;
  ptyHostInit: () => void;
  send: (channel: string, data?: any) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, func: (...args: any[]) => void) => () => void;
}


const electronAPI: ElectronAPI = {
  onUpdateTheme: (callback) => {
    const handler = (_event: IpcRendererEvent, isDarkMode: boolean) => callback(isDarkMode);
    ipcRenderer.on('update-theme', handler);
    return () => ipcRenderer.removeListener('update-theme', handler);
  },
  getInitialTheme: () => ipcRenderer.invoke('dark-mode:get-initial'),
  toggleDarkMode: () => ipcRenderer.invoke('dark-mode:toggle'),
  setSystemTheme: () => ipcRenderer.invoke('dark-mode:system'),
  showAppMenu: (position?: { x: number, y: number }) => ipcRenderer.send('show-app-menu', position),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  createFile: (filePath: string) => ipcRenderer.invoke('fs:createFile', filePath),
  createFolder: (folderPath: string) => ipcRenderer.invoke('fs:createFolder', folderPath),
  renameItem: (oldPath: string, newName: string) => ipcRenderer.invoke('fs:renameItem', oldPath, newName),
  deleteItem: (itemPath: string, isDirectory: boolean) => ipcRenderer.invoke('fs:deleteItem', itemPath, isDirectory),

  showFileExplorerContextMenu: (itemPath: string, isDirectory: boolean) => ipcRenderer.send('show-file-explorer-context-menu', itemPath, isDirectory),
  onContextMenuCommand: (callback) => {
    const handler = (_event: IpcRendererEvent, args: {command: string, path: string, isDirectory: boolean}) => callback(args);
    ipcRenderer.on('context-menu-command', handler);
    return () => ipcRenderer.removeListener('context-menu-command', handler);
  },
  openPathInTerminal: (path: string) => ipcRenderer.send('terminal:openAt', path),


  ptyHostWrite: (data: string) => ipcRenderer.send('pty-host:write', data),
  ptyHostResize: (cols: number, rows: number) => ipcRenderer.send('pty-host:resize', { cols, rows }),
  onPtyHostData: (callback: (data: string | Uint8Array) => void) => {
    const subscription = (_event: IpcRendererEvent, data: string | Uint8Array) => callback(data);
    ipcRenderer.on('pty-host:data', subscription);
    return () => ipcRenderer.removeListener('pty-host:data', subscription); 
  },
  ptyHostInit: () => ipcRenderer.send('pty-host:init'),

  send: (channel: string, data?: any) => {
    const validChannels = ['toMain', 'trigger-save', 'trigger-save-as', 'trigger-close-tab', 'open-settings', 'show-file-explorer-context-menu', 'terminal:openAt']; 
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Invalid send channel: ${channel}`);
    }
  },
  invoke: (channel: string, ...args: any[]) => {
     const validInvokeChannels = [
        'dialog:openFolder', 
        'dark-mode:toggle', 
        'dark-mode:system', 
        'dark-mode:get-initial',
        'fs:readDir', 
        'fs:readFile',
        'fs:createFile',
        'fs:createFolder',
        'fs:renameItem',
        'fs:deleteItem' // Added
     ]; 
     if (validInvokeChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
     }
     console.warn(`Invalid invoke channel: ${channel}`);
     return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    const validChannels = ['fromMain', 'file-opened', 'settings-changed', 'update-theme', 'pty-host:data', 'pty-host:exit', 'trigger-open-folder', 'trigger-save', 'trigger-save-as', 'trigger-close-tab', 'open-settings', 'context-menu-command', 'display-terminal-path']; 
    if (validChannels.includes(channel)) {
      const listener = (_event: IpcRendererEvent, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, listener);
      return () => {
        ipcRenderer.removeListener(channel, listener);
      };
    }
    console.warn(`Invalid on channel: ${channel}`);
    return () => {}; 
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
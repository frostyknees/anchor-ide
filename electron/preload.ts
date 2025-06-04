// electron/preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { AppSettings, DirectoryItem, FileSystemResult } from '@src/types'; // Assuming types are in src/types

// Define the ElectronAPI interface that will be exposed to the renderer process
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
  ptyHostWrite: (data: string) => void;
  ptyHostResize: (cols: number, rows: number) => void;
  onPtyHostData: (callback: (data: string | Uint8Array) => void) => (() => void); 
  ptyHostInit: () => void;
  
  // State Persistence
  getAppSettings: () => Promise<Partial<AppSettings>>;
  saveAppSettings: (settings: Partial<AppSettings>) => Promise<void>;

  // Generic IPC (less used if specific methods are exposed)
  send: (channel: string, data?: any) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, func: (...args: any[]) => void) => (() => void);
}

// Implementation of the ElectronAPI
const electronAPI: ElectronAPI = {
  // Theme
  onUpdateTheme: (callback) => {
    const handler = (_event: IpcRendererEvent, isDarkMode: boolean) => callback(isDarkMode);
    ipcRenderer.on('update-theme', handler);
    return () => ipcRenderer.removeListener('update-theme', handler);
  },
  getInitialTheme: () => ipcRenderer.invoke('dark-mode:get-initial'),
  toggleDarkMode: () => ipcRenderer.invoke('dark-mode:toggle'),
  setSystemTheme: () => ipcRenderer.invoke('dark-mode:system'),

  // Menu
  showAppMenu: (position?: { x: number, y: number }) => {
    if (position) {
      return ipcRenderer.invoke('show-app-menu', position);
    } else {
      return ipcRenderer.invoke('show-app-menu');
    }
  },
  
  // Window Controls
  sendWindowControl: (action) => ipcRenderer.send('window-control', action),
  onWindowMaximized: (callback) => {
    const handler = (_event: IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window-maximized', handler);
    return () => ipcRenderer.removeListener('window-maximized', handler);
  },

  // File System
  openFolderDialog: () => ipcRenderer.invoke('openFolderDialog'),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:saveFile', filePath, content),
  createFile: (filePath: string) => ipcRenderer.invoke('fs:createFile', filePath),
  createFolder: (folderPath: string) => ipcRenderer.invoke('fs:createFolder', folderPath),
  renameItem: (oldPath: string, newName: string) => ipcRenderer.invoke('fs:renameItem', oldPath, newName),
  deleteItem: (itemPath: string, isDirectory: boolean) => ipcRenderer.invoke('fs:deleteItem', itemPath, isDirectory),

  // Context Menu
  showFileExplorerContextMenu: (itemPath: string, isDirectory: boolean) => ipcRenderer.send('show-file-explorer-context-menu', itemPath, isDirectory),
  onContextMenuCommand: (callback) => {
    const handler = (_event: IpcRendererEvent, args: {command: string, path: string, isDirectory: boolean}) => callback(args);
    ipcRenderer.on('context-menu-command', handler);
    return () => ipcRenderer.removeListener('context-menu-command', handler);
  },
  
  // Terminal
  openPathInTerminal: (path: string) => ipcRenderer.send('terminal:openAt', path),
  ptyHostWrite: (data: string) => ipcRenderer.send('pty-host:write', data),
  ptyHostResize: (cols: number, rows: number) => ipcRenderer.send('pty-host:resize', { cols, rows }),
  onPtyHostData: (callback: (data: string | Uint8Array) => void) => {
    const subscription = (_event: IpcRendererEvent, data: string | Uint8Array) => callback(data);
    ipcRenderer.on('pty-host:data', subscription);
    return () => ipcRenderer.removeListener('pty-host:data', subscription); 
  },
  ptyHostInit: () => ipcRenderer.send('pty-host:init'),

  // State Persistence
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),

  // Generic IPC (use with caution, prefer specific methods)
  send: (channel: string, data?: any) => {
    // Whitelist channels for security
    const validSendChannels = [
        'toMain', 'trigger-save', 'trigger-save-as', 'trigger-close-tab', 
        'open-settings', 'show-file-explorer-context-menu', 'terminal:openAt', 
        'window-control', 'pty-host:write', 'pty-host:resize', 'pty-host:init'
    ]; 
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Preload: Invalid send channel attempted: ${channel}`);
    }
  },
  invoke: (channel: string, ...args: any[]) => {
     const validInvokeChannels = [
        'openFolderDialog',
        'dialog:openFolder', 
        'dark-mode:toggle', 'dark-mode:system', 'dark-mode:get-initial',
        'fs:readDir', 'fs:readFile', 'fs:createFile', 'fs:createFolder',
        'fs:renameItem', 'fs:deleteItem', 'fs:saveFile',
        'get-app-settings', 'save-app-settings',
        'show-app-menu'
     ]; 
     if (validInvokeChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
     }
     console.warn(`Preload: Invalid invoke channel attempted: ${channel}`);
     return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    const validOnChannels = [
        'fromMain', 'file-opened', 'settings-changed', 'update-theme', 
        'pty-host:data', 'pty-host:exit', 'trigger-open-folder', 
        'trigger-save', 'trigger-save-as', 'trigger-close-tab', 
        'open-settings', 'context-menu-command', 'display-terminal-path',
        'window-maximized' 
    ]; 
    if (validOnChannels.includes(channel)) {
      const listener = (_event: IpcRendererEvent, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, listener);
      // Return a cleanup function
      return () => {
        ipcRenderer.removeListener(channel, listener);
      };
    }
    console.warn(`Preload: Invalid on channel attempted: ${channel}`);
    return () => {}; // Return a no-op cleanup function for invalid channels
  }
};

export const exposedAPI = {
  // Window controls
  minimize: () => ipcRenderer.send('window-control', 'minimize'),
  maximize: () => ipcRenderer.send('window-control', 'maximize'),
  unmaximize: () => ipcRenderer.send('window-control', 'unmaximize'),
  close: () => ipcRenderer.send('window-control', 'close'),
  
  // File dialogs
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  
  // Menu toggle
  toggleMenu: () => ipcRenderer.send('toggle-menu'),
  
  // Listeners
  onMaximize: (callback: () => void) => {
    ipcRenderer.on('window-maximized', callback);
    return () => ipcRenderer.removeListener('window-maximized', callback);
  },
  onUnmaximize: (callback: () => void) => {
    ipcRenderer.on('window-unmaximized', callback);
    return () => ipcRenderer.removeListener('window-unmaximized', callback);
  },
};

contextBridge.exposeInMainWorld('electron', exposedAPI);
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ExposedAPI = typeof exposedAPI;

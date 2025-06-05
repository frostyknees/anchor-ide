// electron/preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { AppSettings, DirectoryItem, FileSystemResult, ElectronAPI } from '@src/types';

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
  initTerminal: () => ipcRenderer.send('terminal:init'),
  writeToTerminal: (data: string) => ipcRenderer.send('terminal-command', data),
  resizeTerminal: (cols: number, rows: number) => ipcRenderer.send('terminal:resize', { cols, rows }),
  onTerminalData: (callback: (data: string | Uint8Array) => void) => {
    const subscription = (_event: IpcRendererEvent, data: string | Uint8Array) => callback(data);
    ipcRenderer.on('terminal-data', subscription);
    return () => ipcRenderer.removeListener('terminal-data', subscription); 
  },
  onTerminalExit: (callback: (event: { exitCode: number, signal?: number }) => void) => {
    const subscription = (_event: IpcRendererEvent, eventData: { exitCode: number, signal?: number }) => callback(eventData);
    ipcRenderer.on('terminal:exit', subscription);
    return () => ipcRenderer.removeListener('terminal:exit', subscription);
  },

  // State Persistence
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  saveOpenedFolder: (folderPath: string | null) => ipcRenderer.send('workspace:save-opened-folder', folderPath),
  saveOpenFiles: (openFilePaths: string[]): Promise<boolean> => {
    console.log('[Preload] Invoking save-open-files with:', openFilePaths);
    return ipcRenderer.invoke('save-open-files', openFilePaths);
  },
  saveActiveFile: (activeFilePath: string | null) => ipcRenderer.invoke('workspace:save-active-file', activeFilePath),
  getOpenFiles: () => ipcRenderer.invoke('workspace:get-open-files'),
  getActiveFile: () => ipcRenderer.invoke('workspace:get-active-file'),
  onRestoreOpenedFolder: (callback) => {
    const handler = (_event: IpcRendererEvent, folderPath: string) => callback(folderPath);
    ipcRenderer.on('restore-opened-folder', handler);
    return () => ipcRenderer.removeListener('restore-opened-folder', handler);
  },
  onRestoreOpenFiles: (callback) => {
    const handler = (_event: IpcRendererEvent, filePaths: string[]) => callback(filePaths);
    ipcRenderer.on('restore-open-files', handler);
    return () => ipcRenderer.removeListener('restore-open-files', handler);
  },
  onRestoreActiveFile: (callback) => {
    const handler = (_event: IpcRendererEvent, activeFilePath: string | null) => callback(activeFilePath);
    ipcRenderer.on('restore-active-file', handler);
    return () => ipcRenderer.removeListener('restore-active-file', handler);
  },

  // Generic IPC (use with caution, prefer specific methods)
  send: (channel: string, data?: any) => {
    // Whitelist channels for security
    const validSendChannels = [
        'toMain', 'trigger-save', 'trigger-save-as', 'trigger-close-tab', 
        'show-file-explorer-context-menu', 'window-control', 
        'terminal:openAt', 'terminal:init', 'terminal-command', 'terminal:resize',
        'save-open-files', 'save-active-file', 'workspace:save-opened-folder'
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
        'workspace:get-open-files',
        'workspace:get-active-file',
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
        'terminal-data', 'terminal:exit', 'trigger-open-folder', 
        'trigger-save', 'trigger-save-as', 'trigger-close-tab', 
        'open-settings', 'context-menu-command', 'display-terminal-path',
        'window-maximized',
        'restore-opened-folder', 'restore-open-files', 'restore-active-file'
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

// electron/preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// It's good practice to type the API exposed to the renderer
export interface ElectronAPI {
  onUpdateTheme: (callback: (isDarkMode: boolean) => void) => () => void;
  getInitialTheme: () => Promise<boolean>;
  toggleDarkMode: () => Promise<boolean>;
  setSystemTheme: () => Promise<void>;
  showAppMenu: (position?: { x: number; y: number }) => void;
  openFolderDialog: () => Promise<string | undefined>; 
  readDir: (dirPath: string) => Promise<DirectoryItem[] | { error: string }>; // For File Explorer
  readFile: (filePath: string) => Promise<{ content: string } | { error: string }>; // For opening files
  ptyHostWrite: (data: string) => void;
  ptyHostResize: (cols: number, rows: number) => void;
  onPtyHostData: (callback: (data: string | Uint8Array) => void) => () => void;
  ptyHostInit: () => void;
  send: (channel: string, data?: any) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, func: (...args: any[]) => void) => () => void;
}

export interface DirectoryItem {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  path: string;
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

  ptyHostWrite: (data: string) => ipcRenderer.send('pty-host:write', data),
  ptyHostResize: (cols: number, rows: number) => ipcRenderer.send('pty-host:resize', { cols, rows }),
  onPtyHostData: (callback: (data: string | Uint8Array) => void) => {
    const subscription = (_event: IpcRendererEvent, data: string | Uint8Array) => callback(data);
    ipcRenderer.on('pty-host:data', subscription);
    return () => ipcRenderer.removeListener('pty-host:data', subscription); 
  },
  ptyHostInit: () => ipcRenderer.send('pty-host:init'),

  send: (channel: string, data?: any) => {
    const validChannels = ['toMain', 'trigger-save', 'trigger-save-as', 'trigger-close-tab', 'open-settings']; 
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
        'fs:readDir', // Added
        'fs:readFile'  // Added
     ]; 
     if (validInvokeChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
     }
     console.warn(`Invalid invoke channel: ${channel}`);
     return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    const validChannels = ['fromMain', 'file-opened', 'settings-changed', 'update-theme', 'pty-host:data', 'pty-host:exit', 'trigger-open-folder', 'trigger-save', 'trigger-save-as', 'trigger-close-tab', 'open-settings']; 
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
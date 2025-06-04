// electron/main.ts
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, dialog } from 'electron';
import * as path from 'path';
import * as pty from '@lydell/node-pty'; 
import os from 'os';
import fs from 'fs/promises'; 
import Store from 'electron-store'; 
import type { AppSettings, PanelLayout } from '../src/types'; // This import should now work

/// <reference types="./electron-env" />

if (require('electron-squirrel-startup')) {
  app.quit();
}

// Define a more complete default state for AppSettings
const defaultAppSettings: AppSettings = {
    windowBounds: { width: 1600, height: 900, x: undefined, y: undefined },
    isMaximized: false,
    openedFolderPath: null, // Changed from undefined for consistency with string | null
    openFilePaths: [],
    activeFileId: null,    // Changed from undefined
    chatHistory: [],
    panelVisibility: {
        fileExplorer: true,
        outlineView: false, 
        chatPanel: true,
        terminalPanel: true,
        devPlanPanel: true,
    },
    panelLayouts: {} as PanelLayout, 
    theme: 'system',
};

// Initialize electron-store. The generic type AppSettings is crucial.
const store = new Store<AppSettings>({
    defaults: defaultAppSettings
});


let mainWindow: BrowserWindow | null = null;
let ptyProcess: pty.IPty | null = null;
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

const createWindow = () => {
  // Use store.get with the key and the default from your defined defaults
  const savedBounds = store.get('windowBounds');
  const isMaximized = store.get('isMaximized');
  const currentTheme = store.get('theme'); // Will use default if not set
  nativeTheme.themeSource = currentTheme;

  const iconPath = path.join(__dirname, '../../src/assets/anchor_icon.png'); 

  mainWindow = new BrowserWindow({
    width: savedBounds.width, 
    height: savedBounds.height,
    x: savedBounds.x, // These might be undefined if not set, BrowserWindow handles it
    y: savedBounds.y,
    icon: iconPath, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true, 
      nodeIntegration: false, 
      sandbox: false, 
    },
    frame: false, 
  });

  if (isMaximized) {
    mainWindow.maximize();
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('update-theme', nativeTheme.shouldUseDarkColors);
    if (mainWindow) {
        mainWindow.webContents.send('window-maximized', mainWindow.isMaximized());
    }
  });

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('update-theme', nativeTheme.shouldUseDarkColors);
    store.set('theme', nativeTheme.themeSource); 
  });

  mainWindow.on('maximize', () => {
    store.set('isMaximized', true);
    mainWindow?.webContents.send('window-maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    store.set('isMaximized', false);
    mainWindow?.webContents.send('window-maximized', false);
    saveBounds(); 
  });

  let resizeTimeout: NodeJS.Timeout;
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isMaximized() || mainWindow.isMinimized() || mainWindow.isFullScreen()) {
        return;
    }
    store.set('windowBounds', mainWindow.getBounds());
  };

  mainWindow.on('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(saveBounds, 500);
  });
  mainWindow.on('move', () => { 
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(saveBounds, 500);
  });
  
  mainWindow.on('close', () => { 
    if (mainWindow && !mainWindow.isMaximized() && !mainWindow.isMinimized() && !mainWindow.isFullScreen()) {
        store.set('windowBounds', mainWindow.getBounds());
    }
    store.set('isMaximized', mainWindow?.isMaximized() ?? false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
};

// IPC Handlers for App Settings
ipcMain.handle('get-app-settings', async () => {
  return store.store; // .store accessor gives the whole data object
});

ipcMain.handle('save-app-settings', async (_event, settings: Partial<AppSettings>) => {
  // electron-store's .set(object) method merges the object into the store.
  store.set(settings); 
});


// IPC Handlers for Window Controls
ipcMain.on('window-control', (_event, action: 'minimize' | 'maximize' | 'unmaximize' | 'close') => { /* ... unchanged ... */ });
// Theme IPC Handlers
ipcMain.handle('dark-mode:toggle', () => { /* ... unchanged ... */ });
ipcMain.handle('dark-mode:system', () => { /* ... unchanged ... */ });
ipcMain.handle('dark-mode:get-initial', () => { /* ... unchanged ... */ });
// File System IPC Handlers
ipcMain.handle('dialog:openFolder', async () => { /* ... unchanged ... */ });
ipcMain.handle('fs:readDir', async (_event, dirPath: string) => { /* ... unchanged ... */ });
ipcMain.handle('fs:readFile', async (_event, filePath: string) => { /* ... unchanged ... */ });
ipcMain.handle('fs:saveFile', async (_event, filePath: string, content: string) => { /* ... unchanged ... */ });
ipcMain.handle('fs:createFile', async (_event, filePath: string) => { /* ... unchanged ... */ });
ipcMain.handle('fs:createFolder', async (_event, folderPath: string) => { /* ... unchanged ... */ });
ipcMain.handle('fs:renameItem', async (_event, oldPath: string, newName: string) => { /* ... unchanged ... */ });
ipcMain.handle('fs:deleteItem', async (_event, itemPath: string, isDirectory: boolean) => { /* ... unchanged ... */ });
ipcMain.on('terminal:openAt', (_event, targetPath: string) => { /* ... unchanged ... */ });
ipcMain.on('show-file-explorer-context-menu', (event, itemPath: string, isDirectory: boolean) => { /* ... unchanged ... */ });
// PTY Host Logic
ipcMain.on('pty-host:init', (event) => { /* ... PTY logic ... */ });
ipcMain.on('pty-host:write', (_event, data: string) => ptyProcess?.write(data));
ipcMain.on('pty-host:resize', (_event, { cols, rows }: { cols: number, rows: number }) => { /* ... PTY logic ... */ });

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => {
  if (ptyProcess) ptyProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('show-app-menu', (event, position) => { /* ... Menu logic ... */ });
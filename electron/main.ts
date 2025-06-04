// electron/main.ts
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, dialog } from 'electron';
import * as path from 'path';
import * as pty from '@lydell/node-pty'; 
import os from 'os';

const MAIN_WINDOW_VITE_NAME = 'main_window';
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

  // Ensure mainWindow exists before proceeding
  if (!mainWindow) {
    console.error('Failed to create main window');
    return;
  }

  // Store a local reference to mainWindow to help TypeScript with type inference
  const win = mainWindow;

  const loadMainWindow = (window: BrowserWindow) => {
    if (process.env.VITE_DEV_SERVER_URL) {
      window.loadURL(process.env.VITE_DEV_SERVER_URL).catch(err => {
        console.error('Failed to load dev server URL:', err);
      });
    } else {
      // In production, load from the correct path
      const indexPath = path.join(__dirname, '../../dist/index.html');
      console.log('Loading from path:', indexPath);
      
      window.loadFile(indexPath).catch(err => {
        console.error('Failed to load index.html:', err);
        // Try alternative path if the first one fails
        const altPath = path.join(__dirname, '../dist/index.html');
        console.log('Trying alternative path:', altPath);
        window.loadFile(altPath).catch(err2 => {
          console.error('Failed to load from alternative path:', err2);
        });
      });
    }
  };

  // Set up window event listeners
  const setupWindowListeners = (window: BrowserWindow) => {
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      window.webContents.openDevTools();
    }

    window.webContents.on('did-finish-load', () => {
      window.webContents.send('update-theme', nativeTheme.shouldUseDarkColors);
      window.webContents.send('window-maximized', window.isMaximized());
    });

    nativeTheme.on('updated', () => {
      window.webContents.send('update-theme', nativeTheme.shouldUseDarkColors);
      store.set('theme', nativeTheme.themeSource); 
    });

    window.on('maximize', () => {
      store.set('isMaximized', true);
      window.webContents.send('window-maximized', true);
    });
    
    window.on('unmaximize', () => {
      store.set('isMaximized', false);
      window.webContents.send('window-maximized', false);
      saveBounds(window); 
    });

    let resizeTimeout: NodeJS.Timeout;
    const saveBounds = (w: BrowserWindow) => {
      if (w.isMaximized() || w.isMinimized() || w.isFullScreen()) {
        return;
      }
      store.set('windowBounds', w.getBounds());
    };

    window.on('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => saveBounds(window), 500);
    });
    
    window.on('move', () => { 
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => saveBounds(window), 500);
    });
    
    window.on('close', () => { 
      if (!window.isMaximized() && !window.isMinimized() && !window.isFullScreen()) {
        store.set('windowBounds', window.getBounds());
      }
      store.set('isMaximized', window.isMaximized());
    });
  };
  
  // Initialize the window
  loadMainWindow(win);
  setupWindowListeners(win);

  win.on('closed', () => {
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

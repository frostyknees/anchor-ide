// electron/main.ts
console.log('--- EXECUTING LATEST VERSION OF electron/main.ts ---');
import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'path';
import * as pty from '@lydell/node-pty'; 
import os from 'os';

const MAIN_WINDOW_VITE_NAME = 'main_window';
import Store from 'electron-store'; 
import type { AppSettings, PanelLayout } from '@src/types';

/// <reference types="./electron-env" />

if (require('electron-squirrel-startup')) {
  app.quit();
}

// Define a more complete default state for AppSettings
const defaultAppSettings: AppSettings = {
    windowBounds: { width: 1600, height: 900, x: undefined, y: undefined },
    isMaximized: false,
    openedFolderPath: null,
    openFilePaths: [],
    activeFileId: null,
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

// Initialize electron-store
const store = new Store<AppSettings>({
    defaults: defaultAppSettings
});

let mainWindow: BrowserWindow | null = null;
let ptyProcess: pty.IPty | null = null;
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// Create the application menu
const createApplicationMenu = () => {
  const template: Array<Electron.MenuItemConstructorOptions> = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/yourusername/anchor-ide');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

const createWindow = async () => {
  console.log(`[ENV_DEBUG] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[ENV_DEBUG] __dirname: ${__dirname}`);
  // Load the last window state or use defaults
  const windowState = store.get('windowBounds', defaultAppSettings.windowBounds);
  const isMaximized = store.get('isMaximized', false);

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e1e'
  });

  try {
    if (process.env.NODE_ENV === 'development') {
      // In development, load from Vite dev server
      const devServerUrl = 'http://localhost:5173';
      console.log(`[DEBUG] Loading from Vite dev server: ${devServerUrl}`);
      
      // First try to load the dev server
      await mainWindow.loadURL(devServerUrl);
      
      // Set up auto-refresh when the dev server is ready
      mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.log(`[DEBUG] Failed to load dev server (${errorCode}): ${errorDescription}`);
        if (errorCode === -3) {  // -3 is ERR_ABORTED, happens during dev server restart
          console.log('[DEBUG] Dev server restarting, waiting before reload...');
          setTimeout(() => {
            mainWindow?.loadURL(devServerUrl);
          }, 1000);
        } else if (errorCode === -105) {  // -105 is ERR_NAME_NOT_RESOLVED
          console.log('[DEBUG] Dev server not ready yet, retrying...');
          setTimeout(() => {
            mainWindow?.loadURL(devServerUrl);
          }, 1000);
        } else {
          console.error(`[ERROR] Failed to load dev server: ${errorCode} ${errorDescription}`);
        }
      });
    } else {
      // In production, load the built files
      // Assuming main.js is in 'dist/electron' and renderer output is in 'dist/renderer'
      const indexPath = path.join(__dirname, '../renderer/index.html');
      console.log(`[DEBUG] Loading file from: ${indexPath}`);
      await mainWindow.loadFile(indexPath);
    }
    
    // Set up IPC handlers
    setupIPCHandlers();
  } catch (error) {
    console.error(`[ERROR] Failed to load:`, error);
    throw error;
  }

  // Open the DevTools in development mode.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Save window state on close
  const saveWindowState = () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', {
        ...bounds,
        isMaximized: mainWindow.isMaximized()
      });
      store.set('isMaximized', mainWindow.isMaximized());
    }
  };

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window maximize/unmaximize events
  mainWindow.on('maximize', () => {
    if (mainWindow) {
      mainWindow.webContents.send('window-maximized', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow) {
      mainWindow.webContents.send('window-maximized', false);
    }
  });

  // Set up IPC handlers
function setupIPCHandlers() {
  // Window controls
  ipcMain.on('window-control', (event, action: 'minimize' | 'maximize' | 'unmaximize' | 'close') => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    
    switch (action) {
      case 'minimize':
        win.minimize();
        break;
      case 'maximize':
        if (win.isMaximized()) {
          win.unmaximize();
          mainWindow?.webContents.send('window-unmaximized');
        } else {
          win.maximize();
          mainWindow?.webContents.send('window-maximized');
        }
        break;
      case 'close':
        win.close();
        break;
    }
  });

  // Get initial theme
  ipcMain.handle('dark-mode:get-initial', async () => {
    return store.get('theme', defaultAppSettings.theme);
  });

  // Get app settings
  ipcMain.handle('get-app-settings', async () => {
    return store.store;
  });

  // Save app settings
  ipcMain.handle('save-app-settings', async (event, settings: Partial<AppSettings>) => {
    store.set(settings);
    return { success: true };
  });

  // Toggle menu
  ipcMain.on('toggle-menu', () => {
    if (!mainWindow) return;
    // TODO: Renderer process should listen for 'execute-menu-toggle' 
    // and then perform the DOM query and event dispatch.
    // Example in renderer: 
    // ipcRenderer.on('execute-menu-toggle', () => { 
    //   const menuButton = document.querySelector('.menu-button'); 
    //   if (menuButton) menuButton.dispatchEvent(new Event('click')); 
    // });
    mainWindow.webContents.send('execute-menu-toggle');
  });
}

  // Initialize PTY process for terminal
  const initPty = () => {
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }

    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME || process.env.USERPROFILE,
      env: process.env as { [key: string]: string }
    });

    ptyProcess.onData((data) => {
      if (mainWindow) {
        mainWindow.webContents.send('terminal-data', data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`Terminal process exited with code ${exitCode}`);
      ptyProcess = null;
    });
  };

  // Handle terminal data from renderer
  ipcMain.on('terminal-command', (event, command) => {
    if (ptyProcess) {
      ptyProcess.write(command);
    }
  });

  // Initialize PTY when window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    initPty();
  });
};

// Handle termination signals
const handleTermination = () => {
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }
  
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
  
  // Give some time for cleanup
  setTimeout(() => {
    app.quit();
    process.exit(0);
  }, 100);
};

// Handle open folder dialog
ipcMain.handle('openFolderDialog', async () => {
  try {
    if (!mainWindow) return null;
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('Error in openFolderDialog:', error);
    return null;
  }
});

// Handle show app menu from renderer
ipcMain.handle('show-app-menu', (event, position?: { x: number, y: number }) => {
  try {
    if (!mainWindow) return;
    
    const { x = 0, y = 0 } = position || {};
    const menu = Menu.getApplicationMenu();
    
    if (menu) {
      menu.popup({
        window: mainWindow,
        x: Math.floor(x),
        y: Math.floor(y),
        positioningItem: 0
      });
    }
  } catch (error: any) { // Add type annotation for error
    console.error('Error showing app menu:', error);
  }
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
  // Ensure the pty process is killed if it exists
  if (ptyProcess) {
    console.log('[DEBUG] Killing ptyProcess from window-all-closed.');
    ptyProcess.kill();
    ptyProcess = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Initialize the application menu when the app is ready
app.whenReady().then(async () => {
  createApplicationMenu();
  await createWindow();
});

// Handle termination signals
process.on('SIGTERM', handleTermination);
process.on('SIGINT', handleTermination);

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  handleTermination();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  handleTermination();
});

// Handle before-quit event to ensure clean shutdown
app.on('before-quit', (event) => {
  if (process.platform !== 'darwin') {
    // Prevent the default quit behavior
    event.preventDefault();
    
    // Destroy the window and quit
    if (mainWindow) {
      mainWindow.destroy();
      mainWindow = null;
    }
    
    // Give some time for cleanup
    setTimeout(() => {
      app.exit(0);
    }, 100);
  }
});

// Handle app activation (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

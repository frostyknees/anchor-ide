// electron/main.ts
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, IpcMainInvokeEvent, dialog } from 'electron';
import * as path from 'path';
import * as pty from '@lydell/node-pty'; 
import os from 'os';
import fs from 'fs/promises'; // Import fs.promises for async file system operations
import fsSync from 'fs'; // For synchronous checks if needed, or specific sync operations

// This line ensures that the global variables injected by Electron Forge Vite plugin are declared for TypeScript
/// <reference types="./electron-env" />

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let ptyProcess: pty.IPty | null = null;

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';


const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1600, 
    height: 900, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // __dirname is defined by CommonJS
      contextIsolation: true, 
      nodeIntegration: false, 
      sandbox: false, 
    },
    titleBarStyle: 'hidden', 
    titleBarOverlay: { 
      color: '#252526', 
      symbolColor: '#f8f9fa', 
      height: 32 
    }
  });

  // Load the index.html of the app.
  // MAIN_WINDOW_VITE_DEV_SERVER_URL and MAIN_WINDOW_VITE_NAME are injected by the Electron Forge Vite plugin
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools in development mode.
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Send initial theme state to renderer once content is loaded
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('update-theme', nativeTheme.shouldUseDarkColors);
  });

  // Relay theme changes to renderer
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('update-theme', nativeTheme.shouldUseDarkColors);
  });


  mainWindow.on('closed', () => {
    mainWindow = null;
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
};

// IPC Handlers
ipcMain.handle('dark-mode:toggle', () => {
  if (nativeTheme.shouldUseDarkColors) {
    nativeTheme.themeSource = 'light';
  } else {
    nativeTheme.themeSource = 'dark';
  }
  return nativeTheme.shouldUseDarkColors;
});

ipcMain.handle('dark-mode:system', () => {
  nativeTheme.themeSource = 'system';
});

ipcMain.handle('dark-mode:get-initial', () => {
  return nativeTheme.shouldUseDarkColors;
});

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return undefined; // Return undefined if no window
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled || filePaths.length === 0) {
    return undefined;
  } else {
    return filePaths[0];
  }
});

// IPC handler for listing directory contents
ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      isFile: item.isFile(),
      path: path.join(dirPath, item.name) // Add full path
    }));
  } catch (error) {
    console.error('Error reading directory:', error);
    // It's better to return a structured error or null
    return { error: (error as Error).message || 'Failed to read directory' };
  }
});

// IPC handler for reading file content
ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { content };
    } catch (error) {
        console.error('Error reading file:', error);
        return { error: (error as Error).message || 'Failed to read file' };
    }
});


// --- PTY Host Logic ---
ipcMain.on('pty-host:init', (event) => {
  if (ptyProcess) {
    ptyProcess.kill(); // Kill existing process if any
  }
  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80, 
    rows: 30, 
    cwd: process.env.HOME || os.homedir(), 
    env: process.env as { [key: string]: string } 
  });

  ptyProcess.onData((data: string) => {
    event.sender.send('pty-host:data', data);
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`PTY process exited with code ${exitCode}, signal ${signal}`);
    event.sender.send('pty-host:exit'); 
    ptyProcess = null;
  });
});

ipcMain.on('pty-host:write', (_event, data: string) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.on('pty-host:resize', (_event, { cols, rows }: { cols: number, rows: number }) => {
  if (ptyProcess) {
    try {
        ptyProcess.resize(cols, rows);
    } catch (e) {
        console.error("Error resizing PTY:", e);
    }
  }
});


app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (ptyProcess) {
    ptyProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('show-app-menu', (event, position) => {
  const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [ 
    {
      label: 'File',
      submenu: [
        { label: 'Open Folder...', click: () => { mainWindow?.webContents.send('trigger-open-folder'); } },
        { label: 'Create New Project...', click: () => { console.log('New Project clicked (Post-MVP)'); } },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => { mainWindow?.webContents.send('trigger-save'); } },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => { mainWindow?.webContents.send('trigger-save-as'); } },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => { mainWindow?.webContents.send('trigger-close-tab'); } },
        { type: 'separator' },
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
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Settings...', click: () => { mainWindow?.webContents.send('open-settings'); } }
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
      label: 'Window',
      submenu: [
        { role: 'minimize' as const }, 
        { role: 'zoom' as const },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More (AnchorIDE)',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/frostyknees/anchoride'); 
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  
  if (mainWindow && position) {
    menu.popup({ window: mainWindow, x: position.x, y: position.y });
  } else if (mainWindow && process.platform !== 'darwin') { 
    console.log("Menu display on non-macOS without position needs custom handling in renderer.");
  } else {
     Menu.setApplicationMenu(menu); 
  }
});
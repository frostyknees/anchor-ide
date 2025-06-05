// electron/main.ts
import { app, BrowserWindow, ipcMain, dialog, shell as electronShell, Menu, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as pty from '@lydell/node-pty'; 
import os from 'os';
import * as fs from 'fs';
import { createRequire } from 'module';

// const MAIN_WINDOW_VITE_NAME = 'main_window'; // Not directly used, can be removed if not needed elsewhere
import Store from 'electron-store'; 
import type { AppSettings, DirectoryItem } from '@src/types'; // PanelLayout might be unused if react-resizable-panels handles it all

// Define WindowBounds interface locally for clarity with defaults
interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const defaultWindowBounds: WindowBounds = { width: 1600, height: 900, x: undefined, y: undefined };
const defaultIsMaximized: boolean = false;

/// <reference types="./electron-env" />

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (require('electron-squirrel-startup')) {
  app.quit();
}

let ptyProcess: pty.IPty | null = null;
const osShell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
const shell = osShell; // Keep existing shell variable for pty, if it's used elsewhere with this name

const defaultAppSettings: AppSettings = {
    windowBounds: defaultWindowBounds,
    isMaximized: defaultIsMaximized,
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
    theme: 'system',
};

const store = new Store<AppSettings>({
    defaults: defaultAppSettings,
    // Debounce save operations for performance, especially for window bounds
    // However, electron-store does not have built-in debounce. This is a conceptual note.
    // For frequent saves like window resizing, consider manual debouncing if performance issues arise.
});

let mainWindow: BrowserWindow | null = null;

const createApplicationMenu = () => {
  const template: Array<Electron.MenuItemConstructorOptions> = [
    {
      label: 'File',
      submenu: [
        { 
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const folderPath = await handleOpenFolderDialog();
            if (folderPath && mainWindow) {
              mainWindow.webContents.send('folder-opened', folderPath);
            }
          }
        },
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
            // Use the electronShell imported at the top of the file
            await electronShell.openExternal('https://github.com/frostyknees/anchor-ide'); // Placeholder URL
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({ role: 'appMenu' });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

const initPty = () => {
  if (!mainWindow) {
    console.log('[Main Process] initPty: mainWindow is not available.');
    return;
  }

  if (ptyProcess) {
    console.log('[Main Process] initPty: Existing PTY process found. Killing it before creating a new one.');
    try {
      ptyProcess.kill(); 
    } catch (e: any) {
      console.error('[Main Process] Error killing existing PTY process during initPty:', e);
    }
    ptyProcess = null; 
  }

  const currentOpenedFolderPath = store.get('openedFolderPath');
  const cwd = currentOpenedFolderPath && fs.existsSync(currentOpenedFolderPath) ? currentOpenedFolderPath : os.homedir();

  console.log(`[Main Process] initPty: Spawning PTY with shell: ${shell}, cwd: ${cwd}`);
  try {
    ptyProcess = pty.spawn(osShell, [], {
      name: 'xterm-256color',
      cols: 80, 
      rows: 30, 
      cwd: cwd,
      env: { ...process.env, LANG: app.getLocale() + '.UTF-8' }, // Ensure proper locale for PTY
    });

    console.log(`[Main Process] PTY process spawned with PID: ${ptyProcess.pid}`);

    ptyProcess.onData((data: string) => {
      if (mainWindow) {
        mainWindow.webContents.send('terminal-data', data);
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      const pid = ptyProcess?.pid; 
      console.log(`[Main Process] PTY process (PID: ${pid || 'unknown'}) exited. Code: ${exitCode}, Signal: ${signal}`);
      if (mainWindow) {
        mainWindow.webContents.send('terminal:exit', { exitCode, signal });
      }
      ptyProcess = null; 
    });
  } catch (error: any) {
    console.error('[Main Process] Failed to spawn PTY process:', error);
    ptyProcess = null;
    if (mainWindow) {
      mainWindow.webContents.send('terminal-data', `\r\n[Error spawning PTY: ${error.message}]\r\n`);
    }
  }
};

const handleTermination = (signalOrEvent?: string) => {
  console.log(`[Main Process] SHUTDOWN_LOG: handleTermination called from: ${signalOrEvent || 'unknown'}`);
  if (ptyProcess && ptyProcess.pid) {
    console.log(`[Main Process] SHUTDOWN_LOG: Attempting to kill PTY process (PID: ${ptyProcess.pid})`);
    try {
      ptyProcess.kill();
      console.log(`[Main Process] SHUTDOWN_LOG: ptyProcess.kill() called for PID: ${ptyProcess.pid}.`);
    } catch (e: any) {
      console.error(`[Main Process] SHUTDOWN_LOG: Error killing PTY process (PID: ${ptyProcess.pid}):`, e);
    }
    ptyProcess = null; 
    console.log(`[Main Process] SHUTDOWN_LOG: ptyProcess reference set to null.`);
  } else {
    console.log('[Main Process] SHUTDOWN_LOG: No active PTY process to kill or PID not available.');
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[Main Process] SHUTDOWN_LOG: mainWindow exists in handleTermination, but not explicitly saving state here (handled by window close).');
  } else {
    console.log('[Main Process] SHUTDOWN_LOG: mainWindow does not exist or is destroyed in handleTermination.');
  }
  console.log(`[Main Process] SHUTDOWN_LOG: handleTermination finished for: ${signalOrEvent || 'unknown'}`);
};

const handleOpenFolderDialog = async () => {
  try {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0];
      store.set('openedFolderPath', folderPath);
      console.log('[Main Process] New folder opened. Re-initializing PTY to use new CWD.');
      initPty(); // This will kill the old PTY (if any) and start a new one in the new CWD.
      return folderPath;
    }
  } catch (error) {
    console.error('Error opening folder dialog:', error);
  }
  return null;
};

const setupIPCHandlers = () => {
  if (!mainWindow) return;

  ipcMain.handle('openFolderDialog', handleOpenFolderDialog);

  ipcMain.handle('fs:readDir', async (_event, folderPath: string, includeFiles: boolean = true): Promise<DirectoryItem[]> => {
    try {
      const items = await fs.promises.readdir(folderPath, { withFileTypes: true });
      const directoryItems: DirectoryItem[] = [];
      for (const item of items) {
        if (!includeFiles && !item.isDirectory()) {
          continue;
        }
        directoryItems.push({
          id: path.join(folderPath, item.name),
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: path.join(folderPath, item.name),
          children: item.isDirectory() ? [] : undefined, 
        });
      }
      return directoryItems.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
    } catch (error) {
      console.error(`Error reading directory ${folderPath}:`, error);
      return [];
    }
  });

  ipcMain.handle('fs:readFile', async (_event, filePath: string): Promise<string | null> => {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  });

  ipcMain.handle('saveFileContent', async (_event, filePath: string, content: string): Promise<boolean> => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error(`Error saving file ${filePath}:`, error);
      return false;
    }
  });

  ipcMain.handle('getStoreValue', (_event, key: keyof AppSettings) => store.get(key));
  ipcMain.handle('setStoreValue', (_event, key: keyof AppSettings, value: any) => store.set(key, value));

  ipcMain.handle('get-app-settings', () => {
    try {
      return { success: true, settings: store.store };
    } catch (e: any) {
      console.error('[Main Process] Error in get-app-settings:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('save-app-settings', (_event, settings: Partial<AppSettings>) => {
    try {
      store.set(settings);
      return { success: true };
    } catch (e: any) {
      console.error('[Main Process] Error in save-app-settings:', e);
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('dark-mode:get-initial', () => store.get('theme', 'system'));

  // IPC handlers for saving open files and active file state
  ipcMain.handle('save-open-files', async (_event, filePaths: string[]): Promise<boolean> => {
    try {
      console.log('[Main Process] IPC save-open-files (handle): Persisting open files:', filePaths);
      store.set('openFilePaths', filePaths);
      return true;
    } catch (error) {
      const err = error as Error;
      console.error('[Main Process] IPC save-open-files (handle): Error persisting open files:', err.message, err.stack);
      return false;
    }
  });

  ipcMain.handle('workspace:save-active-file', (_event, activeFilePath: string | null) => {
    console.log(`[Main Process] IPC workspace:save-active-file: Saving active file: ${activeFilePath}`);
    store.set('activeFileId', activeFilePath);
  });

  ipcMain.handle('workspace:get-open-files', async () => {
    const openFiles = store.get('openFilePaths', []);
    console.log('[Main Process] IPC workspace:get-open-files: Returning:', openFiles);
    return openFiles;
  });

  ipcMain.handle('workspace:get-active-file', async () => {
    const activeFile = store.get('activeFileId', null);
    console.log('[Main Process] IPC workspace:get-active-file: Returning:', activeFile);
    return activeFile;
  });

  ipcMain.on('workspace:save-opened-folder', (_event, folderPath: string | null) => {
    console.log(`[Main Process] IPC 'workspace:save-opened-folder': Saving opened folder path: ${folderPath}`);
    store.set('openedFolderPath', folderPath);
  });

  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Open Folder...', click: () => handleOpenFolderDialog() },
        { type: 'separator' },
        { label: 'Exit', click: () => app.quit() }
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
    }
  ];

  const appMenu = Menu.buildFromTemplate(menuTemplate);
  // Menu.setApplicationMenu(appMenu); // Set as standard app menu, or use popup for context menu style

  ipcMain.handle('show-app-menu', (_event, position?: { x: number, y: number }) => {
    if (!mainWindow) return;
    if (position) {
      appMenu.popup({ window: mainWindow, x: position.x, y: position.y });
    } else {
      // If no position, maybe show it at a default location or not at all if it's context-specific
      // For a hamburger menu, position is usually expected.
      // Alternatively, if this was for a main menu bar, you'd use Menu.setApplicationMenu(appMenu)
      // and not call popup here.
      // For now, let's assume position is usually provided for a hamburger button context menu.
      appMenu.popup({ window: mainWindow }); 
    }
  });

  // Terminal IPC Handlers
  ipcMain.on('terminal:init', (_event) => {
    console.log('[Main Process] Received terminal:init IPC.');
    initPty();
  });

  ipcMain.on('terminal:resize', (_event, { cols, rows }: { cols: number, rows: number }) => {
    if (ptyProcess && ptyProcess.pid) {
      if (cols > 0 && rows > 0) {
        try {
          console.log(`[Main Process] Resizing PTY (PID: ${ptyProcess.pid}) to ${cols}x${rows}`);
          ptyProcess.resize(cols, rows);
        } catch (e: any) {
          console.warn(`[Main Process] Error resizing PTY (PID: ${ptyProcess.pid}), likely already exited:`, e.message);
        }
      } else {
        console.warn(`[Main Process] Ignoring PTY resize to invalid dimensions: ${cols}x${rows}`);
      }
    } else {
      // console.log('[Main Process] terminal:resize called but no active PTY process or PID missing.');
    }
  });

  ipcMain.on('terminal-command', (_event, command: string) => {
    if (ptyProcess && ptyProcess.pid) {
      ptyProcess.write(command);
    }
  });

  if (mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Main Process] mainWindow did-finish-load: Initial PTY setup if terminal panel is visible.');
      // Consider checking if terminal panel is supposed to be visible from settings before auto-init
      // For now, let's assume if renderer asks for 'terminal:init', it means it's ready/visible.
      // initPty(); // Renderer will now explicitly send 'terminal:init'
    });
  }

  ipcMain.on('window-control', (_event, action: 'minimize' | 'maximize' | 'unmaximize' | 'close') => {
    if (!mainWindow) return;
    switch (action) {
      case 'minimize':
        mainWindow.minimize();
        break;
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case 'unmaximize': // Though 'maximize' toggles, explicit unmaximize might be sent
        mainWindow.unmaximize();
        break;
      case 'close':
        mainWindow.close();
        break;
      default:
        console.warn(`[Main Process] Unknown window-control action: ${action}`);
    }
  });
  ipcMain.on('update-theme', (_event, theme: 'light' | 'dark' | 'system') => {
    store.set('theme', theme);
    mainWindow?.webContents.send('theme-updated', theme);
  });
};

const createWindow = async () => {
  console.log(`[Main Process] VITE_DEV_SERVER_URL: ${process.env.VITE_DEV_SERVER_URL}`);
  const storedWindowBounds = store.get('windowBounds', defaultWindowBounds);
  const isMaximized = store.get('isMaximized', defaultIsMaximized);

  const iconPath = path.join(__dirname, process.env.NODE_ENV === 'development' ? '../../src/assets/anchor_icon.png' : '../renderer/assets/anchor_icon.png');
  const preloadScriptPath = pathToFileURL(path.join(__dirname, 'preload.js')).href;
  console.log('[Main Process] Attempting to load preload script (as URL) from:', preloadScriptPath);

  mainWindow = new BrowserWindow({
    icon: iconPath,
    width: storedWindowBounds.width,
    height: storedWindowBounds.height,
    x: storedWindowBounds.x,
    y: storedWindowBounds.y,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e1e',
    show: false, // Don't show until ready
  });

  mainWindow.once('ready-to-show', () => {
    if (isMaximized) {
      mainWindow?.maximize();
    } else {
      mainWindow?.show();
    }
  });

  setupIPCHandlers(); // Moved here to ensure handlers are registered before content load

  try {
    if (process.env.NODE_ENV === 'development') {
      const devServerUrl = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'; // Vite dev server URL
      await mainWindow.loadURL(devServerUrl);
      mainWindow.webContents.openDevTools(); // Optionally open dev tools
    } else {
      const indexPath = path.join(__dirname, '../renderer/index.html');
      await mainWindow.loadFile(indexPath);
    }
  } catch (error) {
    console.error('Failed to load window content:', error);
    throw error;
  }

  // Listener for when the content has finished loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main Process] mainWindow content did-finish-load. Restoring state.');
    const lastOpenedFolderPath = store.get('openedFolderPath');
    const lastOpenFiles = store.get('openFilePaths', []); // Default to empty array if not set
    const lastActiveFile = store.get('activeFileId', null); // Default to null if not set

    if (mainWindow && !mainWindow.isDestroyed()) { // Ensure mainWindow is still valid
      if (lastOpenedFolderPath) {
        console.log(`[Main Process] Restoring opened folder path: ${lastOpenedFolderPath}`);
        mainWindow.webContents.send('restore-opened-folder', lastOpenedFolderPath);
      }
      // Always send open files and active file, even if empty/null, so renderer can clear state if needed
      console.log('[Main Process] Restoring open files:', lastOpenFiles);
      mainWindow.webContents.send('restore-open-files', lastOpenFiles);
      console.log(`[Main Process] Restoring active file: ${lastActiveFile}`);
      mainWindow.webContents.send('restore-active-file', lastActiveFile);
    }
  });

  const saveWindowState = () => {
    if (mainWindow && !mainWindow.isMinimized()) { // Don't save bounds if minimized
      store.set('windowBounds', mainWindow.getBounds());
      store.set('isMaximized', mainWindow.isMaximized());
    }
  };

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('close', () => { 
    console.log('[Main Process] SHUTDOWN_LOG: mainWindow event: close. Saving window state.');
    saveWindowState();
    console.log('[Main Process] SHUTDOWN_LOG: mainWindow event: close handler finished.');
  }); 
  mainWindow.on('closed', () => { 
    console.log('[Main Process] SHUTDOWN_LOG: mainWindow event: closed. Setting mainWindow to null.');
    mainWindow = null; 
    console.log('[Main Process] SHUTDOWN_LOG: mainWindow event: closed handler finished.');
  });

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window-maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-maximized', false));
};

app.whenReady().then(() => {
  createApplicationMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('[Main Process] SHUTDOWN_LOG: App event: window-all-closed');
  if (process.platform !== 'darwin') {
    console.log('[Main Process] SHUTDOWN_LOG: Quitting app because all windows are closed (non-macOS).');
    app.quit();
    console.log('[Main Process] SHUTDOWN_LOG: app.quit() called from window-all-closed.');
  } else {
    console.log('[Main Process] SHUTDOWN_LOG: Not quitting app on window-all-closed (macOS).');
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', (event) => {
  console.log('[Main Process] SHUTDOWN_LOG: App event: before-quit. Performing cleanup.');
  handleTermination('before-quit');
  console.log('[Main Process] SHUTDOWN_LOG: App event: before-quit handler finished.');
});

if (process.platform !== 'win32') {
  const signalHandler = (signal: NodeJS.Signals) => {
    console.log(`[Main Process] Received ${signal}. Cleaning up and quitting.`);
    handleTermination(signal.toString());
    // process.exit() might be too abrupt. app.quit() allows 'before-quit' to run.
    // However, if 'before-quit' is part of the problem, this might need adjustment.
    app.quit(); 
  };
  process.on('SIGINT', signalHandler);
  process.on('SIGTERM', signalHandler);
  process.on('SIGHUP', signalHandler);
}

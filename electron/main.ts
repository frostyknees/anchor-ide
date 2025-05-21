import { app, BrowserWindow, ipcMain, Menu, nativeTheme, IpcMainInvokeEvent, dialog } from 'electron';
import * as path from 'path';
import * as pty from '@lydell/node-pty'; 
import os from 'os';
import fs from 'fs/promises'; 
// fsSync can be removed if not used elsewhere, fs/promises is generally preferred
// import fsSync from 'fs'; 

/// <reference types="./electron-env" />

if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let ptyProcess: pty.IPty | null = null;
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1600, 
    height: 900, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), 
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
  });

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
ipcMain.handle('dark-mode:system', () => { nativeTheme.themeSource = 'system'; });
ipcMain.handle('dark-mode:get-initial', () => nativeTheme.shouldUseDarkColors);

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return undefined;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return (!canceled && filePaths.length > 0) ? filePaths[0] : undefined;
});

ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      isFile: item.isFile(),
      path: path.join(dirPath, item.name)
    }));
  } catch (error) {
    console.error('Error reading directory:', dirPath, error);
    return { error: (error as Error).message || 'Failed to read directory' };
  }
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { content };
    } catch (error) {
        console.error('Error reading file:', filePath, error);
        return { error: (error as Error).message || 'Failed to read file' };
    }
});

ipcMain.handle('fs:createFile', async (_event, filePath: string) => {
  try {
    await fs.writeFile(filePath, ''); 
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error creating file:', filePath, error);
    return { success: false, error: (error as Error).message || 'Failed to create file' };
  }
});

ipcMain.handle('fs:createFolder', async (_event, folderPath: string) => {
  try {
    await fs.mkdir(folderPath);
    return { success: true, path: folderPath };
  } catch (error) {
    console.error('Error creating folder:', folderPath, error);
    return { success: false, error: (error as Error).message || 'Failed to create folder' };
  }
});

ipcMain.handle('fs:renameItem', async (_event, oldPath: string, newName: string) => {
  try {
    const newPath = path.join(path.dirname(oldPath), newName);
    if (oldPath === newPath) return { success: true, path: newPath, message: "No change in name." }; 
    
    try {
      await fs.access(newPath);
      return { success: false, error: `An item named "${newName}" already exists.` };
    } catch (accessError) {
      // Path does not exist, proceed with rename
    }

    await fs.rename(oldPath, newPath);
    return { success: true, path: newPath };
  } catch (error) {
    console.error('Error renaming item:', oldPath, 'to', newName, error);
    return { success: false, error: (error as Error).message || 'Failed to rename item' };
  }
});

ipcMain.handle('fs:deleteItem', async (_event, itemPath: string, isDirectory: boolean) => {
  if (!mainWindow) return { success: false, error: 'Main window not available' };
  
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    title: 'Confirm Delete',
    message: `Are you sure you want to delete "${path.basename(itemPath)}"?`,
    detail: 'This action cannot be undone.',
  });

  if (result.response === 0) { // User clicked "Delete"
    try {
      if (isDirectory) {
        await fs.rm(itemPath, { recursive: true, force: true }); // force can be risky, use with caution
      } else {
        await fs.rm(itemPath);
      }
      return { success: true, path: itemPath };
    } catch (error) {
      console.error('Error deleting item:', itemPath, error);
      return { success: false, error: (error as Error).message || 'Failed to delete item' };
    }
  } else {
    return { success: false, message: 'Delete cancelled by user' };
  }
});

ipcMain.on('terminal:openAt', (_event, targetPath: string) => {
  console.log(`Request to open terminal at: ${targetPath}`);
  // TODO: Implement logic to send a 'cd' command to the active ptyProcess
  // For now, we can just send the path to the renderer to be displayed or used by AI
  if (mainWindow) {
    mainWindow.webContents.send('display-terminal-path', targetPath); // Example IPC
  }
  if (ptyProcess) {
    // Normalize path for shell command
    const normalizedPath = os.platform() === 'win32' ? `"${targetPath}"` : `'${targetPath.replace(/'/g, "'\\''")}'`;
    ptyProcess.write(`cd ${normalizedPath}\r`);
    // Optionally, clear the terminal or print the path
    ptyProcess.write(`echo "Terminal opened at: ${targetPath}"\r`);
    ptyProcess.write(`clear\r`); // Or 'cls' for cmd on Windows
  }
});


// Context Menu for File Explorer
ipcMain.on('show-file-explorer-context-menu', (event, itemPath: string, isDirectory: boolean) => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'New File...',
      click: () => { event.sender.send('context-menu-command', { command: 'new-file', path: itemPath, isDirectory }); }
    },
    {
      label: 'New Folder...',
      click: () => { event.sender.send('context-menu-command', { command: 'new-folder', path: itemPath, isDirectory }); }
    },
    { type: 'separator' },
    { 
      label: 'Rename...', 
      click: () => { event.sender.send('context-menu-command', { command: 'rename', path: itemPath, isDirectory }); } 
    },
    { 
      label: 'Delete', 
      click: () => { event.sender.send('context-menu-command', { command: 'delete', path: itemPath, isDirectory }); }
    },
    { type: 'separator' },
    // { label: 'Copy', role: 'copy', enabled: false }, // TODO: Implement copy path/file
    // { label: 'Paste', role: 'paste', enabled: false }, // TODO: Implement
    // { type: 'separator' },
    { 
      label: 'Open in Terminal', 
      click: () => { event.sender.send('context-menu-command', { command: 'open-in-terminal', path: itemPath, isDirectory }); }
    }, 
    { type: 'separator' },
    { 
      label: 'Add to AI Context', 
      click: () => { event.sender.send('context-menu-command', { command: 'add-to-ai-context', path: itemPath, isDirectory }); }
    } 
  ];

  const menu = Menu.buildFromTemplate(template);
  if (mainWindow) {
    menu.popup({ window: mainWindow }); 
  }
});


// --- PTY Host Logic ---
ipcMain.on('pty-host:init', (event) => {
  if (ptyProcess) ptyProcess.kill();
  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color', cols: 80, rows: 30, cwd: process.env.HOME || os.homedir(), env: process.env as { [key: string]: string }
  });
  ptyProcess.onData((data: string) => event.sender.send('pty-host:data', data));
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`PTY process exited with code ${exitCode}, signal ${signal}`);
    event.sender.send('pty-host:exit'); 
    ptyProcess = null;
  });
});
ipcMain.on('pty-host:write', (_event, data: string) => ptyProcess?.write(data));
ipcMain.on('pty-host:resize', (_event, { cols, rows }: { cols: number, rows: number }) => {
  if (ptyProcess) try { ptyProcess.resize(cols, rows); } catch (e) { console.error("Error resizing PTY:", e); }
});

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => {
  if (ptyProcess) ptyProcess.kill();
  if (process.platform !== 'darwin') app.quit();
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
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Settings...', click: () => { mainWindow?.webContents.send('open-settings'); } }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const }, { role: 'zoom' as const },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' as const }, { role: 'front' as const },
          { type: 'separator' as const }, { role: 'window' as const }
        ] : [ { role: 'close' as const } ])
      ]
    },
    {
      role: 'help',
      submenu: [ { label: 'Learn More (AnchorIDE)', click: async () => { const { shell } = require('electron'); await shell.openExternal('https://github.com/frostyknees/anchoride'); } } ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  if (mainWindow && position) menu.popup({ window: mainWindow, x: position.x, y: position.y });
  else if (mainWindow && process.platform !== 'darwin') console.log("Menu display on non-macOS without position needs custom handling in renderer.");
  else Menu.setApplicationMenu(menu); 
});
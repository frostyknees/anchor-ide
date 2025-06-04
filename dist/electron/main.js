"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// electron/main.ts
const electron_1 = require("electron");
const path = __importStar(require("path"));
const os_1 = __importDefault(require("os"));
const promises_1 = __importDefault(require("fs/promises"));
const electron_store_1 = __importDefault(require("electron-store"));
/// <reference types="./electron-env" />
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
// Initialize electron-store with a schema for AppSettings
const store = new electron_store_1.default({
    defaults: {
        windowBounds: { width: 1600, height: 900 },
        isMaximized: false,
        openedFolderPath: undefined, // Use undefined for properties that might not exist initially
        openFilePaths: [],
        activeFileId: undefined,
        chatHistory: [],
        panelVisibility: {
            fileExplorer: true,
            outlineView: false,
            chatPanel: true,
            terminalPanel: true,
            devPlanPanel: true,
        },
        panelLayouts: {},
        theme: 'system',
    }
});
let mainWindow = null;
let ptyProcess = null;
const shell = os_1.default.platform() === 'win32' ? 'powershell.exe' : 'bash';
const createWindow = () => {
    // Get settings from store, providing fallbacks if a key doesn't exist in the store yet
    const savedBounds = store.get('windowBounds', { width: 1600, height: 900 });
    const isMaximized = store.get('isMaximized', false);
    const currentTheme = store.get('theme', 'system');
    electron_1.nativeTheme.themeSource = currentTheme; // Apply stored theme preference before window creation
    const iconPath = path.join(__dirname, '../../src/assets/anchor_icon.png');
    mainWindow = new electron_1.BrowserWindow({
        ...savedBounds, // Spread saved bounds
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow?.webContents.send('update-theme', electron_1.nativeTheme.shouldUseDarkColors);
        if (mainWindow) {
            mainWindow.webContents.send('window-maximized', mainWindow.isMaximized());
        }
    });
    electron_1.nativeTheme.on('updated', () => {
        mainWindow?.webContents.send('update-theme', electron_1.nativeTheme.shouldUseDarkColors);
        store.set('theme', electron_1.nativeTheme.themeSource);
    });
    mainWindow.on('maximize', () => {
        store.set('isMaximized', true);
        mainWindow?.webContents.send('window-maximized', true);
    });
    mainWindow.on('unmaximize', () => {
        store.set('isMaximized', false);
        mainWindow?.webContents.send('window-maximized', false);
        // Save bounds when unmaximizing, as 'resize' might not capture it correctly immediately
        saveBounds();
    });
    let resizeTimeout;
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
electron_1.ipcMain.handle('get-app-settings', async () => {
    return store.store; // .store gives the whole data object
});
electron_1.ipcMain.handle('save-app-settings', async (_event, settings) => {
    store.set(settings);
});
// IPC Handlers for Window Controls
electron_1.ipcMain.on('window-control', (_event, action) => {
    if (!mainWindow)
        return;
    switch (action) {
        case 'minimize':
            mainWindow.minimize();
            break;
        case 'maximize':
            if (mainWindow.isMaximized())
                mainWindow.unmaximize();
            else
                mainWindow.maximize();
            break;
        case 'unmaximize':
            mainWindow.unmaximize();
            break;
        case 'close':
            mainWindow.close();
            break;
    }
});
// Theme IPC Handlers
electron_1.ipcMain.handle('dark-mode:toggle', () => {
    electron_1.nativeTheme.themeSource = electron_1.nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
    return electron_1.nativeTheme.shouldUseDarkColors;
});
electron_1.ipcMain.handle('dark-mode:system', () => { electron_1.nativeTheme.themeSource = 'system'; });
electron_1.ipcMain.handle('dark-mode:get-initial', () => electron_1.nativeTheme.shouldUseDarkColors);
// File System IPC Handlers
electron_1.ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow)
        return undefined;
    const { canceled, filePaths } = await electron_1.dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return (!canceled && filePaths.length > 0) ? filePaths[0] : undefined;
});
electron_1.ipcMain.handle('fs:readDir', async (_event, dirPath) => {
    try {
        const items = await promises_1.default.readdir(dirPath, { withFileTypes: true });
        return items.map(item => ({
            name: item.name,
            isDirectory: item.isDirectory(),
            isFile: item.isFile(),
            path: path.join(dirPath, item.name)
        }));
    }
    catch (error) {
        console.error('Error reading directory:', dirPath, error);
        return { error: error.message || 'Failed to read directory' };
    }
});
electron_1.ipcMain.handle('fs:readFile', async (_event, filePath) => {
    try {
        const content = await promises_1.default.readFile(filePath, 'utf-8');
        return { content };
    }
    catch (error) {
        console.error('Error reading file:', filePath, error);
        return { error: error.message || 'Failed to read file' };
    }
});
electron_1.ipcMain.handle('fs:saveFile', async (_event, filePath, content) => {
    try {
        await promises_1.default.writeFile(filePath, content, 'utf-8');
        return { success: true, path: filePath };
    }
    catch (error) {
        console.error('Error saving file:', filePath, error);
        return { success: false, error: error.message || 'Failed to save file' };
    }
});
electron_1.ipcMain.handle('fs:createFile', async (_event, filePath) => {
    try {
        await promises_1.default.writeFile(filePath, '');
        return { success: true, path: filePath };
    }
    catch (error) {
        console.error('Error creating file:', filePath, error);
        return { success: false, error: error.message || 'Failed to create file' };
    }
});
electron_1.ipcMain.handle('fs:createFolder', async (_event, folderPath) => {
    try {
        await promises_1.default.mkdir(folderPath);
        return { success: true, path: folderPath };
    }
    catch (error) {
        console.error('Error creating folder:', folderPath, error);
        return { success: false, error: error.message || 'Failed to create folder' };
    }
});
electron_1.ipcMain.handle('fs:renameItem', async (_event, oldPath, newName) => {
    try {
        const newPath = path.join(path.dirname(oldPath), newName);
        if (oldPath === newPath)
            return { success: true, path: newPath, message: "No change in name." };
        try {
            await promises_1.default.access(newPath);
            return { success: false, error: `An item named "${newName}" already exists.` };
        }
        catch (accessError) { /* Path does not exist, proceed */ }
        await promises_1.default.rename(oldPath, newPath);
        return { success: true, path: newPath };
    }
    catch (error) {
        console.error('Error renaming item:', oldPath, 'to', newName, error);
        return { success: false, error: error.message || 'Failed to rename item' };
    }
});
electron_1.ipcMain.handle('fs:deleteItem', async (_event, itemPath, isDirectory) => {
    if (!mainWindow)
        return { success: false, error: 'Main window not available' };
    const result = await electron_1.dialog.showMessageBox(mainWindow, {
        type: 'warning', buttons: ['Delete', 'Cancel'], defaultId: 1,
        title: 'Confirm Delete', message: `Are you sure you want to delete "${path.basename(itemPath)}"?`,
        detail: 'This action cannot be undone.',
    });
    if (result.response === 0) {
        try {
            await promises_1.default.rm(itemPath, { recursive: isDirectory, force: isDirectory });
            return { success: true, path: itemPath };
        }
        catch (error) {
            console.error('Error deleting item:', itemPath, error);
            return { success: false, error: error.message || 'Failed to delete item' };
        }
    }
    else {
        return { success: false, message: 'Delete cancelled by user' };
    }
});
electron_1.ipcMain.on('terminal:openAt', (_event, targetPath) => {
    if (ptyProcess) {
        const normalizedPath = os_1.default.platform() === 'win32' ? `"${targetPath}"` : `'${targetPath.replace(/'/g, "'\\''")}'`;
        ptyProcess.write(`cd ${normalizedPath}\r`);
    }
});
electron_1.ipcMain.on('show-file-explorer-context-menu', (event, itemPath, isDirectory) => {
    const template = [
        { label: 'New File...', click: () => { event.sender.send('context-menu-command', { command: 'new-file', path: itemPath, isDirectory }); } },
        { label: 'New Folder...', click: () => { event.sender.send('context-menu-command', { command: 'new-folder', path: itemPath, isDirectory }); } },
        { type: 'separator' },
        { label: 'Rename...', click: () => { event.sender.send('context-menu-command', { command: 'rename', path: itemPath, isDirectory }); } },
        { label: 'Delete', click: () => { event.sender.send('context-menu-command', { command: 'delete', path: itemPath, isDirectory }); } },
        { type: 'separator' },
        { label: 'Open in Terminal', click: () => { event.sender.send('context-menu-command', { command: 'open-in-terminal', path: itemPath, isDirectory }); } },
        { type: 'separator' },
        { label: 'Add to AI Context', click: () => { event.sender.send('context-menu-command', { command: 'add-to-ai-context', path: itemPath, isDirectory }); } }
    ];
    const menu = electron_1.Menu.buildFromTemplate(template);
    if (mainWindow)
        menu.popup({ window: mainWindow });
});
electron_1.ipcMain.on('pty-host:init', (event) => { });
electron_1.ipcMain.on('pty-host:write', (_event, data) => ptyProcess?.write(data));
electron_1.ipcMain.on('pty-host:resize', (_event, { cols, rows }) => { });
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createWindow(); });
electron_1.app.on('window-all-closed', () => {
    if (ptyProcess)
        ptyProcess.kill();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.ipcMain.on('show-app-menu', (event, position) => { });

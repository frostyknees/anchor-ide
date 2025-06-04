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
const pty = __importStar(require("@lydell/node-pty"));
const os_1 = __importDefault(require("os"));
const fs = __importStar(require("fs"));
const MAIN_WINDOW_VITE_NAME = 'main_window';
const electron_store_1 = __importDefault(require("electron-store"));
/// <reference types="./electron-env" />
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
let ptyProcess = null;
const shell = os_1.default.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
// Define a more complete default state for AppSettings
const defaultAppSettings = {
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
    // panelLayouts is removed as it's handled by react-resizable-panels autoSaveId
    theme: 'system',
};
// Initialize electron-store
const store = new electron_store_1.default({
    defaults: defaultAppSettings
});
let mainWindow = null;
// ptyProcess and shell are declared near the top (lines 17-18)
// Create the application menu
const createApplicationMenu = () => {
    const template = [
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
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
};
const createWindow = async () => {
    // Load the last window state or use defaults
    const ultimateDefaultWindowBounds = { width: 1280, height: 720, x: undefined, y: undefined }; // Final fallback, ensuring x and y are present
    const storedWindowBounds = store.get('windowBounds');
    const windowBoundsToUse = storedWindowBounds ?? defaultAppSettings.windowBounds ?? ultimateDefaultWindowBounds;
    const ultimateDefaultIsMaximized = false; // Final fallback
    const storedIsMaximized = store.get('isMaximized');
    const isMaximizedToUse = storedIsMaximized ?? defaultAppSettings.isMaximized ?? ultimateDefaultIsMaximized;
    // Create the browser window.
    const iconPath = process.env.NODE_ENV === 'development' ? path.join(__dirname, '../../src/assets/anchor_icon.png') : path.join(process.resourcesPath, 'assets', 'anchor_icon.png');
    mainWindow = new electron_1.BrowserWindow({
        icon: iconPath,
        width: windowBoundsToUse.width,
        height: windowBoundsToUse.height,
        x: windowBoundsToUse.x,
        y: windowBoundsToUse.y,
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
            // First try to load the dev server
            await mainWindow.loadURL(devServerUrl);
            // Set up auto-refresh when the dev server is ready
            mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
                if (errorCode === -3) { // -3 is ERR_ABORTED, happens during dev server restart
                    setTimeout(() => {
                        mainWindow?.loadURL(devServerUrl);
                    }, 1000);
                }
                else if (errorCode === -105) { // -105 is ERR_NAME_NOT_RESOLVED
                    setTimeout(() => {
                        mainWindow?.loadURL(devServerUrl);
                    }, 1000);
                }
                else {
                    console.error(`Failed to load dev server: ${errorCode} ${errorDescription}`);
                }
            });
        }
        else {
            // In production, load the built files
            // Assuming main.js is in 'dist/electron' and renderer output is in 'dist/renderer'
            const indexPath = path.join(__dirname, '../renderer/index.html');
            await mainWindow.loadFile(indexPath);
        }
        // Set up IPC handlers
        setupIPCHandlers();
    }
    catch (error) {
        console.error(`Failed to load:`, error);
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
        electron_1.ipcMain.on('window-control', (event, action) => {
            const win = electron_1.BrowserWindow.getFocusedWindow();
            if (!win)
                return;
            switch (action) {
                case 'minimize':
                    win.minimize();
                    break;
                case 'maximize':
                    if (win.isMaximized()) {
                        win.unmaximize();
                        mainWindow?.webContents.send('window-unmaximized');
                    }
                    else {
                        win.maximize();
                        mainWindow?.webContents.send('window-maximized');
                    }
                    break;
                case 'close':
                    win.close();
                    break;
            }
        });
        // App settings handlers theme
        electron_1.ipcMain.handle('dark-mode:get-initial', async () => {
            return store.get('theme', defaultAppSettings.theme);
        });
        // Handler for reading file content
        electron_1.ipcMain.handle('fs:readFile', async (_event, filePath) => {
            try {
                const content = await fs.promises.readFile(filePath, 'utf-8');
                return { content };
            }
            catch (err) {
                console.error(`Error reading file ${filePath}:`, err);
                return { error: err.message || 'Failed to read file' };
            }
        });
        // Handler for reading directory contents
        electron_1.ipcMain.handle('fs:readDir', async (event, dirPath) => {
            try {
                if (!dirPath || typeof dirPath !== 'string') {
                    console.error('[IPC Main] Invalid dirPath received for fs:readDir:', dirPath);
                    return { error: 'Invalid directory path provided.' };
                }
                // console.log(`[IPC Main] Handling fs:readDir for path: ${dirPath}`);
                const files = await fs.promises.readdir(dirPath);
                const itemsPromises = files.map(async (file) => {
                    const filePath = path.join(dirPath, file);
                    try {
                        const stats = await fs.promises.stat(filePath);
                        return {
                            name: file,
                            path: filePath,
                            isDirectory: stats.isDirectory(),
                            isFile: stats.isFile(),
                        }; // Added type assertion for clarity
                    }
                    catch (statError) {
                        console.warn(`[IPC Main] Could not stat file ${filePath}: ${statError.message}`);
                        // For items that can't be stat'd (e.g. broken symlinks, permissions issues)
                        // We can either filter them out or return them with an error property
                        return {
                            name: file,
                            path: filePath,
                            isDirectory: false, // Best guess or mark as unknown
                            isFile: false, // Best guess or mark as unknown
                            error: `Could not access: ${statError.code || statError.message}`
                        };
                    }
                });
                const items = await Promise.all(itemsPromises);
                // console.log(`[IPC Main] fs:readDir returning ${items.length} items for ${dirPath}`);
                return items;
            }
            catch (error) {
                console.error(`[IPC Main] Error reading directory ${dirPath}: ${error.message}`, error.stack);
                return { error: error.message || 'Failed to read directory' };
            }
        });
        // Get app settings
        electron_1.ipcMain.handle('get-app-settings', async () => {
            return store.store;
        });
        // Save app settings
        electron_1.ipcMain.handle('save-app-settings', async (event, settings) => {
            store.set(settings);
            return { success: true };
        });
        // Toggle menu
        electron_1.ipcMain.on('toggle-menu', () => {
            if (!mainWindow)
                return;
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
            env: process.env
        });
        ptyProcess.onData((data) => {
            if (mainWindow) {
                mainWindow.webContents.send('terminal-data', data);
            }
        });
        ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`Terminal process exited with code ${exitCode}, signal ${signal}`);
            mainWindow?.webContents.send('terminal:exit', { exitCode, signal });
            ptyProcess = null;
        });
    };
    // Handle terminal data from renderer
    electron_1.ipcMain.on('terminal:init', (_event) => {
        initPty(); // Call your existing initPty function
    });
    electron_1.ipcMain.on('terminal:resize', (_event, { cols, rows }) => {
        if (ptyProcess) {
            try {
                ptyProcess.resize(cols, rows);
            }
            catch (e) {
                // This can happen if the pty is in the process of exiting
                console.warn('Error resizing PTY, likely already exited:', e);
            }
        }
    });
    electron_1.ipcMain.on('terminal-command', (event, command) => {
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
        electron_1.app.quit();
        process.exit(0);
    }, 100);
};
// Handle open folder dialog
electron_1.ipcMain.handle('openFolderDialog', async () => {
    try {
        if (!mainWindow)
            return null;
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Project Folder'
        });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    }
    catch (error) {
        console.error('Error in openFolderDialog:', error);
        return null;
    }
});
// Handle show app menu from renderer
electron_1.ipcMain.handle('show-app-menu', (event, position) => {
    try {
        if (!mainWindow)
            return;
        const { x = 0, y = 0 } = position || {};
        const menu = electron_1.Menu.getApplicationMenu();
        if (menu) {
            menu.popup({
                window: mainWindow,
                x: Math.floor(x),
                y: Math.floor(y),
                positioningItem: 0
            });
        }
    }
    catch (error) { // Add type annotation for error
        console.error('Error showing app menu:', error);
    }
});
// Quit when all windows are closed, except on macOS.
electron_1.app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
    // Ensure the pty process is killed if it exists
    if (ptyProcess) {
        console.log('[DEBUG] Killing ptyProcess from window-all-closed.');
        ptyProcess.kill();
        ptyProcess = null;
    }
});
electron_1.app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// Initialize the application menu when the app is ready
electron_1.app.whenReady().then(async () => {
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
electron_1.app.on('before-quit', () => {
    console.log('[DEBUG] App before-quit event triggered.');
    if (ptyProcess) {
        console.log('[DEBUG] Killing ptyProcess from before-quit.');
        ptyProcess.kill();
        ptyProcess = null;
    }
    // Allow app.quit() to proceed with its lifecycle, which will handle window destruction.
});
// Handle app activation (macOS)
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// Quit when all windows are closed, except on macOS
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});

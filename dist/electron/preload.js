"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exposedAPI = void 0;
// electron/preload.ts
const electron_1 = require("electron");
// Implementation of the ElectronAPI
const electronAPI = {
    // Theme
    onUpdateTheme: (callback) => {
        const handler = (_event, isDarkMode) => callback(isDarkMode);
        electron_1.ipcRenderer.on('update-theme', handler);
        return () => electron_1.ipcRenderer.removeListener('update-theme', handler);
    },
    getInitialTheme: () => electron_1.ipcRenderer.invoke('dark-mode:get-initial'),
    toggleDarkMode: () => electron_1.ipcRenderer.invoke('dark-mode:toggle'),
    setSystemTheme: () => electron_1.ipcRenderer.invoke('dark-mode:system'),
    // Menu
    showAppMenu: (position) => {
        if (position) {
            return electron_1.ipcRenderer.invoke('show-app-menu', position);
        }
        else {
            return electron_1.ipcRenderer.invoke('show-app-menu');
        }
    },
    // Window Controls
    sendWindowControl: (action) => electron_1.ipcRenderer.send('window-control', action),
    onWindowMaximized: (callback) => {
        const handler = (_event, isMaximized) => callback(isMaximized);
        electron_1.ipcRenderer.on('window-maximized', handler);
        return () => electron_1.ipcRenderer.removeListener('window-maximized', handler);
    },
    // File System
    openFolderDialog: () => electron_1.ipcRenderer.invoke('openFolderDialog'),
    readDir: (dirPath) => electron_1.ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath) => electron_1.ipcRenderer.invoke('fs:readFile', filePath),
    saveFile: (filePath, content) => electron_1.ipcRenderer.invoke('fs:saveFile', filePath, content),
    createFile: (filePath) => electron_1.ipcRenderer.invoke('fs:createFile', filePath),
    createFolder: (folderPath) => electron_1.ipcRenderer.invoke('fs:createFolder', folderPath),
    renameItem: (oldPath, newName) => electron_1.ipcRenderer.invoke('fs:renameItem', oldPath, newName),
    deleteItem: (itemPath, isDirectory) => electron_1.ipcRenderer.invoke('fs:deleteItem', itemPath, isDirectory),
    // Context Menu
    showFileExplorerContextMenu: (itemPath, isDirectory) => electron_1.ipcRenderer.send('show-file-explorer-context-menu', itemPath, isDirectory),
    onContextMenuCommand: (callback) => {
        const handler = (_event, args) => callback(args);
        electron_1.ipcRenderer.on('context-menu-command', handler);
        return () => electron_1.ipcRenderer.removeListener('context-menu-command', handler);
    },
    // Terminal
    openPathInTerminal: (path) => electron_1.ipcRenderer.send('terminal:openAt', path),
    ptyHostWrite: (data) => electron_1.ipcRenderer.send('pty-host:write', data),
    ptyHostResize: (cols, rows) => electron_1.ipcRenderer.send('pty-host:resize', { cols, rows }),
    onPtyHostData: (callback) => {
        const subscription = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('pty-host:data', subscription);
        return () => electron_1.ipcRenderer.removeListener('pty-host:data', subscription);
    },
    ptyHostInit: () => electron_1.ipcRenderer.send('pty-host:init'),
    // State Persistence
    getAppSettings: () => electron_1.ipcRenderer.invoke('get-app-settings'),
    saveAppSettings: (settings) => electron_1.ipcRenderer.invoke('save-app-settings', settings),
    // Generic IPC (use with caution, prefer specific methods)
    send: (channel, data) => {
        // Whitelist channels for security
        const validSendChannels = [
            'toMain', 'trigger-save', 'trigger-save-as', 'trigger-close-tab',
            'open-settings', 'show-file-explorer-context-menu', 'terminal:openAt',
            'window-control', 'pty-host:write', 'pty-host:resize', 'pty-host:init'
        ];
        if (validSendChannels.includes(channel)) {
            electron_1.ipcRenderer.send(channel, data);
        }
        else {
            console.warn(`Preload: Invalid send channel attempted: ${channel}`);
        }
    },
    invoke: (channel, ...args) => {
        const validInvokeChannels = [
            'openFolderDialog',
            'dialog:openFolder',
            'dark-mode:toggle', 'dark-mode:system', 'dark-mode:get-initial',
            'fs:readDir', 'fs:readFile', 'fs:createFile', 'fs:createFolder',
            'fs:renameItem', 'fs:deleteItem', 'fs:saveFile',
            'get-app-settings', 'save-app-settings',
            'show-app-menu'
        ];
        if (validInvokeChannels.includes(channel)) {
            return electron_1.ipcRenderer.invoke(channel, ...args);
        }
        console.warn(`Preload: Invalid invoke channel attempted: ${channel}`);
        return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
    },
    on: (channel, func) => {
        const validOnChannels = [
            'fromMain', 'file-opened', 'settings-changed', 'update-theme',
            'pty-host:data', 'pty-host:exit', 'trigger-open-folder',
            'trigger-save', 'trigger-save-as', 'trigger-close-tab',
            'open-settings', 'context-menu-command', 'display-terminal-path',
            'window-maximized'
        ];
        if (validOnChannels.includes(channel)) {
            const listener = (_event, ...args) => func(...args);
            electron_1.ipcRenderer.on(channel, listener);
            // Return a cleanup function
            return () => {
                electron_1.ipcRenderer.removeListener(channel, listener);
            };
        }
        console.warn(`Preload: Invalid on channel attempted: ${channel}`);
        return () => { }; // Return a no-op cleanup function for invalid channels
    }
};
exports.exposedAPI = {
    // Window controls
    minimize: () => electron_1.ipcRenderer.send('window-control', 'minimize'),
    maximize: () => electron_1.ipcRenderer.send('window-control', 'maximize'),
    unmaximize: () => electron_1.ipcRenderer.send('window-control', 'unmaximize'),
    close: () => electron_1.ipcRenderer.send('window-control', 'close'),
    // File dialogs
    openFolderDialog: () => electron_1.ipcRenderer.invoke('open-folder-dialog'),
    // Menu toggle
    toggleMenu: () => electron_1.ipcRenderer.send('toggle-menu'),
    // Listeners
    onMaximize: (callback) => {
        electron_1.ipcRenderer.on('window-maximized', callback);
        return () => electron_1.ipcRenderer.removeListener('window-maximized', callback);
    },
    onUnmaximize: (callback) => {
        electron_1.ipcRenderer.on('window-unmaximized', callback);
        return () => electron_1.ipcRenderer.removeListener('window-unmaximized', callback);
    },
};
electron_1.contextBridge.exposeInMainWorld('electron', exports.exposedAPI);
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);

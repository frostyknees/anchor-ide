"use strict";
const electron = require("electron");
const electronAPI = {
  // Theme
  onUpdateTheme: (callback) => {
    const handler = (_event, isDarkMode) => callback(isDarkMode);
    electron.ipcRenderer.on("update-theme", handler);
    return () => electron.ipcRenderer.removeListener("update-theme", handler);
  },
  getInitialTheme: () => electron.ipcRenderer.invoke("dark-mode:get-initial"),
  toggleDarkMode: () => electron.ipcRenderer.invoke("dark-mode:toggle"),
  setSystemTheme: () => electron.ipcRenderer.invoke("dark-mode:system"),
  // Menu
  showAppMenu: (position) => electron.ipcRenderer.send("show-app-menu", position),
  // Window Controls
  sendWindowControl: (action) => electron.ipcRenderer.send("window-control", action),
  onWindowMaximized: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    electron.ipcRenderer.on("window-maximized", handler);
    return () => electron.ipcRenderer.removeListener("window-maximized", handler);
  },
  // File System
  openFolderDialog: () => electron.ipcRenderer.invoke("dialog:openFolder"),
  readDir: (dirPath) => electron.ipcRenderer.invoke("fs:readDir", dirPath),
  readFile: (filePath) => electron.ipcRenderer.invoke("fs:readFile", filePath),
  saveFile: (filePath, content) => electron.ipcRenderer.invoke("fs:saveFile", filePath, content),
  createFile: (filePath) => electron.ipcRenderer.invoke("fs:createFile", filePath),
  createFolder: (folderPath) => electron.ipcRenderer.invoke("fs:createFolder", folderPath),
  renameItem: (oldPath, newName) => electron.ipcRenderer.invoke("fs:renameItem", oldPath, newName),
  deleteItem: (itemPath, isDirectory) => electron.ipcRenderer.invoke("fs:deleteItem", itemPath, isDirectory),
  // Context Menu
  showFileExplorerContextMenu: (itemPath, isDirectory) => electron.ipcRenderer.send("show-file-explorer-context-menu", itemPath, isDirectory),
  onContextMenuCommand: (callback) => {
    const handler = (_event, args) => callback(args);
    electron.ipcRenderer.on("context-menu-command", handler);
    return () => electron.ipcRenderer.removeListener("context-menu-command", handler);
  },
  // Terminal
  openPathInTerminal: (path) => electron.ipcRenderer.send("terminal:openAt", path),
  ptyHostWrite: (data) => electron.ipcRenderer.send("pty-host:write", data),
  ptyHostResize: (cols, rows) => electron.ipcRenderer.send("pty-host:resize", { cols, rows }),
  onPtyHostData: (callback) => {
    const subscription = (_event, data) => callback(data);
    electron.ipcRenderer.on("pty-host:data", subscription);
    return () => electron.ipcRenderer.removeListener("pty-host:data", subscription);
  },
  ptyHostInit: () => electron.ipcRenderer.send("pty-host:init"),
  // State Persistence
  getAppSettings: () => electron.ipcRenderer.invoke("get-app-settings"),
  saveAppSettings: (settings) => electron.ipcRenderer.invoke("save-app-settings", settings),
  // Generic IPC (use with caution, prefer specific methods)
  send: (channel, data) => {
    const validSendChannels = [
      "toMain",
      "trigger-save",
      "trigger-save-as",
      "trigger-close-tab",
      "open-settings",
      "show-file-explorer-context-menu",
      "terminal:openAt",
      "window-control",
      "pty-host:write",
      "pty-host:resize",
      "pty-host:init"
    ];
    if (validSendChannels.includes(channel)) {
      electron.ipcRenderer.send(channel, data);
    } else {
      console.warn(`Preload: Invalid send channel attempted: ${channel}`);
    }
  },
  invoke: (channel, ...args) => {
    const validInvokeChannels = [
      "dialog:openFolder",
      "dark-mode:toggle",
      "dark-mode:system",
      "dark-mode:get-initial",
      "fs:readDir",
      "fs:readFile",
      "fs:createFile",
      "fs:createFolder",
      "fs:renameItem",
      "fs:deleteItem",
      "fs:saveFile",
      "get-app-settings",
      "save-app-settings"
    ];
    if (validInvokeChannels.includes(channel)) {
      return electron.ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`Preload: Invalid invoke channel attempted: ${channel}`);
    return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
  },
  on: (channel, func) => {
    const validOnChannels = [
      "fromMain",
      "file-opened",
      "settings-changed",
      "update-theme",
      "pty-host:data",
      "pty-host:exit",
      "trigger-open-folder",
      "trigger-save",
      "trigger-save-as",
      "trigger-close-tab",
      "open-settings",
      "context-menu-command",
      "display-terminal-path",
      "window-maximized"
    ];
    if (validOnChannels.includes(channel)) {
      const listener = (_event, ...args) => func(...args);
      electron.ipcRenderer.on(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    }
    console.warn(`Preload: Invalid on channel attempted: ${channel}`);
    return () => {
    };
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);

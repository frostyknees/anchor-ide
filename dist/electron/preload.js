"use strict";
const electron = require("electron");
const electronAPI = {
  onUpdateTheme: (callback) => {
    const handler = (_event, isDarkMode) => callback(isDarkMode);
    electron.ipcRenderer.on("update-theme", handler);
    return () => electron.ipcRenderer.removeListener("update-theme", handler);
  },
  getInitialTheme: () => electron.ipcRenderer.invoke("dark-mode:get-initial"),
  toggleDarkMode: () => electron.ipcRenderer.invoke("dark-mode:toggle"),
  setSystemTheme: () => electron.ipcRenderer.invoke("dark-mode:system"),
  showAppMenu: (position) => electron.ipcRenderer.send("show-app-menu", position),
  openFolderDialog: () => electron.ipcRenderer.invoke("dialog:openFolder"),
  readDir: (dirPath) => electron.ipcRenderer.invoke("fs:readDir", dirPath),
  readFile: (filePath) => electron.ipcRenderer.invoke("fs:readFile", filePath),
  ptyHostWrite: (data) => electron.ipcRenderer.send("pty-host:write", data),
  ptyHostResize: (cols, rows) => electron.ipcRenderer.send("pty-host:resize", { cols, rows }),
  onPtyHostData: (callback) => {
    const subscription = (_event, data) => callback(data);
    electron.ipcRenderer.on("pty-host:data", subscription);
    return () => electron.ipcRenderer.removeListener("pty-host:data", subscription);
  },
  ptyHostInit: () => electron.ipcRenderer.send("pty-host:init"),
  send: (channel, data) => {
    const validChannels = ["toMain", "trigger-save", "trigger-save-as", "trigger-close-tab", "open-settings"];
    if (validChannels.includes(channel)) {
      electron.ipcRenderer.send(channel, data);
    } else {
      console.warn(`Invalid send channel: ${channel}`);
    }
  },
  invoke: (channel, ...args) => {
    const validInvokeChannels = [
      "dialog:openFolder",
      "dark-mode:toggle",
      "dark-mode:system",
      "dark-mode:get-initial",
      "fs:readDir",
      // Added
      "fs:readFile"
      // Added
    ];
    if (validInvokeChannels.includes(channel)) {
      return electron.ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`Invalid invoke channel: ${channel}`);
    return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
  },
  on: (channel, func) => {
    const validChannels = ["fromMain", "file-opened", "settings-changed", "update-theme", "pty-host:data", "pty-host:exit", "trigger-open-folder", "trigger-save", "trigger-save-as", "trigger-close-tab", "open-settings"];
    if (validChannels.includes(channel)) {
      const listener = (_event, ...args) => func(...args);
      electron.ipcRenderer.on(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    }
    console.warn(`Invalid on channel: ${channel}`);
    return () => {
    };
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);

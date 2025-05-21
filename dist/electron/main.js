"use strict";
const electron = require("electron");
const path = require("path");
const pty = require("@lydell/node-pty");
const os = require("os");
const fs = require("fs/promises");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const pty__namespace = /* @__PURE__ */ _interopNamespaceDefault(pty);
if (require("electron-squirrel-startup")) {
  electron.app.quit();
}
let mainWindow = null;
let ptyProcess = null;
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
const createWindow = () => {
  mainWindow = new electron.BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path__namespace.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#252526",
      symbolColor: "#f8f9fa",
      height: 32
    }
  });
  {
    mainWindow.loadURL("http://localhost:5173");
  }
  if (process.env.NODE_ENV === "development" || !electron.app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("update-theme", electron.nativeTheme.shouldUseDarkColors);
  });
  electron.nativeTheme.on("updated", () => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("update-theme", electron.nativeTheme.shouldUseDarkColors);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
};
electron.ipcMain.handle("dark-mode:toggle", () => {
  if (electron.nativeTheme.shouldUseDarkColors) {
    electron.nativeTheme.themeSource = "light";
  } else {
    electron.nativeTheme.themeSource = "dark";
  }
  return electron.nativeTheme.shouldUseDarkColors;
});
electron.ipcMain.handle("dark-mode:system", () => {
  electron.nativeTheme.themeSource = "system";
});
electron.ipcMain.handle("dark-mode:get-initial", () => electron.nativeTheme.shouldUseDarkColors);
electron.ipcMain.handle("dialog:openFolder", async () => {
  if (!mainWindow) return void 0;
  const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  return !canceled && filePaths.length > 0 ? filePaths[0] : void 0;
});
electron.ipcMain.handle("fs:readDir", async (_event, dirPath) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items.map((item) => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      isFile: item.isFile(),
      path: path__namespace.join(dirPath, item.name)
    }));
  } catch (error) {
    console.error("Error reading directory:", dirPath, error);
    return { error: error.message || "Failed to read directory" };
  }
});
electron.ipcMain.handle("fs:readFile", async (_event, filePath) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { content };
  } catch (error) {
    console.error("Error reading file:", filePath, error);
    return { error: error.message || "Failed to read file" };
  }
});
electron.ipcMain.handle("fs:createFile", async (_event, filePath) => {
  try {
    await fs.writeFile(filePath, "");
    return { success: true, path: filePath };
  } catch (error) {
    console.error("Error creating file:", filePath, error);
    return { success: false, error: error.message || "Failed to create file" };
  }
});
electron.ipcMain.handle("fs:createFolder", async (_event, folderPath) => {
  try {
    await fs.mkdir(folderPath);
    return { success: true, path: folderPath };
  } catch (error) {
    console.error("Error creating folder:", folderPath, error);
    return { success: false, error: error.message || "Failed to create folder" };
  }
});
electron.ipcMain.handle("fs:renameItem", async (_event, oldPath, newName) => {
  try {
    const newPath = path__namespace.join(path__namespace.dirname(oldPath), newName);
    if (oldPath === newPath) return { success: true, path: newPath, message: "No change in name." };
    try {
      await fs.access(newPath);
      return { success: false, error: `An item named "${newName}" already exists.` };
    } catch (accessError) {
    }
    await fs.rename(oldPath, newPath);
    return { success: true, path: newPath };
  } catch (error) {
    console.error("Error renaming item:", oldPath, "to", newName, error);
    return { success: false, error: error.message || "Failed to rename item" };
  }
});
electron.ipcMain.handle("fs:deleteItem", async (_event, itemPath, isDirectory) => {
  if (!mainWindow) return { success: false, error: "Main window not available" };
  const result = await electron.dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Delete", "Cancel"],
    defaultId: 1,
    title: "Confirm Delete",
    message: `Are you sure you want to delete "${path__namespace.basename(itemPath)}"?`,
    detail: "This action cannot be undone."
  });
  if (result.response === 0) {
    try {
      if (isDirectory) {
        await fs.rm(itemPath, { recursive: true, force: true });
      } else {
        await fs.rm(itemPath);
      }
      return { success: true, path: itemPath };
    } catch (error) {
      console.error("Error deleting item:", itemPath, error);
      return { success: false, error: error.message || "Failed to delete item" };
    }
  } else {
    return { success: false, message: "Delete cancelled by user" };
  }
});
electron.ipcMain.on("terminal:openAt", (_event, targetPath) => {
  console.log(`Request to open terminal at: ${targetPath}`);
  if (mainWindow) {
    mainWindow.webContents.send("display-terminal-path", targetPath);
  }
  if (ptyProcess) {
    const normalizedPath = os.platform() === "win32" ? `"${targetPath}"` : `'${targetPath.replace(/'/g, "'\\''")}'`;
    ptyProcess.write(`cd ${normalizedPath}\r`);
    ptyProcess.write(`echo "Terminal opened at: ${targetPath}"\r`);
    ptyProcess.write(`clear\r`);
  }
});
electron.ipcMain.on("show-file-explorer-context-menu", (event, itemPath, isDirectory) => {
  const template = [
    {
      label: "New File...",
      click: () => {
        event.sender.send("context-menu-command", { command: "new-file", path: itemPath, isDirectory });
      }
    },
    {
      label: "New Folder...",
      click: () => {
        event.sender.send("context-menu-command", { command: "new-folder", path: itemPath, isDirectory });
      }
    },
    { type: "separator" },
    {
      label: "Rename...",
      click: () => {
        event.sender.send("context-menu-command", { command: "rename", path: itemPath, isDirectory });
      }
    },
    {
      label: "Delete",
      click: () => {
        event.sender.send("context-menu-command", { command: "delete", path: itemPath, isDirectory });
      }
    },
    { type: "separator" },
    // { label: 'Copy', role: 'copy', enabled: false }, // TODO: Implement copy path/file
    // { label: 'Paste', role: 'paste', enabled: false }, // TODO: Implement
    // { type: 'separator' },
    {
      label: "Open in Terminal",
      click: () => {
        event.sender.send("context-menu-command", { command: "open-in-terminal", path: itemPath, isDirectory });
      }
    },
    { type: "separator" },
    {
      label: "Add to AI Context",
      click: () => {
        event.sender.send("context-menu-command", { command: "add-to-ai-context", path: itemPath, isDirectory });
      }
    }
  ];
  const menu = electron.Menu.buildFromTemplate(template);
  if (mainWindow) {
    menu.popup({ window: mainWindow });
  }
});
electron.ipcMain.on("pty-host:init", (event) => {
  if (ptyProcess) ptyProcess.kill();
  ptyProcess = pty__namespace.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: process.env.HOME || os.homedir(),
    env: process.env
  });
  ptyProcess.onData((data) => event.sender.send("pty-host:data", data));
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`PTY process exited with code ${exitCode}, signal ${signal}`);
    event.sender.send("pty-host:exit");
    ptyProcess = null;
  });
});
electron.ipcMain.on("pty-host:write", (_event, data) => ptyProcess == null ? void 0 : ptyProcess.write(data));
electron.ipcMain.on("pty-host:resize", (_event, { cols, rows }) => {
  if (ptyProcess) try {
    ptyProcess.resize(cols, rows);
  } catch (e) {
    console.error("Error resizing PTY:", e);
  }
});
electron.app.whenReady().then(createWindow);
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
electron.app.on("window-all-closed", () => {
  if (ptyProcess) ptyProcess.kill();
  if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.on("show-app-menu", (event, position) => {
  const template = [
    {
      label: "File",
      submenu: [
        { label: "Open Folder...", click: () => {
          mainWindow == null ? void 0 : mainWindow.webContents.send("trigger-open-folder");
        } },
        { label: "Create New Project...", click: () => {
          console.log("New Project clicked (Post-MVP)");
        } },
        { type: "separator" },
        { label: "Save", accelerator: "CmdOrCtrl+S", click: () => {
          mainWindow == null ? void 0 : mainWindow.webContents.send("trigger-save");
        } },
        { label: "Save As...", accelerator: "CmdOrCtrl+Shift+S", click: () => {
          mainWindow == null ? void 0 : mainWindow.webContents.send("trigger-save-as");
        } },
        { type: "separator" },
        { label: "Close Tab", accelerator: "CmdOrCtrl+W", click: () => {
          mainWindow == null ? void 0 : mainWindow.webContents.send("trigger-close-tab");
        } },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        { label: "Settings...", click: () => {
          mainWindow == null ? void 0 : mainWindow.webContents.send("open-settings");
        } }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...process.platform === "darwin" ? [
          { type: "separator" },
          { role: "front" },
          { type: "separator" },
          { role: "window" }
        ] : [{ role: "close" }]
      ]
    },
    {
      role: "help",
      submenu: [{ label: "Learn More (AnchorIDE)", click: async () => {
        const { shell: shell2 } = require("electron");
        await shell2.openExternal("https://github.com/frostyknees/anchoride");
      } }]
    }
  ];
  const menu = electron.Menu.buildFromTemplate(template);
  if (mainWindow && position) menu.popup({ window: mainWindow, x: position.x, y: position.y });
  else if (mainWindow && process.platform !== "darwin") console.log("Menu display on non-macOS without position needs custom handling in renderer.");
  else electron.Menu.setApplicationMenu(menu);
});

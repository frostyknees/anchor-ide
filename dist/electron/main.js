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
      // __dirname is defined by CommonJS
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
electron.ipcMain.handle("dark-mode:get-initial", () => {
  return electron.nativeTheme.shouldUseDarkColors;
});
electron.ipcMain.handle("dialog:openFolder", async () => {
  if (!mainWindow) return void 0;
  const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"]
  });
  if (canceled || filePaths.length === 0) {
    return void 0;
  } else {
    return filePaths[0];
  }
});
electron.ipcMain.handle("fs:readDir", async (_event, dirPath) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items.map((item) => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      isFile: item.isFile(),
      path: path__namespace.join(dirPath, item.name)
      // Add full path
    }));
  } catch (error) {
    console.error("Error reading directory:", error);
    return { error: error.message || "Failed to read directory" };
  }
});
electron.ipcMain.handle("fs:readFile", async (_event, filePath) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { content };
  } catch (error) {
    console.error("Error reading file:", error);
    return { error: error.message || "Failed to read file" };
  }
});
electron.ipcMain.on("pty-host:init", (event) => {
  if (ptyProcess) {
    ptyProcess.kill();
  }
  ptyProcess = pty__namespace.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: process.env.HOME || os.homedir(),
    env: process.env
  });
  ptyProcess.onData((data) => {
    event.sender.send("pty-host:data", data);
  });
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`PTY process exited with code ${exitCode}, signal ${signal}`);
    event.sender.send("pty-host:exit");
    ptyProcess = null;
  });
});
electron.ipcMain.on("pty-host:write", (_event, data) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});
electron.ipcMain.on("pty-host:resize", (_event, { cols, rows }) => {
  if (ptyProcess) {
    try {
      ptyProcess.resize(cols, rows);
    } catch (e) {
      console.error("Error resizing PTY:", e);
    }
  }
});
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (ptyProcess) {
    ptyProcess.kill();
  }
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
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
        ] : [
          { role: "close" }
        ]
      ]
    },
    {
      role: "help",
      submenu: [
        {
          label: "Learn More (AnchorIDE)",
          click: async () => {
            const { shell: shell2 } = require("electron");
            await shell2.openExternal("https://github.com/frostyknees/anchoride");
          }
        }
      ]
    }
  ];
  const menu = electron.Menu.buildFromTemplate(template);
  if (mainWindow && position) {
    menu.popup({ window: mainWindow, x: position.x, y: position.y });
  } else if (mainWindow && process.platform !== "darwin") {
    console.log("Menu display on non-macOS without position needs custom handling in renderer.");
  } else {
    electron.Menu.setApplicationMenu(menu);
  }
});

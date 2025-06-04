import type { AppSettings, DirectoryItem, FileSystemResult } from '../src/types';
export interface ElectronAPI {
    onUpdateTheme: (callback: (isDarkMode: boolean) => void) => () => void;
    getInitialTheme: () => Promise<boolean>;
    toggleDarkMode: () => Promise<boolean>;
    setSystemTheme: () => Promise<void>;
    showAppMenu: (position?: {
        x: number;
        y: number;
    }) => void;
    sendWindowControl: (action: 'minimize' | 'maximize' | 'unmaximize' | 'close') => void;
    onWindowMaximized: (callback: (isMaximized: boolean) => void) => (() => void);
    openFolderDialog: () => Promise<string | undefined>;
    readDir: (dirPath: string) => Promise<DirectoryItem[] | {
        error: string;
    }>;
    readFile: (filePath: string) => Promise<{
        content: string;
    } | {
        error: string;
    }>;
    saveFile: (filePath: string, content: string) => Promise<FileSystemResult>;
    createFile: (filePath: string) => Promise<FileSystemResult>;
    createFolder: (folderPath: string) => Promise<FileSystemResult>;
    renameItem: (oldPath: string, newName: string) => Promise<FileSystemResult>;
    deleteItem: (itemPath: string, isDirectory: boolean) => Promise<FileSystemResult>;
    showFileExplorerContextMenu: (itemPath: string, isDirectory: boolean) => void;
    onContextMenuCommand: (callback: (args: {
        command: string;
        path: string;
        isDirectory: boolean;
    }) => void) => (() => void);
    openPathInTerminal: (path: string) => void;
    ptyHostWrite: (data: string) => void;
    ptyHostResize: (cols: number, rows: number) => void;
    onPtyHostData: (callback: (data: string | Uint8Array) => void) => (() => void);
    ptyHostInit: () => void;
    getAppSettings: () => Promise<Partial<AppSettings>>;
    saveAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
    send: (channel: string, data?: any) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => (() => void);
}
//# sourceMappingURL=preload.d.ts.map
import type * as monacoApi from 'monaco-editor';
import React from 'react';
import type { ElectronAPI } from './index';

export interface DirectoryItem {
    id: string;
    name: string;
    type: 'directory' | 'file';
    path: string;
    children?: DirectoryItem[];
}

export interface FileSystemResult {
    success: boolean;
    path?: string;
    error?: string;
    message?: string;
}

export interface ChatInputHandle {
    addTextToInput: (textToAdd: string) => void;
}

export interface DocumentSymbol {
    name: string;
    kind: monacoApi.languages.SymbolKind;
    range: monacoApi.IRange;
    children?: DocumentSymbol[];
}

export interface EditorFile {
    id: string;
    name: string;
    content: string;
    language?: string;
    isDirty?: boolean;
}

export interface ElectronDraggableStyle extends React.CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
}

export interface PanelLayout {
    [groupId: string]: number[];
}

export interface AppSettings {
    windowBounds?: {
        width: number;
        height: number;
        x?: number;
        y?: number;
    };
    isMaximized?: boolean;
    openedFolderPath: string | null;
    openFilePaths: string[]; // Used by main process persistence
    activeFileId: string | null; // Used by main process persistence
    chatHistory: {
        sender: string;
        text: string;
    }[];
    panelVisibility: {
        fileExplorer: boolean;
        outlineView: boolean;
        chatPanel: boolean;
        terminalPanel: boolean;
        devPlanPanel: boolean;
    };
    theme: 'light' | 'dark' | 'system';
}


// Augment the Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
    // If you expose other APIs globally via preload, add them here too
  }
}

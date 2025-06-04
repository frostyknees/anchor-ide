import React from 'react';
import type * as monacoApi from 'monaco-editor';
import type { DirectoryItem, DocumentSymbol } from '../types';
interface EditorAreaProps {
    fileToOpen: DirectoryItem | null;
    isFolderCurrentlyOpen: boolean;
    onOpenFolder: () => void;
    onEditorSymbolsChange: (symbols: DocumentSymbol[]) => void;
    editorRef: React.MutableRefObject<monacoApi.editor.IStandaloneCodeEditor | null>;
    initialOpenFiles: string[];
    initialActiveFileId: string | null;
    onOpenFilesChange: (openFilePaths: string[]) => void;
    onActiveFileChange: (activeFileId: string | null) => void;
}
declare const EditorArea: React.FC<EditorAreaProps>;
export default EditorArea;

import React from 'react';
import type { DirectoryItem } from '../types';
interface FileExplorerProps {
    onOpenFile: (file: DirectoryItem) => void;
    rootPathToLoad: string | null;
    onAddPathToChatContext: (path: string, isDirectory: boolean) => void;
}
declare const FileExplorer: React.FC<FileExplorerProps>;
export default FileExplorer;

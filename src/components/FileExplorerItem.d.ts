import React from 'react';
import type { DirectoryItem } from '../types';
interface FileExplorerItemProps {
    item: DirectoryItem;
    onOpenItem: (item: DirectoryItem) => void;
    level: number;
    refreshNonce: number;
}
declare const FileExplorerItem: React.FC<FileExplorerItemProps>;
export default FileExplorerItem;

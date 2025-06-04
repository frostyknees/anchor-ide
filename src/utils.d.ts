import * as monacoApi from 'monaco-editor';
export declare const getBasename: (filePath: string) => string;
export declare const getDirname: (filePath: string) => string;
export declare const getFileIcon: (name: string, isDirectory: boolean, _isOpen?: boolean) => JSX.Element;
export declare const getSymbolIcon: (kind: monacoApi.languages.SymbolKind) => JSX.Element;

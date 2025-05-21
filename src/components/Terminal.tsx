// src/components/Terminal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Terminal as XTermTerminal, ITerminalOptions } from '@xterm/xterm'; 
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const xtermThemeDark: ITerminalOptions['theme'] = { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4', selectionBackground: '#555555', selectionForeground: '#ffffff' };
  const xtermThemeLight: ITerminalOptions['theme'] = { background: '#ffffff', foreground: '#333333', cursor: '#333333', selectionBackground: '#bad6fd', selectionForeground: '#000000' };

  useEffect(() => {
    let term: XTermTerminal | null = null;
    let fit: FitAddon | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let onDataDisposable: { dispose: () => void } | null = null;
    let removePtyDataListener: (() => void) | undefined;
    let removeThemeListener: (() => void) | undefined;


    const initTerminal = (currentIsDark: boolean) => {
      if (terminalRef.current && !xtermRef.current) {
        term = new XTermTerminal({
          cursorBlink: true,
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 14,
          theme: currentIsDark ? xtermThemeDark : xtermThemeLight,
          allowProposedApi: true, 
        });
        fit = new FitAddon();
        fitAddonRef.current = fit;
        term.loadAddon(fit);
        
        try {
          term.open(terminalRef.current);
          requestAnimationFrame(() => {
            fit?.fit();
             if (xtermRef.current) { 
                window.electronAPI?.ptyHostResize?.(xtermRef.current.cols, xtermRef.current.rows);
            }
          });
        } catch (e) {
          console.error("Error opening terminal or fitting:", e);
          return; 
        }
        
        term.write('AnchorIDE Terminal :: MVP\r\n$ ');
        xtermRef.current = term;

        window.electronAPI?.ptyHostInit?.();

        removePtyDataListener = window.electronAPI?.onPtyHostData?.((data) => {
          xtermRef.current?.write(typeof data === 'string' ? data : new Uint8Array(data));
        });
        
        onDataDisposable = term.onData(data => {
          window.electronAPI?.ptyHostWrite?.(data);
        });

        resizeObserver = new ResizeObserver(() => {
          try {
            fitAddonRef.current?.fit();
            if (xtermRef.current) {
                window.electronAPI?.ptyHostResize?.(xtermRef.current.cols, xtermRef.current.rows);
            }
          } catch (e) {
            console.error("Error fitting terminal on resize:", e);
          }
        });
        
        const parentElement = terminalRef.current?.parentElement;
        if (parentElement) { 
          resizeObserver.observe(parentElement);
        }
      }
    };
    
    window.electronAPI?.getInitialTheme?.().then(initialIsDark => {
        setIsDarkMode(initialIsDark);
        initTerminal(initialIsDark); 
    });

    removeThemeListener = window.electronAPI?.onUpdateTheme?.((darkMode) => {
        setIsDarkMode(darkMode);
        if (xtermRef.current && xtermRef.current.options) { 
          xtermRef.current.options.theme = darkMode ? xtermThemeDark : xtermThemeLight;
        }
    });

    return () => {
      onDataDisposable?.dispose();
      if (removePtyDataListener) removePtyDataListener();
      if (removeThemeListener) removeThemeListener();
      resizeObserver?.disconnect();
      if (xtermRef.current) { 
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []); 

  return <div ref={terminalRef} className="terminal-instance-wrapper" style={{ height: '100%', width: '100%', padding: '5px', backgroundColor: isDarkMode ? xtermThemeDark.background : xtermThemeLight.background }}></div>;
};
export default Terminal;
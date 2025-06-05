// src/components/Terminal.tsx
import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import { Terminal as XTermTerminal, ITerminalOptions } from '@xterm/xterm'; 
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalHandles {
  fitTerminal: () => void;
  focusTerminal: () => void;
}

const Terminal = React.forwardRef<TerminalHandles, {}>((props, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null); 
  const [isDarkMode, setIsDarkMode] = useState(false);

  const xtermThemeDark: ITerminalOptions['theme'] = { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4', selectionBackground: '#555555', selectionForeground: '#ffffff' };
  const xtermThemeLight: ITerminalOptions['theme'] = { background: '#ffffff', foreground: '#333333', cursor: '#333333', selectionBackground: '#bad6fd', selectionForeground: '#000000' };

  const fitTerminal = useCallback(() => {
    if (terminalRef.current && terminalRef.current.offsetParent !== null && xtermRef.current && fitAddonRef.current) {
      try {
        fitAddonRef.current.fit();
        requestAnimationFrame(() => { 
          if (xtermRef.current && xtermRef.current.cols > 0 && xtermRef.current.rows > 0) {
            window.electronAPI?.resizeTerminal?.(xtermRef.current.cols, xtermRef.current.rows);
          }
        });
      } catch (e) {
        console.error("Error fitting terminal:", e);
      }
    }
  }, []);

  const focusTerminal = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  useImperativeHandle(ref, () => ({
    fitTerminal,
    focusTerminal
  }), [fitTerminal, focusTerminal]);

  useEffect(() => {
    let term: XTermTerminal | null = null;
    let resizeObserverInstance: ResizeObserver | null = null;
    let onDataDisposable: { dispose: () => void } | null = null;
    let removePtyDataListener: (() => void) | undefined;
    let removePtyExitListener: (() => void) | undefined;
    let removeThemeListener: (() => void) | undefined;

    console.log('[Terminal.tsx] useEffect setup: Initializing terminal component and PTY connection.');
    const initTerminal = (currentIsDark: boolean) => {
      if (terminalRef.current && !xtermRef.current) {
        const localFitAddon = new FitAddon(); 
        fitAddonRef.current = localFitAddon; 

        term = new XTermTerminal({
          cursorBlink: true,
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 14,
          theme: currentIsDark ? xtermThemeDark : xtermThemeLight,
          allowProposedApi: true, 
        });
        term.loadAddon(localFitAddon);

        try {
          term.open(terminalRef.current);
          requestAnimationFrame(() => {
            localFitAddon.fit(); 
            if (term && term.cols > 0 && term.rows > 0) { 
              window.electronAPI?.resizeTerminal?.(term.cols, term.rows);
            }
          });
        } catch (e) {
          console.error("Error opening terminal or fitting:", e);
          return; 
        }
        
        term.write('AnchorIDE Terminal :: MVP\r\n$ ');
        xtermRef.current = term;

        window.electronAPI?.initTerminal?.();

        removePtyDataListener = window.electronAPI?.onTerminalData?.((data: string | Uint8Array) => {
          xtermRef.current?.write(typeof data === 'string' ? data : new Uint8Array(data));
        });

        removePtyExitListener = window.electronAPI?.onTerminalExit?.(({ exitCode, signal }: { exitCode: number, signal?: number }) => {
          console.log(`Terminal process exited with code ${exitCode}, signal ${signal}`);
          xtermRef.current?.write(`\r\n[PTY process exited with code ${exitCode}${signal ? `, signal ${signal}` : ''}]\r\n`);
        });

        onDataDisposable = term.onData(data => {
          window.electronAPI?.writeToTerminal?.(data);
        });

        resizeObserverInstance = new ResizeObserver(() => {
          fitTerminal(); 
        });

        const parentElement = terminalRef.current?.parentElement;
        if (parentElement) { 
          resizeObserverInstance.observe(parentElement);
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
      console.log('[Terminal.tsx] useEffect cleanup: Disposing Xterm and cleaning up PTY listeners.');
      onDataDisposable?.dispose();
      if (removePtyDataListener) removePtyDataListener();
      if (removePtyExitListener) removePtyExitListener();
      if (removeThemeListener) removeThemeListener();
      if (resizeObserverInstance) {
        resizeObserverInstance.disconnect(); 
      }
      if (xtermRef.current) { 
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      fitAddonRef.current = null; 
    };
  }, [fitTerminal]); 

  return <div ref={terminalRef} className="terminal-instance-wrapper" style={{ height: '100%', width: '100%', padding: '5px', backgroundColor: isDarkMode ? xtermThemeDark.background : xtermThemeLight.background }}></div>;
});
export default React.memo(Terminal);
// src/components/OutlineView.tsx
import React from 'react';
import type { DocumentSymbol } from '../types';
import type * as monacoApi from 'monaco-editor'; // For SymbolKind type
import { getSymbolIcon } from '../utils';

interface OutlineViewProps {
  symbols: DocumentSymbol[];
  onSymbolClick: (symbol: DocumentSymbol) => void;
}

const OutlineView: React.FC<OutlineViewProps> = ({ symbols, onSymbolClick }) => {
  const renderSymbol = (symbol: DocumentSymbol, level: number) => (
    <div key={`${symbol.name}-${symbol.range.startLineNumber}-${level}`} 
         style={{ paddingLeft: `${level * 15}px`, cursor: 'pointer' }}
         className="py-1 outline-item"
         onClick={() => onSymbolClick(symbol)}
         title={`${symbol.name} (Line ${symbol.range.startLineNumber})`}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {getSymbolIcon(symbol.kind as monacoApi.languages.SymbolKind)} {/* Cast kind */}
        <span>{symbol.name}</span>
      </span>
      {symbol.children && symbol.children.length > 0 && (
        <div>{symbol.children.map(child => renderSymbol(child, level + 1))}</div>
      )}
    </div>
  );

  return (
    <div className="p-2 h-100 overflow-auto" style={{ backgroundColor: 'var(--anchor-panel-background)', borderTop: `1px solid var(--anchor-border-color)` }}>
      <h6>OUTLINE</h6>
      {symbols.length === 0 && <div className="text-muted small">No symbols found or no active editor.</div>}
      {symbols.map(symbol => renderSymbol(symbol, 0))}
    </div>
  );
};

export default OutlineView;
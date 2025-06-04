import React from 'react';
import type { DocumentSymbol } from '../types';
interface OutlineViewProps {
    symbols: DocumentSymbol[];
    onSymbolClick: (symbol: DocumentSymbol) => void;
}
declare const OutlineView: React.FC<OutlineViewProps>;
export default OutlineView;

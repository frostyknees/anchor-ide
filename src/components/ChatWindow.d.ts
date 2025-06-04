import React from 'react';
import type { ChatInputHandle } from '../types';
interface ChatMessage {
    sender: string;
    text: string;
}
interface ChatWindowProps {
    chatInputRef: React.RefObject<ChatInputHandle>;
    initialHistory?: ChatMessage[];
    onHistoryChange?: (history: ChatMessage[]) => void;
}
declare const ChatWindow: React.FC<ChatWindowProps>;
export default ChatWindow;

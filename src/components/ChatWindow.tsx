// src/components/ChatWindow.tsx
import React, { useState, useEffect, useRef } from 'react';
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

const ChatWindow: React.FC<ChatWindowProps> = ({ chatInputRef, initialHistory, onHistoryChange }) => { 
  const [message, setMessage] = useState(''); 
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(initialHistory || []);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const actualInputRef = useRef<HTMLInputElement>(null); 
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Load initial history
  useEffect(() => {
    if (initialHistory) {
      setChatHistory(initialHistory);
    }
  }, [initialHistory]);

  // Propagate history changes
  useEffect(() => {
    if (onHistoryChange) {
      onHistoryChange(chatHistory);
    }
  }, [chatHistory, onHistoryChange]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatHistory]);


  const handleSend = () => {
    if (message.trim() === '') return;
    const newUserMessage = { sender: 'User', text: message };
    setChatHistory(prev => [...prev, newUserMessage]);
    setMessage('');
    setIsAiThinking(true);
    
    setTimeout(() => {
      setChatHistory(prev => [...prev, { sender: 'AI', text: `Received: "${newUserMessage.text}". I am processing...` }]);
      setIsAiThinking(false);
    }, 1500);
  };
  
  React.useImperativeHandle(chatInputRef, () => ({
    addTextToInput: (textToAdd: string) => {
        setMessage(prev => (prev ? prev + " " : "") + textToAdd + " "); 
        actualInputRef.current?.focus(); 
    }
  }), []);


  return (
    <div className="d-flex flex-column h-100 p-2" style={{ backgroundColor: 'var(--anchor-panel-background)'}}>
      <h6>CHAT</h6>
      <div ref={chatBodyRef} className="flex-grow-1 overflow-auto mb-2 border rounded p-2" style={{ backgroundColor: 'var(--anchor-background)'}}>{chatHistory.map((chat, index) => (<div key={index} className={`mb-2 p-2 rounded ${chat.sender === 'User' ? 'bg-light text-dark ms-auto' : 'bg-primary text-white me-auto'}`} style={{maxWidth: '80%'}}><strong>{chat.sender}:</strong> {chat.text}</div>))}{isAiThinking && <div className="text-muted small fst-italic">AI is thinking...</div>}</div>
      <div className="d-flex">
        <input
          ref={actualInputRef} 
          type="text"
          className="form-control me-2 chat-input-field" 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isAiThinking && handleSend()}
          placeholder="Chat with AnchorAI..."
          disabled={isAiThinking}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={isAiThinking || message.trim() === ''}><i className={`bi ${isAiThinking ? 'bi-stop-circle' : 'bi-send'}`}></i></button>
      </div>
    </div>
  );
};

export default ChatWindow;
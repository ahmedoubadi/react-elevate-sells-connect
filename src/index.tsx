import React, { useEffect } from 'react';
import ChatWindow from 'Components/ChatBot/ChatWindow';

/**
 * ChatWindow Component Props
 */
export interface ChatBotProps {
  apiKey: string;
  assistantId: string;
}

export default ChatWindow;

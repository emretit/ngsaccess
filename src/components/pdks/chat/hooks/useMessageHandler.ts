
import { useState } from 'react';
import { Message, MessageData } from '../types';
import { sendChatMessage } from '../services/chatService';
import { useMessages } from './useMessages';
import { useInput } from './useInput';

export function useMessageHandler() {
  const { messages, addMessage } = useMessages();
  const { input, setInput, isLoading, setIsLoading } = useInput();

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      type: 'user',
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(content);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.content,
        type: 'assistant',
        timestamp: new Date(),
        // Sadece response'da data varsa ekle
        data: 'data' in response && response.data ? response.data : undefined,
        hasTable: 'data' in response && response.data ? response.data.length > 0 : false,
        query: 'data' in response && response.data && response.data.length > 0 
          ? `Generated query for: ${content}` 
          : undefined
      };

      addMessage(aiMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        type: 'assistant',
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    handleSendMessage,
  };
}

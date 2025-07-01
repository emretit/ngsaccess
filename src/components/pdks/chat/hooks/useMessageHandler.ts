
import { useState } from 'react';
import { Message, MessageData } from '../types';
import { chatService } from '../services/chatService';

interface UseMessageHandlerProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (message: Message) => void;
}

export function useMessageHandler({ messages, setMessages, addMessage }: UseMessageHandlerProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(content);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.content,
        role: 'assistant',
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
        role: 'assistant',
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleSendMessage,
    isLoading,
  };
}


import { useToast } from "@/hooks/use-toast";
import { Message } from '../types';
import { sendChatMessage } from '../services/chatService';
import { useMessages } from './useMessages';
import { useInput } from './useInput';

export function useMessageHandler() {
  const { toast } = useToast();
  const { messages, addMessage } = useMessages();
  const { input, setInput, isLoading, setIsLoading } = useInput();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input
    };

    addMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(input);
      
      const aiMessage: Message = {
        id: `response-${userMessage.id}`,
        type: 'assistant',
        content: response.content
      };
      
      addMessage(aiMessage);
    } catch (error) {
      console.error('AI chat error:', error);
      
      const errorMessage: Message = {
        id: `error-${userMessage.id}`,
        type: 'assistant',
        content: `Üzgünüm, bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}. GPT4All uygulamasının çalıştığından emin olun.`
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
    handleSendMessage
  };
}


import { useToast } from "@/hooks/use-toast";
import { Message } from '../types';
import { sendChatMessage } from '../services/chatService';
import { useMessages } from './useMessages';
import { useInput } from './useInput';

export function useMessageHandler() {
  const { toast } = useToast();
  const { messages, addMessage } = useMessages();
  const { input, setInput, isLoading, setIsLoading } = useInput();

  const handleSendMessage = async (e: React.FormEvent, customContent?: string) => {
    e.preventDefault();
    
    // Kullanılacak içerik - özelleştirilmiş içerik veya normal input
    const messageContent = customContent || input;
    
    if (!messageContent.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageContent
    };

    addMessage(userMessage);
    
    if (!customContent) {
      setInput(''); // Sadece normal input ise temizle, özelleştirilmiş içerik kullanıldığında temizleme
    }
    
    setIsLoading(true);

    try {
      const response = await sendChatMessage(messageContent);
      
      const aiMessage: Message = {
        id: `response-${userMessage.id}`,
        type: 'assistant',
        content: response.content,
        data: response.data // Include the data if it exists
      };
      
      addMessage(aiMessage);
      
      if (response.data && response.data.length > 0) {
        toast({
          title: "Veri başarıyla getirildi",
          description: `${response.data.length} kayıt bulundu.`,
        });
      }
    } catch (error) {
      console.error('AI chat error:', error);
      
      const errorMessage: Message = {
        id: `error-${userMessage.id}`,
        type: 'assistant',
        content: `Üzgünüm, bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}.`
      };
      
      addMessage(errorMessage);
      
      toast({
        title: "Hata",
        description: "Mesaj işlenirken bir hata oluştu.",
        variant: "destructive"
      });
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

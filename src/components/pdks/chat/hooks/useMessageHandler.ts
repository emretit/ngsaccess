
import { useToast } from "@/hooks/use-toast";
import { Message } from '../types';
import { sendChatMessage, executeSqlQuery } from '../services/chatService';
import { useMessages } from './useMessages';
import { useInput } from './useInput';
import { useExportUtils } from '../useExportUtils';
import { LOCAL_LLAMA_ENDPOINTS } from '../constants';

export function useMessageHandler() {
  const { toast } = useToast();
  const { messages, addMessage } = useMessages();
  const { input, setInput, isLoading, setIsLoading } = useInput();
  const { formatReportData } = useExportUtils();

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
      const lowerInput = input.toLowerCase();
      const isGreeting = ["selam", "merhaba", "hi", "hello", "hey"].some(greeting => 
        lowerInput === greeting || lowerInput.startsWith(`${greeting} `)
      );
      
      const isReportQuery = lowerInput.startsWith('rapor:');

      // Handle simple greetings immediately without calling AI
      if (isGreeting && !isReportQuery) {
        const greetingResponse: Message = {
          id: `response-${userMessage.id}`,
          type: 'assistant',
          content: 'Merhaba! Size nasıl yardımcı olabilirim? Rapor sorguları için mesajınıza "Rapor:" ile başlayabilirsiniz.'
        };
        addMessage(greetingResponse);
        setIsLoading(false);
        return;
      }

      // Try to get response from edge function
      try {
        const response = await sendChatMessage(input);

        if (response) {
          const aiMessage: Message = {
            id: `response-${userMessage.id}`,
            type: 'assistant',
            content: response.content || 'Üzgünüm, yanıt oluşturulamadı.'
          };

          if (isReportQuery && response.sqlQuery) {
            try {
              const sqlData = await executeSqlQuery(response.sqlQuery);
              
              if (sqlData.data && Array.isArray(sqlData.data) && sqlData.data.length > 0) {
                const formattedData = formatReportData(sqlData.data);
                aiMessage.data = formattedData;
                aiMessage.content += "\n\nVeriler başarıyla çekildi.";
              } else {
                aiMessage.content += "\n\nSorgu çalıştı ancak sonuç döndürmedi.";
              }
            } catch (sqlError) {
              console.error("SQL execution error:", sqlError);
              aiMessage.content += `\n\nSQL sorgusu çalıştırılırken bir hata oluştu: ${sqlError.message}`;
            }
          }

          addMessage(aiMessage);
          return;
        }
      } catch (error) {
        console.error('Chat service error:', error);
        throw error;
      }
      
      // If everything fails, provide a fallback response
      const fallbackMessage: Message = {
        id: `error-${userMessage.id}`,
        type: 'assistant',
        content: `Üzgünüm, AI modeline bağlanırken bir sorun oluştu. Yerel model ve uzak servis yanıt vermiyor. Lütfen daha sonra tekrar deneyiniz.`
      };
      addMessage(fallbackMessage);
      
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: Message = {
        id: `error-${userMessage.id}`,
        type: 'assistant',
        content: `Üzgünüm, bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}. Lütfen farklı bir soru sorun veya daha sonra tekrar deneyin.`
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

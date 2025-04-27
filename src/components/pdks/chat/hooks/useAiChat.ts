
import { handleExportExcel, handleExportPDF } from "../utils/exportUtils";
import { useLocalModel } from "./useLocalModel";
import { useMessages } from "./useMessages";
import { Message } from "../types";

export function useAiChat() {
  const { messages, setMessages, input, setInput, isLoading, setIsLoading } = useMessages();
  const { isLocalModelConnected, LOCAL_LLAMA_ENDPOINTS } = useLocalModel();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Supabase Edge Function call
      console.log("Supabase doğal dil sorgu endpoint'i çağrılıyor...");
      const response = await fetch('https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/pdks-natural-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
        signal: AbortSignal.timeout(10000)
      });

      const data = await response.json();
      console.log("Doğal dil sorgusu yanıtı:", data);
      
      if (data.error) {
        const aiMessage: Message = {
          id: `response-${userMessage.id}`,
          type: 'assistant',
          content: data.explanation || 'Sorgunuzu anlamada bir hata oluştu. Lütfen tekrar deneyin.'
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
        return;
      }
      
      if (data.records && Array.isArray(data.records)) {
        if (data.records.length === 0) {
          const aiMessage: Message = {
            id: `response-${userMessage.id}`,
            type: 'assistant',
            content: data.explanation || 'Arama kriterlerinize uygun kayıt bulunamadı.'
          };
          setMessages(prev => [...prev, aiMessage]);
        } else {
          const aiMessage: Message = {
            id: `response-${userMessage.id}`,
            type: 'assistant',
            content: data.explanation || 'İşte rapor sonuçları:',
            data: data.records
          };
          setMessages(prev => [...prev, aiMessage]);
        }
        setIsLoading(false);
        return;
      }

      // If natural language query fails, try local model
      let aiResponse = "Üzgünüm, raporlar için sorgunuzu anlayamadım. Lütfen 'Finans departmanı mart ayı giriş raporu' gibi daha açık bir ifade kullanın.";
      
      if (isLocalModelConnected) {
        for (const endpoint of LOCAL_LLAMA_ENDPOINTS.completion) {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: `Sen bir PDKS (Personel Devam Kontrol Sistemi) asistanısın. Kullanıcının sorusu: ${input}`,
                max_tokens: 500,
                temperature: 0.7,
                stop: ["###"]
              }),
              signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
              const data = await response.json();
              aiResponse = data.content || data.response || data.generated_text || data.choices?.[0]?.text || "Yanıt alınamadı.";
              break;
            }
          } catch (endpointError) {
            console.warn(`Endpoint hatası:`, endpointError);
          }
        }
      }

      const aiMessage: Message = {
        id: `response-${userMessage.id}`,
        type: 'assistant',
        content: aiResponse
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI sohbet hatası:', error);
      const errorMessage: Message = {
        id: `error-${userMessage.id}`,
        type: 'assistant',
        content: 'Üzgünüm, bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    isLocalModelConnected,
    handleSendMessage,
    handleExportExcel,
    handleExportPDF
  };
}

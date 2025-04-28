
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_NATURAL_QUERY_ENDPOINT, LOCAL_MODEL_ENABLED } from './constants';
import { Message } from './types';
import { useModelStatus } from './useModelStatus';
import { useExportUtils } from './useExportUtils';
import { useToast } from "@/hooks/use-toast";

export function useAiChat() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    type: 'assistant',
    content: 'Merhaba! Ben PDKS asistanıyım. Size nasıl yardımcı olabilirim? Normal sohbet edebiliriz veya "Rapor:" ile başlayan sorularla PDKS verilerinizi analiz edebilirim.'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, any> | null>(null);
  
  const { isLocalModelConnected, checkLocalModelStatus } = useModelStatus();
  const { formatReportData, handleExportExcel, handleExportPDF } = useExportUtils();

  const createLlamaPrompt = (userInput: string) => {
    // Rapor sorgusu olup olmadığını kontrol et
    const isReportQuery = userInput.toLowerCase().startsWith('rapor:');
    
    if (isReportQuery) {
      // Rapor sorgusu için özel prompt
      return `Sen bir PDKS (Personel Devam Kontrol Sistemi) asistanısın. Görevin, personel giriş-çıkış kayıtları hakkında soruları yanıtlamak ve raporlar oluşturmak.

Kullanıcı Sorusu: ${userInput.substring(6).trim()}

Lütfen aşağıdaki formatta yanıt ver:
1. Anlaşılır bir dille sorguyu açıkla
2. Hangi filtreleri kullanacağını belirt (departman, tarih aralığı, vs.)
3. Varsa özel durumları vurgula

Örnek veri yapısı:
- name: Personel adı
- check_in: Giriş saati
- check_out: Çıkış saati
- department: Departman
- device: Kullanılan cihaz
- location: Konum

Not: Yanıtında samimi ve yardımsever bir ton kullan.`;
    } else {
      // Normal sohbet için genel prompt
      return `Sen yardımcı bir asistansın. Kullanıcı PDKS (Personel Devam Kontrol Sistemi) uygulaması kullanıyor, 
ve seninle normal sohbet etmek istiyor. Sorulara doğal ve samimi bir şekilde yanıt ver.

Kullanıcı Sorusu: ${userInput}

Yanıtın doğal, samimi ve yardımcı olsun.`;
    }
  };

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
    console.log("Handling user message:", input);

    try {
      // Rapor sorgusu olup olmadığını kontrol et
      const isReportQuery = input.toLowerCase().startsWith('rapor:');
      
      // First, try to use the Supabase Edge Function for processing (supports both chat and report)
      console.log("Calling Supabase pdks-ai edge function");
      
      const { data: { session } } = await supabase.auth.getSession();
      
      try {
        const response = await supabase.functions.invoke('pdks-ai', {
          body: JSON.stringify({ prompt: input })
        });
        
        console.log("Edge function response:", response);
        
        if (response.error) {
          throw new Error(response.error.message || "Edge function error");
        }
        
        if (response.data) {
          // If the edge function returns data, use it
          const aiMessage: Message = {
            id: `response-${userMessage.id}`,
            type: 'assistant',
            content: response.data.content || 'Üzgünüm, yanıt oluşturulamadı.'
          };
          setMessages(prev => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        }
      } catch (edgeFunctionError) {
        console.error("Edge function error:", edgeFunctionError);
        // Continue to fallback if edge function fails
      }

      // If still here, try the local Llama API directly
      if (isLocalModelConnected && LOCAL_MODEL_ENABLED) {
        try {
          // Try local Llama model
          console.log("Trying local Llama model directly");
          const llamaResponse = await fetch("http://localhost:5050/completion", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: createLlamaPrompt(input),
              temperature: 0.7,
              max_tokens: 500
            }),
            signal: AbortSignal.timeout(10000)
          });

          if (llamaResponse.ok) {
            const data = await llamaResponse.json();
            const aiMessage: Message = {
              id: `response-${userMessage.id}`,
              type: 'assistant',
              content: data.content || 'Üzgünüm, yanıt oluşturulamadı.'
            };
            setMessages(prev => [...prev, aiMessage]);
            setIsLoading(false);
            return;
          } else {
            console.log("Llama response not OK, status:", llamaResponse.status);
            // Fall through to next option
          }
        } catch (llamaError) {
          console.error("Direct Llama API error:", llamaError);
          // Fall through to next option
        }
      }

      // Fallback for normal chat (more responsive than before)
      if (!isReportQuery) {
        // Generate a simple response based on the input for normal chat mode
        let responseContent = "Merhaba! Size nasıl yardımcı olabilirim?";
        
        if (input.toLowerCase().includes('merhaba') || input.toLowerCase().includes('selam')) {
          responseContent = "Merhaba! Ben PDKS asistanıyım. Nasıl yardımcı olabilirim?";
        } else if (input.toLowerCase().includes('nasılsın')) {
          responseContent = "Ben bir AI asistanı olarak harikayım, teşekkürler! Size nasıl yardımcı olabilirim?";
        } else if (input.toLowerCase().includes('adın') || input.toLowerCase().includes('ismin')) {
          responseContent = "Ben PDKS AI asistanıyım. Personel Devam Kontrol Sistemi verilerinizle ilgili sorularınızı yanıtlayabilirim.";
        } else if (input.toLowerCase().includes('teşekkür')) {
          responseContent = "Rica ederim! Başka bir konuda yardıma ihtiyacınız olursa buradayım.";
        } else if (input.toLowerCase().includes('ne yapabilirsin')) {
          responseContent = "Normal sohbet edebilirim veya 'Rapor:' ile başlayan sorularınızla PDKS verilerinizi analiz edebilirim. Örneğin: 'Rapor: Bugün işe gelenler' gibi.";
        } else {
          responseContent = `Anlıyorum, "${input}" hakkında konuşmak istiyorsunuz. Size daha iyi hizmet verebilmem için normal sohbet edebiliriz veya 'Rapor:' ile başlayan bir soru sorarak PDKS verilerinizi sorgulayabilirsiniz.`;
        }
        
        const fallbackMessage: Message = {
          id: `response-${userMessage.id}`,
          type: 'assistant',
          content: responseContent
        };
        setMessages(prev => [...prev, fallbackMessage]);
        setIsLoading(false);
        return;
      }

      // If it's a report query and we're still here, use the natural language query API
      console.log("Calling Supabase natural language query endpoint:", SUPABASE_NATURAL_QUERY_ENDPOINT);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const actualQuery = isReportQuery ? input.substring(6).trim() : input;

        const response = await fetch(SUPABASE_NATURAL_QUERY_ENDPOINT, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqdWRzZ2hod21uc25uZG5zd2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyMzk1NTMsImV4cCI6MjA1MTgxNTU1M30.9mA6Q1JDCszfH3nujNpGWd36M4qxZ-L38GPTaNIsjVg'
          },
          body: JSON.stringify({ query: actualQuery }),
          signal: AbortSignal.timeout(15000)
        });

        console.log("Natural language query response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("Natural language query response data:", data);
          setDebugInfo(data);
          
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            const formattedData = formatReportData(data.data);
            
            const aiMessage: Message = {
              id: `response-${userMessage.id}`,
              type: 'assistant',
              content: data.explanation || 'İşte rapor sonuçları:',
              data: formattedData
            };
            
            setMessages(prev => [...prev, aiMessage]);
            setIsLoading(false);
            return;
          } 
          else if (data.error) {
            throw new Error(data.error);
          }
          else {
            console.log("Natural language query returned no records");
            
            let detailedExplanation = "Sorgunuza uygun kayıt bulunamadı.";
            
            if (data.explanation) {
              detailedExplanation += " " + data.explanation;
            }
            
            detailedExplanation += " Lütfen farklı filtreleme kriterleri kullanarak tekrar deneyin.";
            
            const noDataMessage: Message = {
              id: `response-${userMessage.id}`,
              type: 'assistant',
              content: detailedExplanation
            };
            
            setMessages(prev => [...prev, noDataMessage]);
          }
        } else {
          const errorText = await response.text();
          console.error("Natural language query error response:", errorText);
          throw new Error(`Doğal dil işleme hatası: ${errorText}`);
        }
      } catch (nlpError) {
        console.error("Natural language processing error:", nlpError);
        throw nlpError;
      }
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: Message = {
        id: `error-${userMessage.id}`,
        type: 'assistant',
        content: `Üzgünüm, bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}. Lütfen farklı bir soru sorun veya daha sonra tekrar deneyin.`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("useAiChat hook initialized");
    if (LOCAL_MODEL_ENABLED) {
      checkLocalModelStatus();
    }
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    isLocalModelConnected,
    checkLocalModelStatus,
    handleSendMessage,
    handleExportExcel,
    handleExportPDF,
    debugInfo
  };
}

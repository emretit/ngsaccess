
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_NATURAL_QUERY_ENDPOINT, LOCAL_MODEL_ENABLED } from './constants';
import { Message } from './types';
import { useModelStatus } from './useModelStatus';
import { useExportUtils } from './useExportUtils';

export function useAiChat() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    type: 'assistant',
    content: 'Merhaba! Size nasıl yardımcı olabilirim? Normal sohbet edebilir veya PDKS rapor sorguları sorabilirim. Örnek rapor sorguları:\n- "Rapor: Finans departmanı mart ayı giriş kayıtları"\n- "Rapor: Bugün işe gelenlerin listesi"\n- "Rapor: Geçen ay en çok geç kalan personel"'
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
ancak şu anda seninle normal sohbet etmek istiyor. Sorulara doğal ve samimi bir şekilde yanıt ver.

Kullanıcı Sorusu: ${userInput}

Eğer kullanıcı PDKS verileri hakkında soru sorarsa, ona şunu belirtebilirsin:
"Detaylı rapor almak isterseniz, sorunuzu 'Rapor:' ile başlatabilirsiniz. Örneğin, 'Rapor: Nisan ayı devamsızlık durumu'"

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
      
      if (isLocalModelConnected) {
        // Try local Llama model
        console.log("Trying local Llama model");
        const llamaResponse = await fetch("http://localhost:5050/completion", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: createLlamaPrompt(input),
            temperature: 0.7,
            max_tokens: 500,
            stop: ["###"]
          })
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
        }
      }

      // Eğer rapor sorgusu değilse ve Llama başarısız olduysa, basit bir yanıt ver
      if (!isReportQuery) {
        const fallbackMessage: Message = {
          id: `response-${userMessage.id}`,
          type: 'assistant',
          content: `Üzgünüm, şu anda Llama modeline bağlanamadım ve normal sohbet desteği veremiyorum. Rapor sorguları için lütfen 'Rapor:' ile başlayan sorular sorun.`
        };
        setMessages(prev => [...prev, fallbackMessage]);
        setIsLoading(false);
        return;
      }

      // Eğer buraya kadar geldiyse, rapor sorgusu için Supabase API'sini kullan
      console.log("Calling Supabase natural language query endpoint:", SUPABASE_NATURAL_QUERY_ENDPOINT);
      
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

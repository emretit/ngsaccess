
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
      
      // First, try to use the Supabase Edge Function for processing
      console.log("Calling Supabase pdks-ai edge function");
      
      try {
        const response = await supabase.functions.invoke('pdks-ai', {
          body: JSON.stringify({ prompt: input })
        });
        
        console.log("Edge function response:", response);
        
        if (response.error) {
          throw new Error(response.error.message || "Edge function error");
        }
        
        if (response.data) {
          const aiMessage: Message = {
            id: `response-${userMessage.id}`,
            type: 'assistant',
            content: response.data.content || 'Üzgünüm, yanıt oluşturulamadı.'
          };
          
          // If there's a SQL query in the response, execute it
          if (isReportQuery && response.data.sqlQuery) {
            try {
              console.log("Executing SQL query:", response.data.sqlQuery);
              
              // Call either server.py or directly execute the SQL
              const sqlResponse = await fetch("http://localhost:5050/api/execute-sql", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: response.data.sqlQuery
                }),
                signal: AbortSignal.timeout(10000)
              });
              
              if (sqlResponse.ok) {
                const sqlData = await sqlResponse.json();
                console.log("SQL execution results:", sqlData);
                
                if (sqlData.data && Array.isArray(sqlData.data) && sqlData.data.length > 0) {
                  // Format the SQL data
                  const formattedData = formatReportData(sqlData.data);
                  
                  // Add the data to the message
                  aiMessage.data = formattedData;
                  aiMessage.content += "\n\nVeriler başarıyla çekildi.";
                } else {
                  aiMessage.content += "\n\nSorgu çalıştı ancak sonuç döndürmedi.";
                }
              } else {
                const errorText = await sqlResponse.text();
                console.error("SQL execution error:", errorText);
                aiMessage.content += `\n\nSQL sorgusu çalıştırılırken bir hata oluştu: ${errorText}`;
              }
            } catch (sqlError) {
              console.error("SQL execution error:", sqlError);
              aiMessage.content += `\n\nSQL sorgusu çalıştırılırken bir hata oluştu: ${sqlError.message}`;
            }
          }
          
          setMessages(prev => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        }
      } catch (edgeFunctionError) {
        console.error("Edge function error:", edgeFunctionError);
        // Continue to fallback if edge function fails
      }

      // If we're still here, try the local Llama API directly
      if (isLocalModelConnected && LOCAL_MODEL_ENABLED) {
        try {
          // Try local Llama model
          console.log("Trying local Llama model directly");
          const llamaResponse = await fetch("http://localhost:5050/completion", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: input,
              temperature: 0.7,
              max_tokens: 800
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
            
            // If there's a SQL query in the response, execute it
            if (isReportQuery && data.sqlQuery) {
              try {
                console.log("Executing SQL query:", data.sqlQuery);
                
                // Call either server.py or directly execute the SQL
                const sqlResponse = await fetch("http://localhost:5050/api/execute-sql", {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    query: data.sqlQuery
                  }),
                  signal: AbortSignal.timeout(10000)
                });
                
                if (sqlResponse.ok) {
                  const sqlData = await sqlResponse.json();
                  console.log("SQL execution results:", sqlData);
                  
                  if (sqlData.data && Array.isArray(sqlData.data) && sqlData.data.length > 0) {
                    // Format the SQL data
                    const formattedData = formatReportData(sqlData.data);
                    
                    // Add the data to the message
                    aiMessage.data = formattedData;
                    aiMessage.content += "\n\nVeriler başarıyla çekildi.";
                  } else {
                    aiMessage.content += "\n\nSorgu çalıştı ancak sonuç döndürmedi.";
                  }
                } else {
                  const errorText = await sqlResponse.text();
                  console.error("SQL execution error:", errorText);
                  aiMessage.content += `\n\nSQL sorgusu çalıştırılırken bir hata oluştu: ${errorText}`;
                }
              } catch (sqlError) {
                console.error("SQL execution error:", sqlError);
                aiMessage.content += `\n\nSQL sorgusu çalıştırılırken bir hata oluştu: ${sqlError.message}`;
              }
            }
            
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

      // Fallback for normal chat
      if (!isReportQuery) {
        // Generate a response based on the input for normal chat mode
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
          responseContent = `"${input}" hakkındaki sorunuzu anladım. Normal sohbet edebilirim veya 'Rapor:' ile başlayan bir soru sorarak PDKS verilerinizi analiz edebilirsiniz.`;
        }
        
        const fallbackMessage: Message = {
          id: `response-${userMessage.id}`,
          type: 'assistant',
          content: responseContent
        };
        setMessages(prev => [...prev, fallbackMessage]);
        setIsLoading(false);
        return;
      } else {
        // For report queries, inform about missing connectivity
        const noConnectionMessage: Message = {
          id: `response-${userMessage.id}`,
          type: 'assistant',
          content: "Üzgünüm, rapor oluşturmak için AI modeline bağlanamıyorum. Lütfen sistem yöneticinizle iletişime geçin veya bağlantınızı kontrol edin."
        };
        setMessages(prev => [...prev, noConnectionMessage]);
        setIsLoading(false);
        return;
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

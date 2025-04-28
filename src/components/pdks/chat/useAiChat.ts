
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
    content: 'Merhaba! PDKS raporları için sorularınızı yanıtlayabilirim. Örnek: "Finans departmanı mart ayı giriş takip raporu" veya "Bugün işe gelenlerin listesi"'
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
      console.log("Calling Supabase natural language query endpoint:", SUPABASE_NATURAL_QUERY_ENDPOINT);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(SUPABASE_NATURAL_QUERY_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqdWRzZ2hod21uc25uZG5zd2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyMzk1NTMsImV4cCI6MjA1MTgxNTU1M30.9mA6Q1JDCszfH3nujNpGWd36M4qxZ-L38GPTaNIsjVg'
        },
        body: JSON.stringify({ query: input }),
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


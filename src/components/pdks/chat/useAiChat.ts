
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface MessageData {
  name: string;
  check_in: string;
  check_out: string | null;
  department: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  data?: MessageData[];
}

const LOCAL_LLAMA_ENDPOINTS = {
  completion: [
    "http://localhost:5050/completion",
    "http://127.0.0.1:5050/completion"
  ],
  status: [
    "http://localhost:5050/status",
    "http://127.0.0.1:5050/status"
  ],
  report: [
    "http://localhost:5050/api/pdks-report",
    "http://127.0.0.1:5050/api/pdks-report"
  ]
};

// Supabase endpoint
const SUPABASE_NATURAL_QUERY_ENDPOINT = "https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/pdks-natural-query";

const LOCAL_MODEL_ENABLED = true;

export function useAiChat() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    type: 'assistant',
    content: 'Merhaba! PDKS raporları için sorularınızı yanıtlayabilirim. Örnek: "Finans departmanı mart ayı giriş takip raporu"'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const { toast } = useToast();

  const handleExportExcel = (messageData: any) => {
    if (!messageData || !Array.isArray(messageData)) {
      console.log("Export Excel error: No data to export", messageData);
      toast({
        title: "Dışa aktarılamadı",
        description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
        variant: "destructive",
      });
      return;
    }

    try {
      const ws = XLSX.utils.json_to_sheet(messageData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rapor");
      XLSX.writeFile(wb, `pdks_rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
  
      toast({
        title: "Excel dosyası indirildi",
        description: "Rapor başarıyla Excel formatında dışa aktarıldı.",
      });
    } catch (error) {
      console.error("Excel export error:", error);
      toast({
        title: "Excel oluşturma hatası",
        description: "Excel dosyası oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async (messageData: any) => {
    if (!messageData || !Array.isArray(messageData)) {
      console.log("Export PDF error: No data to export", messageData);
      toast({
        title: "Dışa aktarılamadı",
        description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Preparing PDF export data", { 
        headers: Object.keys(messageData[0]), 
        rowCount: messageData.length 
      });

      const headers = Object.keys(messageData[0]);
      const rows = messageData.map(Object.values);
      
      console.log("Calling generate-pdf function");
      const response = await fetch('https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          headers,
          rows,
          title: "PDKS Raporu",
          date: new Date().toLocaleDateString('tr-TR')
        }),
      });

      console.log("PDF generation response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("PDF generation error response:", errorText);
        throw new Error(`PDF oluşturma hatası: ${response.status} ${errorText}`);
      }

      const blob = await response.blob();
      console.log("PDF blob received, size:", blob.size);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pdks_rapor_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF dosyası indirildi",
        description: "Rapor başarıyla PDF formatında dışa aktarıldı.",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "PDF oluşturma hatası",
        description: `PDF dosyası oluşturulurken bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
        variant: "destructive",
      });
    }
  };

  const checkLocalModelStatus = async () => {
    if (!LOCAL_MODEL_ENABLED) return;
    
    console.log("Checking local model status...");
    for (const endpoint of LOCAL_LLAMA_ENDPOINTS.status) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const response = await fetch(endpoint, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(3000)
        });
        
        const data = await response.json();
        console.log(`Endpoint ${endpoint} response:`, data);
        
        if (response.ok) {
          setIsLocalModelConnected(true);
          console.log("Local model connection successful");
          toast({
            title: "Yerel AI modeline bağlanıldı",
            description: `${endpoint} üzerinden PDKS AI asistanı aktif.`,
          });
          return;
        }
      } catch (error) {
        console.warn(`Endpoint ${endpoint} connection error:`, error);
      }
    }

    console.log("All local model connection attempts failed");
    toast({
      title: "Yerel Model Bağlantısı Başarısız",
      description: "Yerel model kullanılamıyor. Cloud tabanlı doğal dil işleme modeli kullanılacak.",
      variant: "destructive"
    });
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
      // First try Supabase Edge Function for natural language query
      try {
        console.log("Calling Supabase natural language query endpoint:", SUPABASE_NATURAL_QUERY_ENDPOINT);
        const response = await fetch(SUPABASE_NATURAL_QUERY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: input }),
          signal: AbortSignal.timeout(8000)
        });

        console.log("Natural language query response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("Natural language query response data:", data);
          
          if (data.records && Array.isArray(data.records) && data.records.length > 0) {
            const aiMessage: Message = {
              id: `response-${userMessage.id}`,
              type: 'assistant',
              content: data.explanation || 'İşte rapor sonuçları:',
              data: data.records
            };
            setMessages(prev => [...prev, aiMessage]);
            setIsLoading(false);
            return;
          } else {
            console.log("Natural language query returned no records");
          }
        } else {
          const errorText = await response.text();
          console.error("Natural language query error response:", errorText);
        }
      } catch (error) {
        console.warn("Natural language query error:", error);
      }

      // If natural language query fails, try other endpoints
      // Try report endpoint first
      console.log("Trying local report endpoints");
      for (const endpoint of LOCAL_LLAMA_ENDPOINTS.report) {
        try {
          console.log(`Trying report endpoint: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: input }),
            signal: AbortSignal.timeout(5000)
          });

          console.log(`Report endpoint ${endpoint} response status:`, response.status);

          if (response.ok) {
            const data = await response.json();
            console.log(`Report endpoint ${endpoint} response data:`, data);
            
            if (Array.isArray(data) && data.length > 0) {
              const aiMessage: Message = {
                id: `response-${userMessage.id}`,
                type: 'assistant',
                content: 'İşte rapor sonuçları:',
                data: data
              };
              setMessages(prev => [...prev, aiMessage]);
              setIsLoading(false);
              return;
            } else {
              console.log(`Report endpoint ${endpoint} returned no data or invalid format`);
            }
          } else {
            const errorText = await response.text();
            console.error(`Report endpoint ${endpoint} error response:`, errorText);
          }
        } catch (error) {
          console.warn(`Report endpoint ${endpoint} error:`, error);
        }
      }

      // If no report data, try chat completion
      let aiResponse = "Üzgünüm, raporlar için sorgunuzu anlayamadım. Lütfen 'Finans departmanı mart ayı giriş raporu' gibi daha açık bir ifade kullanın.";
      
      if (LOCAL_MODEL_ENABLED && isLocalModelConnected) {
        console.log("Trying local completion endpoints");
        for (const endpoint of LOCAL_LLAMA_ENDPOINTS.completion) {
          try {
            console.log(`Trying completion endpoint: ${endpoint}`);
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
            
            console.log(`Completion endpoint ${endpoint} response status:`, response.status);
            
            if (response.ok) {
              const data = await response.json();
              console.log(`Completion endpoint ${endpoint} response data:`, data);
              aiResponse = data.content || data.response || data.generated_text || data.choices?.[0]?.text || "Yanıt alınamadı.";
              break;
            } else {
              const errorText = await response.text();
              console.error(`Completion endpoint ${endpoint} error response:`, errorText);
            }
          } catch (endpointError) {
            console.warn(`Completion endpoint ${endpoint} error:`, endpointError);
          }
        }
      } else {
        console.log("Skipping local completion endpoints - model not connected or disabled");
      }

      console.log("Sending assistant response:", aiResponse.substring(0, 100) + "...");
      const aiMessage: Message = {
        id: `response-${userMessage.id}`,
        type: 'assistant',
        content: aiResponse
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: Message = {
        id: `error-${userMessage.id}`,
        type: 'assistant',
        content: `Üzgünüm, bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("useAiChat hook initialized");
    checkLocalModelStatus();
  }, []);

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

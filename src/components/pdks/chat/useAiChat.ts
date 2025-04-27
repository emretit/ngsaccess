
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
      toast({
        title: "Dışa aktarılamadı",
        description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
        variant: "destructive",
      });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(messageData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `pdks_rapor_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "Excel dosyası indirildi",
      description: "Rapor başarıyla Excel formatında dışa aktarıldı.",
    });
  };

  const handleExportPDF = async (messageData: any) => {
    if (!messageData || !Array.isArray(messageData)) {
      toast({
        title: "Dışa aktarılamadı",
        description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
        variant: "destructive",
      });
      return;
    }

    try {
      const headers = Object.keys(messageData[0]);
      const rows = messageData.map(Object.values);
      
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

      if (!response.ok) throw new Error('PDF oluşturma hatası');

      const blob = await response.blob();
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
        description: "PDF dosyası oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const checkLocalModelStatus = async () => {
    if (!LOCAL_MODEL_ENABLED) return;
    
    for (const endpoint of LOCAL_LLAMA_ENDPOINTS.status) {
      try {
        const response = await fetch(endpoint, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          setIsLocalModelConnected(true);
          toast({
            title: "Yerel AI modeline bağlanıldı",
            description: `${endpoint} üzerinden PDKS AI asistanı aktif.`,
          });
          return;
        }
      } catch (error) {
        console.warn(`Endpoint ${endpoint} bağlantı hatası:`, error);
      }
    }

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

    try {
      // Önce Supabase Edge Function ile doğal dil sorgusu dene
      try {
        console.log("Supabase doğal dil sorgu endpoint'i çağrılıyor:", SUPABASE_NATURAL_QUERY_ENDPOINT);
        const response = await fetch(SUPABASE_NATURAL_QUERY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: input }),
          signal: AbortSignal.timeout(8000)
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Doğal dil sorgusu yanıtı:", data);
          
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
          }
        }
      } catch (error) {
        console.warn("Doğal dil sorgusu hatası:", error);
      }

      // Eğer doğal dil sorgusu çalışmazsa, diğer endpoint'leri dene
      // Try report endpoint first
      for (const endpoint of LOCAL_LLAMA_ENDPOINTS.report) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: input }),
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            const data = await response.json();
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
            }
          }
        } catch (error) {
          console.warn(`Rapor endpoint hatası:`, error);
        }
      }

      // If no report data, try chat completion
      let aiResponse = "Üzgünüm, raporlar için sorgunuzu anlayamadım. Lütfen 'Finans departmanı mart ayı giriş raporu' gibi daha açık bir ifade kullanın.";
      
      if (LOCAL_MODEL_ENABLED && isLocalModelConnected) {
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

  useEffect(() => {
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

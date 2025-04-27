import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Message } from "./types";

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

  const handleExportPDF = (messageData: any) => {
    if (!messageData || !Array.isArray(messageData)) {
      toast({
        title: "Dışa aktarılamadı",
        description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    doc.text("PDKS Raporu", 14, 16);
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString()}`, 14, 24);

    // Tabloyu oluştur
    const tableColumn = Object.keys(messageData[0]);
    const tableRows = messageData.map(item => Object.values(item));

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [66, 66, 66] }
    });

    doc.save(`pdks_rapor_${new Date().toISOString().split('T')[0]}.pdf`);

    toast({
      title: "PDF dosyası indirildi",
      description: "Rapor başarıyla PDF formatında dışa aktarıldı.",
    });
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
      // Önce direkt LLaMA modeline sorgu gönder
      if (LOCAL_MODEL_ENABLED && isLocalModelConnected) {
        console.log("LLaMA modeline sorgu gönderiliyor...", input);
        let aiResponse = "";

        // Önce completion endpoint'ini dene
        for (const endpoint of LOCAL_LLAMA_ENDPOINTS.completion) {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: input, // Kullanıcı promtunu direkt olarak gönder
                max_tokens: 500,
                temperature: 0.7,
                stop: ["###"]
              }),
              signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
              const data = await response.json();
              aiResponse = data.content || data.response || data.generated_text || data.choices?.[0]?.text || "Yanıt alınamadı.";

              // Eğer yanıt içerisinde "finans", "departman" veya "rapor" benzeri kelimeler varsa
              // muhtemelen rapor isteği olduğu anlaşıldı, rapor verilerini sorgulamayı dene
              if (aiResponse.toLowerCase().includes("rapor") &&
                (aiResponse.toLowerCase().includes("finans") ||
                  aiResponse.toLowerCase().includes("departman"))) {

                console.log("Rapor isteği algılandı, veri getiriliyor...");

                // Rapor verisini getir
                for (const reportEndpoint of LOCAL_LLAMA_ENDPOINTS.report) {
                  try {
                    const reportResponse = await fetch(reportEndpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ query: input }),
                      signal: AbortSignal.timeout(5000)
                    });

                    if (reportResponse.ok) {
                      const reportData = await reportResponse.json();

                      if (Array.isArray(reportData) && reportData.length > 0) {
                        // Rapor verisi başarıyla alındı
                        const aiMessage: Message = {
                          id: `response-${userMessage.id}`,
                          type: 'assistant',
                          content: aiResponse,
                          data: reportData
                        };
                        setMessages(prev => [...prev, aiMessage]);
                        setIsLoading(false);
                        return;
                      }
                    }
                  } catch (error) {
                    console.warn("Rapor verisi alınamadı:", error);
                  }
                }
              }

              // Rapor verisi alınamadıysa veya bu bir rapor isteği değilse, sadece yanıtı göster
              const aiMessage: Message = {
                id: `response-${userMessage.id}`,
                type: 'assistant',
                content: aiResponse
              };
              setMessages(prev => [...prev, aiMessage]);
              setIsLoading(false);
              return;
            }
          } catch (endpointError) {
            console.warn(`Endpoint hatası:`, endpointError);
          }
        }
      }

      // Yerel model bağlantısı yoksa veya yanıt alınamadıysa, Supabase ile dene
      console.log("Supabase doğal dil sorgu endpoint'i çağrılıyor:", SUPABASE_NATURAL_QUERY_ENDPOINT);
      const response = await fetch(SUPABASE_NATURAL_QUERY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
        signal: AbortSignal.timeout(10000)
      });

      const data = await response.json();
      console.log("Doğal dil sorgusu yanıtı:", data);

      if (data.records && Array.isArray(data.records)) {
        if (data.records.length === 0) {
          // Kayıt bulunamadıysa
          const aiMessage: Message = {
            id: `response-${userMessage.id}`,
            type: 'assistant',
            content: data.explanation || 'Arama kriterlerinize uygun kayıt bulunamadı.'
          };
          setMessages(prev => [...prev, aiMessage]);
        } else {
          // Kayıtlar bulunduysa
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

      // Hiçbir şekilde sonuç alınamadıysa varsayılan mesaj
      const aiMessage: Message = {
        id: `response-${userMessage.id}`,
        type: 'assistant',
        content: "Üzgünüm, sorgunuzu anlayamadım. Lütfen 'Finans departmanı mart ayı giriş raporu' gibi daha açık bir ifade kullanın."
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

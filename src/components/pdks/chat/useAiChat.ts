import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { checkLlamaModelStatus, processNaturalLanguageQuery } from "@/integrations/llama/service";

interface MessageData {
  name: string;
  check_in: string;
  check_out: string | null;
  department: string;
  device?: string;
  location?: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  data?: MessageData[];
}

interface QueryParams {
  department?: string | null;
  month?: string | null;
  year?: string;
  startDate?: string | null;
  endDate?: string | null;
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

// Supabase endpoint for natural language queries
const SUPABASE_NATURAL_QUERY_ENDPOINT = "https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/pdks-natural-query";
const PDF_GENERATION_ENDPOINT = "https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/generate-pdf";

const LOCAL_MODEL_ENABLED = true;

export function useAiChat() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    type: 'assistant',
    content: 'Merhaba! PDKS raporları için sorularınızı yanıtlayabilirim. Örnekler:\n• "Finans departmanı mart ayı giriş takip raporu"\n• "Engineering departmanı"\n• "Bugün işe gelenlerin listesi"'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, any> | null>(null);
  const { toast } = useToast();

  // Format report data for display
  const formatReportData = (data: any[]) => {
    return data.map(record => {
      // Format dates for better display
      const checkInDate = record.check_in ? new Date(record.check_in) : null;
      const checkOutDate = record.check_out ? new Date(record.check_out) : null;

      return {
        ...record,
        // Format dates for display if they exist
        check_in: checkInDate ? checkInDate.toLocaleString('tr-TR') : '-',
        check_out: checkOutDate ? checkOutDate.toLocaleString('tr-TR') : '-',
      };
    });
  };

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
      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(messageData);

      // Column width optimization
      const wscols = [
        { wch: 25 },  // Name
        { wch: 25 },  // Check in
        { wch: 25 },  // Check out
        { wch: 20 },  // Department
        { wch: 15 },  // Device (if exists)
        { wch: 20 }   // Location (if exists)
      ];

      ws['!cols'] = wscols;

      // Create a workbook, add the worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PDKS Raporu");

      // Generate Excel file and trigger download
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
        rowCount: messageData.length
      });

      // Define table headers based on the available fields
      const headers = Object.keys(messageData[0]).filter(key =>
        // Filter out any unwanted properties
        key !== 'id' && key !== 'access_granted' && key !== 'status'
      );

      // Format rows as arrays in the order matching the headers
      const rows = messageData.map(record => {
        return headers.map(header => {
          // Format date values
          if (header === 'check_in' || header === 'check_out') {
            return record[header] ? new Date(record[header]).toLocaleString('tr-TR') : '-';
          }
          return record[header] || '-';
        });
      });

      // Get current date in Turkish format
      const currentDate = new Date().toLocaleDateString('tr-TR');

      // Extract information from the latest message to set the PDF title
      const lastAssistantMessage = [...messages].reverse().find(msg => msg.type === 'assistant');
      const pdfTitle = lastAssistantMessage ? lastAssistantMessage.content : "PDKS Raporu";

      console.log("Calling generate-pdf function with:", {
        headers: headers,
        rowCount: rows.length,
        title: pdfTitle
      });

      // Call the PDF generation endpoint
      const response = await fetch(PDF_GENERATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          headers: headers.map(h => h.charAt(0).toUpperCase() + h.slice(1).replace('_', ' ')),
          rows,
          title: pdfTitle,
          date: currentDate
        }),
      });

      console.log("PDF generation response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("PDF generation error response:", errorText);
        throw new Error(`PDF oluşturma hatası: ${response.status} ${errorText}`);
      }

      // Get the blob of HTML that will be rendered as PDF by the browser
      const htmlBlob = await response.blob();
      console.log("PDF response received, size:", htmlBlob.size);

      // Create a URL for the blob and open it in a new window
      const url = window.URL.createObjectURL(htmlBlob);
      window.open(url, '_blank');

      toast({
        title: "PDF görüntüleniyor",
        description: "PDF raporu yeni pencerede açılıyor. Tarayıcınızın yazdırma dialogu ile kaydedebilirsiniz.",
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
    try {
      const isConnected = await checkLlamaModelStatus();
      setIsLocalModelConnected(isConnected);

      if (isConnected) {
        console.log("Local model connection successful");
        toast({
          title: "Yerel AI modeline bağlanıldı",
          description: "PDKS AI asistanı aktif.",
        });
      } else {
        console.log("Local model not available");
        toast({
          title: "Yerel Model Bağlantısı Başarısız",
          description: "Yerel model kullanılamıyor. Cloud tabanlı doğal dil işleme modeli kullanılacak.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error checking local model status:", error);
      setIsLocalModelConnected(false);
      toast({
        title: "Yerel Model Bağlantı Hatası",
        description: "Yerel model bağlantısı kontrol edilirken bir hata oluştu.",
        variant: "destructive"
      });
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
      // Yeni entegre ettiğimiz processNaturalLanguageQuery servisini kullan
      const result = await processNaturalLanguageQuery(input);
      console.log("Natural language query result:", result);

      // Veri kontrolü
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        // Format the data for better display
        const formattedData = formatReportData(result.data);

        // Create the assistant message with the report data
        const aiMessage: Message = {
          id: `response-${userMessage.id}`,
          type: 'assistant',
          content: result.explanation || 'İşte rapor sonuçları:',
          data: formattedData
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Veri bulunamadıysa açıklama mesajı göster
        const noDataMessage: Message = {
          id: `response-${userMessage.id}`,
          type: 'assistant',
          content: result.explanation || 'Sorgunuza uygun kayıt bulunamadı. Lütfen farklı bir sorgu deneyin.'
        };

        setMessages(prev => [...prev, noDataMessage]);
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
    handleExportPDF,
    debugInfo
  };
}

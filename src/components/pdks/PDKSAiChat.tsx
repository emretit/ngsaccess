import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Server, FileSpreadsheet, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  data?: any; // Rapor verisi için
}

// Configuration for local Llama model
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

const LOCAL_MODEL_ENABLED = true;

export function PDKSAiChat() {
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
          signal: AbortSignal.timeout(3000)  // 3 second timeout
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
      description: "Lütfen Llama sunucusunun çalıştığından emin olun.",
      variant: "destructive"
    });
  };

  useEffect(() => {
    checkLocalModelStatus();
  }, []);

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
      // Önce rapor endpoint'ini deneyelim
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
            // Eğer rapor verisi varsa, tablo formatında göster
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

      // Rapor alınamadıysa, normal sohbet yanıtı deneyelim
      let aiResponse = "Üzgünüm, rapor oluşturulamadı veya veriye ulaşılamadı.";
      
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
            console.warn(`Endpoint ${endpoint} hatası:`, endpointError);
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

  const renderMessage = (message: Message) => {
    if (message.data) {
      return (
        <div className="space-y-2">
          <div className="flex justify-end gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportExcel(message.data)}
              title="Excel olarak indir"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportPDF(message.data)}
              title="PDF olarak indir"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
          <p>{message.content}</p>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr>
                  <th className="border p-2">İsim</th>
                  <th className="border p-2">Giriş Saati</th>
                  <th className="border p-2">Çıkış Saati</th>
                  <th className="border p-2">Departman</th>
                </tr>
              </thead>
              <tbody>
                {message.data.map((record: any, index: number) => (
                  <tr key={index}>
                    <td className="border p-2">{record.name}</td>
                    <td className="border p-2">{new Date(record.check_in).toLocaleString()}</td>
                    <td className="border p-2">{record.check_out ? new Date(record.check_out).toLocaleString() : '-'}</td>
                    <td className="border p-2">{record.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return message.content;
  };

  return (
    <Card className="w-full h-[calc(100vh-12rem)] shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">PDKS AI Rapor Asistanı</CardTitle>
        {LOCAL_MODEL_ENABLED && (
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isLocalModelConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Server size={12} /> 
              {isLocalModelConnected ? 'Yerel Model Aktif' : 'Yerel Model Bağlantısı Yok'}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] animate-fade-in ${
                      message.type === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {renderMessage(message)}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2 flex space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Örnek: Finans departmanı mart ayı giriş takip raporu..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              title={!isLocalModelConnected && LOCAL_MODEL_ENABLED ? "Yerel model bağlantısı yok" : "Gönder"}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

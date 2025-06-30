
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Zap } from "lucide-react";
import { AiChatMessage } from "./chat/AiChatMessage";
import { AiChatInput } from "./chat/AiChatInput";
import { AiModelStatus } from "./chat/AiModelStatus";
import { SampleQueries } from "./chat/SampleQueries";
import { useAiChat } from "./chat/useAiChat";
import { useToast } from "@/hooks/use-toast";
import { OpenAiKeyInput } from "./chat/OpenAiKeyInput";
import { useDepartments } from "@/hooks/useDepartments";
import { Badge } from "@/components/ui/badge";

export function PDKSAiChat() {
  const { toast } = useToast();
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [useNaturalLanguage, setUseNaturalLanguage] = useState(true);
  const { departments } = useDepartments();
  
  const {
    messages,
    input,
    setInput,
    isLoading,
    isOpenAIConnected,
    checkOpenAIStatus,
    handleSendMessage,
    handleExportExcel,
    handleExportPDF,
    saveConversationToSupabase,
    isSaving
  } = useAiChat();
  
  useEffect(() => {
    // Check if API key exists in localStorage
    const apiKey = localStorage.getItem('OPENAI_API_KEY');
    setShowApiKeyInput(!apiKey || !apiKey.startsWith('sk-'));
    
    // Check URL parameters for API key
    const urlParams = new URLSearchParams(window.location.search);
    const keyFromUrl = urlParams.get('apikey');
    
    if (keyFromUrl && keyFromUrl.startsWith('sk-')) {
      localStorage.setItem('OPENAI_API_KEY', keyFromUrl);
      setShowApiKeyInput(false);
      // Remove the key from URL for security
      window.history.replaceState({}, document.title, window.location.pathname);
      checkOpenAIStatus();
    }
  }, [checkOpenAIStatus]);

  // Departman bilgilerini konsolda göster (debug amaçlı)
  useEffect(() => {
    if (departments.length > 0) {
      console.log("Mevcut departmanlar:", departments.map(d => d.name));
    }
  }, [departments]);

  const handleRefreshModelStatus = () => {
    checkOpenAIStatus();
    toast({
      title: "AI bağlantısı kontrol ediliyor",
      description: "AI servisi durumu yeniden kontrol ediliyor.",
    });
  };

  const handleApiKeyComplete = () => {
    setShowApiKeyInput(false);
    checkOpenAIStatus();
  };

  const handleSaveConversation = () => {
    if (messages.length === 0) {
      toast({
        title: "Kayıt edilecek sohbet yok",
        description: "Kaydetmek için önce bir sohbet başlatın.",
        variant: "destructive"
      });
      return;
    }
    
    saveConversationToSupabase();
    
    toast({
      title: "Sohbet kaydedildi",
      description: "Sohbet geçmişiniz başarıyla kaydedildi."
    });
  };

  const handleSendWithDepartmentContext = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Departman içeren bir soru mu kontrol et
    const departmentKeywords = ["departman", "bölüm", "department"];
    const containsDepartmentKeyword = departmentKeywords.some(keyword => 
      input.toLowerCase().includes(keyword)
    );
    
    if (containsDepartmentKeyword && departments.length > 0) {
      // Mevcut departman listesini mesaja ekle
      const deptContext = `\n\nDepartman bilgisi sorgulanıyor. Mevcut departmanlar: ${departments.map(d => d.name).join(', ')}`;
      const enhancedInput = input + deptContext;
      
      // Mesaj içeriğini debug amaçlı göster
      console.log("Departman bağlamıyla zenginleştirilmiş mesaj:", enhancedInput);
      
      // Gerçek sorgulama fonksiyonunu çağır
      handleSendMessage(e, enhancedInput);
    } else {
      // Normal mesaj gönderme işlemi
      handleSendMessage(e);
    }
  };

  const handleSampleQuerySelect = (query: string) => {
    setInput(query);
  };

  const toggleNaturalLanguage = () => {
    setUseNaturalLanguage(!useNaturalLanguage);
    toast({
      title: useNaturalLanguage ? "OpenAI Modu Aktif" : "Doğal Dil Modu Aktif",
      description: useNaturalLanguage 
        ? "Artık OpenAI kullanılacak (API key gerekli)" 
        : "Artık yerli doğal dil işleme kullanılacak (daha hızlı)",
    });
  };

  // Eğer doğal dil modu aktifse API key kontrolü yapma
  const shouldShowApiKeyInput = !useNaturalLanguage && showApiKeyInput;

  return (
    <Card className="w-full h-[calc(100vh-12rem)] shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-medium">
            PDKS AI Asistanı
          </CardTitle>
          {useNaturalLanguage ? (
            <Badge variant="default" className="bg-green-500">
              <Zap className="h-3 w-3 mr-1" />
              Yerli AI
            </Badge>
          ) : (
            <Badge variant="secondary">
              OpenAI
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleNaturalLanguage}
            className="h-7 px-2"
          >
            <Zap className="h-4 w-4 mr-1" />
            {useNaturalLanguage ? "OpenAI" : "Yerli AI"}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefreshModelStatus}
            className="h-7 w-7 p-0"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          {!useNaturalLanguage && <AiModelStatus isConnected={isOpenAIConnected} />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {shouldShowApiKeyInput ? (
            <OpenAiKeyInput onComplete={handleApiKeyComplete} />
          ) : (
            <>
              <SampleQueries 
                onQuerySelect={handleSampleQuerySelect}
                isVisible={messages.length === 0}
              />
              <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <AiChatMessage
                      key={message.id}
                      message={message}
                      onExportExcel={handleExportExcel}
                      onExportPDF={handleExportPDF}
                    />
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
              <AiChatInput
                input={input}
                isLoading={isLoading}
                isModelConnected={useNaturalLanguage || isOpenAIConnected}
                isSaving={isSaving}
                onInputChange={setInput}
                onSubmit={handleSendWithDepartmentContext}
                onSave={handleSaveConversation}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

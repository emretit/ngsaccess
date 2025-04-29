
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { AiChatMessage } from "./chat/AiChatMessage";
import { AiChatInput } from "./chat/AiChatInput";
import { AiModelStatus } from "./chat/AiModelStatus";
import { useAiChat } from "./chat/useAiChat";
import { useToast } from "@/hooks/use-toast";
import { OpenAiKeyInput } from "./chat/OpenAiKeyInput";

export function PDKSAiChat() {
  const { toast } = useToast();
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  
  const {
    messages,
    input,
    setInput,
    isLoading,
    isLocalModelConnected,
    checkLocalModelStatus,
    handleSendMessage,
    handleExportExcel,
    handleExportPDF
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
      checkLocalModelStatus();
    }
  }, [checkLocalModelStatus]);

  const handleRefreshModelStatus = () => {
    checkLocalModelStatus();
    toast({
      title: "Model bağlantısı kontrol ediliyor",
      description: "OpenAI API bağlantısı yeniden kontrol ediliyor.",
    });
  };

  const handleApiKeyComplete = () => {
    setShowApiKeyInput(false);
    checkLocalModelStatus();
  };

  return (
    <Card className="w-full h-[calc(100vh-12rem)] shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">
          {isLocalModelConnected ? "OpenAI PDKS Asistanı" : "PDKS AI Rapor Asistanı"}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefreshModelStatus}
            className="h-7 w-7 p-0"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <AiModelStatus isConnected={isLocalModelConnected} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {showApiKeyInput ? (
            <OpenAiKeyInput onComplete={handleApiKeyComplete} />
          ) : (
            <>
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
                isModelConnected={isLocalModelConnected}
                onInputChange={setInput}
                onSubmit={handleSendMessage}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Server } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
}

// Configuration for local Llama model
const LOCAL_LLAMA_ENDPOINT = "http://localhost:8000/generate"; // Default local Llama server endpoint
const LOCAL_MODEL_ENABLED = true; // Flag to control whether to use local model

export function PDKSAiChat() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    type: 'assistant',
    content: 'Merhaba! PDKS kayıtları hakkında sorularınızı yanıtlayabilirim. Örneğin: "Finans departmanının geçen haftaki devam durumu nedir?" gibi sorular sorabilirsiniz.'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const { toast } = useToast();

  // Function to check if local model is available
  const checkLocalModelStatus = async () => {
    if (!LOCAL_MODEL_ENABLED) return;
    
    try {
      const response = await fetch(`${LOCAL_LLAMA_ENDPOINT}/status`, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setIsLocalModelConnected(true);
        toast({
          title: "Yerel AI modeline bağlanıldı",
          description: "PDKS AI asistanı şimdi yerel Llama modelinizi kullanarak çalışıyor.",
        });
      }
    } catch (error) {
      console.error("Yerel model bağlantı hatası:", error);
      setIsLocalModelConnected(false);
    }
  };

  // Check local model status on component mount
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
      let aiResponse;
      
      if (LOCAL_MODEL_ENABLED && isLocalModelConnected) {
        // Use local Llama model
        const response = await fetch(LOCAL_LLAMA_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: input,
            max_tokens: 500,
            temperature: 0.7
          })
        });
        
        if (!response.ok) throw new Error('Yerel model yanıt hatası');
        const data = await response.json();
        aiResponse = data.response || data.generated_text;
      } else {
        // Fallback to simulated response if local model is not available
        await new Promise(resolve => setTimeout(resolve, 1000));
        aiResponse = 'Bu özellik için yerel Llama modelinin çalışır durumda olması gerekiyor. Lütfen yerel Llama sunucunuzun çalıştığından emin olun.';
      }

      const aiMessage: Message = {
        id: `response-${userMessage.id}`,
        type: 'assistant',
        content: aiResponse
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: `error-${userMessage.id}`,
        type: 'assistant',
        content: 'Üzgünüm, bir hata oluştu. Yerel AI modeliyle bağlantı kurulamadı.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full h-[calc(100vh-12rem)] shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">PDKS AI Asistan</CardTitle>
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
                    {message.content}
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
              placeholder="PDKS kayıtları hakkında bir soru sorun..."
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

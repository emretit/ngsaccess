
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
}

export function PdksAiChat() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    type: 'assistant',
    content: 'Merhaba! PDKS kayıtları hakkında sorularınızı yanıtlayabilirim. Örneğin: "Finans departmanının geçen haftaki devam durumu nedir?" gibi sorular sorabilirsiniz.'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('pdks-ai', {
        body: { prompt: input }
      });

      if (error) throw error;

      // Add AI response
      const aiMessage: Message = {
        id: `response-${userMessage.id}`,
        type: 'assistant',
        content: data.answer || "Üzgünüm, yanıt oluşturulamadı. Lütfen tekrar deneyin."
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error('Error querying AI:', error);
      toast({
        title: "Hata",
        description: "AI yanıt verirken bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive"
      });
      
      // Add error message for the user
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto bg-white/50 rounded-lg p-4 mb-4" style={{ minHeight: "400px" }}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-2`}
          >
            <div
              className={`rounded-lg px-4 py-2 max-w-[80%] ${
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
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="PDKS kayıtları hakkında bir soru sorun..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={!input.trim() || isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

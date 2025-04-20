
import { useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AiMessage } from "./AiMessage";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
}

interface AiChatPanelProps {
  onClose: () => void;
  filters?: {
    dateRange?: { from: Date; to: Date };
    department?: string;
    shift?: string;
  };
}

export function AiChatPanel({ onClose, filters }: AiChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "assistant",
      content: "Merhaba! PDKS kayıtları hakkında sorular sorabilirsiniz.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Generate a unique ID for the new message
    const messageId = Date.now().toString();
    const userMessage = { id: messageId, type: "user" as const, content: input };
    
    // Add the user message to the chat
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // In a real implementation, this would call your API endpoint
      // For now, we'll simulate a response
      setTimeout(() => {
        const assistantResponse = {
          id: `response-${messageId}`,
          type: "assistant" as const,
          content: `This is a simulated response to: "${input}". In a real implementation, this would come from your AI backend.`,
        };
        setMessages((prev) => [...prev, assistantResponse]);
        setIsLoading(false);
      }, 1000);
      
      // Actual API call would look something like:
      // const response = await fetch("/api/ai/query", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     prompt: input,
      //     filters,
      //     context: [], // Would include relevant PDKS records
      //   }),
      // });
      // const data = await response.json();
      // setMessages((prev) => [
      //   ...prev,
      //   { id: `response-${messageId}`, type: "assistant", content: data.answer },
      // ]);
    } catch (error) {
      console.error("Error querying AI:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${messageId}`,
          type: "assistant",
          content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.",
        },
      ]);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-medium">PDKS AI Asistan</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col">
          {messages.map((message) => (
            <AiMessage key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex justify-start my-2">
              <div className="bg-muted rounded-lg px-4 py-2 flex space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce animation-delay-200"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce animation-delay-400"></div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="border-t p-4">
        <div className="relative">
          <Input
            placeholder="PDKS kayıtları hakkında sorunuz..."
            className="pr-10"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            disabled={!input.trim() || isLoading}
          >
            <Send size={18} />
          </Button>
        </div>
      </form>
    </div>
  );
}

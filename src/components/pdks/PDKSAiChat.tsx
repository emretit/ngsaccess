
import { useState } from "react";
import { MessageSquare, Bot, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SampleQueries } from "./chat/SampleQueries";
import { useMessageHandler } from "./chat/hooks/useMessageHandler";
import { useMessages } from "./chat/hooks/useMessages";
import { useInput } from "./chat/hooks/useInput";
import { AiChatMessage } from "./chat/AiChatMessage";

export function PDKSAiChat() {
  const [aiMode, setAiMode] = useState<'native' | 'openai'>('native');
  const { messages, addMessage } = useMessages();
  const { input, setInput, handleSubmit } = useInput();
  const { handleSendMessage, isLoading } = useMessageHandler(addMessage);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit(e, handleSendMessage);
  };

  const handleQuerySelect = (query: string) => {
    setInput(query);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#711A1A]/10 p-2 rounded-full">
            <Bot className="h-5 w-5 text-[#711A1A]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Asistan</h3>
            <p className="text-sm text-gray-500">PDKS verilerinizi sorgulayın</p>
          </div>
        </div>

        {/* AI Mode Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={aiMode === 'native' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAiMode('native')}
            className={aiMode === 'native' ? 'bg-[#711A1A] hover:bg-[#711A1A]/90' : ''}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Yerli AI
          </Button>
          <Button
            variant={aiMode === 'openai' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAiMode('openai')}
            className={aiMode === 'openai' ? 'bg-[#711A1A] hover:bg-[#711A1A]/90' : ''}
          >
            OpenAI
          </Button>
        </div>

        {aiMode === 'native' && (
          <Badge variant="secondary" className="mt-2 text-xs">
            🚀 Hızlı • Güvenli • Yerel
          </Badge>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm mb-4">AI asistanınıza PDKS verileriniz hakkında sorular sorabilirsiniz.</p>
            {aiMode === 'native' && (
              <SampleQueries onQuerySelect={handleQuerySelect} isVisible={true} />
            )}
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <AiChatMessage key={index} message={message} />
            ))}
            {aiMode === 'native' && messages.length > 0 && (
              <SampleQueries onQuerySelect={handleQuerySelect} isVisible={false} />
            )}
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                aiMode === 'native' 
                  ? "Örn: Bugün kimler geç kaldı?" 
                  : "OpenAI ile soru sorun..."
              }
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="bg-[#711A1A] hover:bg-[#711A1A]/90"
            >
              {isLoading ? "..." : "Gönder"}
            </Button>
          </div>
          
          {aiMode === 'native' && (
            <p className="text-xs text-gray-500">
              💡 Türkçe sorularınızı anlayabilir ve PDKS verilerinizden hızlı yanıtlar verebilirim.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

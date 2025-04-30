
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AiChatInputProps {
  input: string;
  isLoading: boolean;
  isModelConnected: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function AiChatInput({ 
  input, 
  isLoading, 
  isModelConnected, 
  onInputChange, 
  onSubmit 
}: AiChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={isModelConnected 
          ? "PDKS hakkında sorunuzu yazın..." 
          : "OpenAI API anahtarı gerekli..."}
        disabled={isLoading}
        className="flex-1"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            type="submit" 
            disabled={!input.trim() || isLoading || !isModelConnected}
            title="Gönder"
          >
            <Send className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isModelConnected 
            ? "OpenAI modeline sorunuzu gönderin" 
            : "API anahtarınızı ayarlamadan soru gönderemezsiniz"}
        </TooltipContent>
      </Tooltip>
    </form>
  );
}

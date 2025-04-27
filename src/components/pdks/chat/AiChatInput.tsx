
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AiChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function AiChatInput({ input, isLoading, onInputChange, onSubmit }: AiChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Örnek: Finans departmanı mart ayı giriş takip raporu..."
        disabled={isLoading}
        className="flex-1"
      />
      <Button 
        type="submit" 
        disabled={!input.trim() || isLoading}
        title="Gönder"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}

import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

export interface AiChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
}

export function AiChatInput({
  input,
  isLoading,
  onInputChange,
  onSubmit,
  placeholder = "Sorgunuzu yazın..."
}: AiChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex space-x-2">
      <Input
        autoComplete="off"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="flex-1"
      />
      <Button
        size="icon"
        disabled={isLoading || !input.trim()}
        type="submit"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}

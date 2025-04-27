
import { useState } from "react";
import { Message } from "../types";

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  type: 'assistant',
  content: 'Merhaba! PDKS raporları için sorularınızı yanıtlayabilirim. Örnek: "Finans departmanı mart ayı giriş takip raporu"'
};

export const useMessages = () => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    setIsLoading,
  };
};

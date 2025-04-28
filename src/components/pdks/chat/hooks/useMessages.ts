
import { useState } from "react";
import { Message } from '../types';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    type: 'assistant',
    content: 'Merhaba! Ben PDKS asistanıyım. Size nasıl yardımcı olabilirim? Normal sohbet edebiliriz veya "Rapor:" ile başlayan sorularla PDKS verilerinizi analiz edebilirim.'
  }]);

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  return {
    messages,
    addMessage
  };
}

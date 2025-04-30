
import { useState } from 'react';
import { Message } from '../types';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'assistant',
      content: 'Merhaba! PDKS kayıtları hakkında sorular sorabilirsiniz. Örneğin: "İnsan Kaynakları departmanının 25 Nisan tarihindeki kayıtlarını göster" veya "Mühendislik departmanından kim bugün geç geldi?"'
    }
  ]);

  const addMessage = (message: Message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const clearMessages = () => {
    setMessages([
      {
        id: 'welcome',
        type: 'assistant',
        content: 'Merhaba! PDKS kayıtları hakkında sorular sorabilirsiniz. Örneğin: "İnsan Kaynakları departmanının 25 Nisan tarihindeki kayıtlarını göster" veya "Mühendislik departmanından kim bugün geç geldi?"'
      }
    ]);
  };

  return {
    messages,
    addMessage,
    clearMessages
  };
}


import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LOCAL_GPT4ALL_ENDPOINTS } from "./constants";

export function useModelStatus() {
  const { toast } = useToast();
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);

  const checkLocalModelStatus = async () => {
    try {
      const response = await fetch(LOCAL_GPT4ALL_ENDPOINTS.STATUS, {
        method: 'GET',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsLocalModelConnected(true);
        toast({
          title: "GPT4All Bağlantısı Kuruldu",
          description: `GPT4All ${data.model || 'model'} başarıyla bağlandı.`,
        });
        return true;
      } else {
        setIsLocalModelConnected(false);
        return false;
      }
    } catch (error) {
      console.error("GPT4All connection error:", error);
      setIsLocalModelConnected(false);
      return false;
    }
  };

  // Check connection on component mount
  useEffect(() => {
    checkLocalModelStatus();
  }, []);

  return {
    isLocalModelConnected,
    checkLocalModelStatus
  };
}

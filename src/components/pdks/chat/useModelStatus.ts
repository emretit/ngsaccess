
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LOCAL_LLAMA_ENDPOINTS } from './constants';

export function useModelStatus() {
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const { toast } = useToast();

  const checkLocalModelStatus = async () => {
    console.log("Checking local model status...");
    for (const endpoint of LOCAL_LLAMA_ENDPOINTS.status) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const response = await fetch(endpoint, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(3000)
        });
        
        const data = await response.json();
        console.log(`Endpoint ${endpoint} response:`, data);
        
        if (response.ok) {
          setIsLocalModelConnected(true);
          console.log("Local model connection successful");
          toast({
            title: "Yerel AI modeline bağlanıldı",
            description: `${endpoint} üzerinden PDKS AI asistanı aktif.`,
          });
          return;
        }
      } catch (error) {
        console.warn(`Endpoint ${endpoint} connection error:`, error);
      }
    }

    console.log("All local model connection attempts failed");
    toast({
      title: "Yerel Model Bağlantısı Başarısız",
      description: "Yerel model kullanılamıyor. Cloud tabanlı doğal dil işleme modeli kullanılacak.",
      variant: "destructive"
    });
  };

  return {
    isLocalModelConnected,
    checkLocalModelStatus
  };
}


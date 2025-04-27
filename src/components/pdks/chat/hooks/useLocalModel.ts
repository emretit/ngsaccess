
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AiEndpoints } from "../types";

const LOCAL_LLAMA_ENDPOINTS: AiEndpoints = {
  completion: [
    "http://localhost:5050/completion",
    "http://127.0.0.1:5050/completion"
  ],
  status: [
    "http://localhost:5050/status",
    "http://127.0.0.1:5050/status"
  ],
  report: [
    "http://localhost:5050/api/pdks-report",
    "http://127.0.0.1:5050/api/pdks-report"
  ]
};

export const useLocalModel = () => {
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const { toast } = useToast();

  const checkLocalModelStatus = async () => {
    for (const endpoint of LOCAL_LLAMA_ENDPOINTS.status) {
      try {
        const response = await fetch(endpoint, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          setIsLocalModelConnected(true);
          toast({
            title: "Yerel AI modeline bağlanıldı",
            description: `${endpoint} üzerinden PDKS AI asistanı aktif.`,
          });
          return true;
        }
      } catch (error) {
        console.warn(`Endpoint ${endpoint} bağlantı hatası:`, error);
      }
    }

    toast({
      title: "Yerel Model Bağlantısı Başarısız",
      description: "Yerel model kullanılamıyor. Cloud tabanlı doğal dil işleme modeli kullanılacak.",
      variant: "destructive"
    });
    return false;
  };

  useEffect(() => {
    checkLocalModelStatus();
  }, []);

  return { isLocalModelConnected, LOCAL_LLAMA_ENDPOINTS };
};

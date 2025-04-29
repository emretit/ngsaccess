
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { GPT4ALL_ENDPOINT } from "./constants";

export function useModelStatus() {
  const { toast } = useToast();
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkLocalModelStatus = async () => {
    if (isChecking) return false;
    
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 saniye zaman aşımı
      
      const response = await fetch(`${GPT4ALL_ENDPOINT}/v1/models`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setIsLocalModelConnected(true);
        toast({
          title: "GPT4All Bağlantısı Kuruldu",
          description: "Yerel AI modeli başarıyla bağlandı.",
        });
        return true;
      } else {
        setIsLocalModelConnected(false);
        toast({
          title: "GPT4All Bağlantı Hatası",
          description: "API'ye erişilemedi. API sunucusunun etkin olduğundan emin olun.",
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      console.error("GPT4All connection error:", error);
      setIsLocalModelConnected(false);
      
      let errorMessage = "Bağlantı başarısız oldu. Lütfen GPT4All uygulamasının açık olduğundan emin olun.";
      
      if (error instanceof DOMException && error.name === "AbortError") {
        errorMessage = "Bağlantı zaman aşımına uğradı. GPT4All yanıt vermedi.";
      }
      
      toast({
        title: "GPT4All Bağlantı Hatası",
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // Komponent yüklendiğinde bağlantıyı kontrol et
  useEffect(() => {
    checkLocalModelStatus();
    
    // 30 saniyede bir bağlantıyı kontrol et
    const intervalId = setInterval(() => {
      if (!isLocalModelConnected) {
        checkLocalModelStatus();
      }
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [isLocalModelConnected]);

  return {
    isLocalModelConnected,
    checkLocalModelStatus
  };
}

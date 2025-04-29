
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

export function useModelStatus() {
  const { toast } = useToast();
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkLocalModelStatus = async () => {
    if (isChecking) return false;
    
    setIsChecking(true);
    try {
      // Check if OpenAI API key exists
      const apiKey = process.env.OPEN_AI_API_KEY || localStorage.getItem('OPENAI_API_KEY');
      
      if (!apiKey) {
        setIsLocalModelConnected(false);
        toast({
          title: "OpenAI API Anahtarı Bulunamadı",
          description: "Lütfen API anahtarınızı ayarlardan kontrol edin.",
          variant: "destructive"
        });
        return false;
      }
      
      // Simply mark as connected if API key exists
      // In a real implementation, you might want to make a test request
      setIsLocalModelConnected(true);
      toast({
        title: "OpenAI Bağlantısı Hazır",
        description: "API anahtarı bulundu, OpenAI kullanıma hazır.",
      });
      return true;
    } catch (error) {
      console.error("OpenAI connection check error:", error);
      setIsLocalModelConnected(false);
      
      let errorMessage = "Bağlantı kontrolünde hata oluştu.";
      
      if (error instanceof Error) {
        errorMessage = `Hata: ${error.message}`;
      }
      
      toast({
        title: "OpenAI Bağlantı Hatası",
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // Component loaded, check connection
  useEffect(() => {
    checkLocalModelStatus();
    
    // Check connection every 5 minutes
    const intervalId = setInterval(() => {
      if (!isLocalModelConnected) {
        checkLocalModelStatus();
      }
    }, 300000); // 5 minutes
    
    return () => clearInterval(intervalId);
  }, [isLocalModelConnected]);

  return {
    isLocalModelConnected,
    checkLocalModelStatus
  };
}

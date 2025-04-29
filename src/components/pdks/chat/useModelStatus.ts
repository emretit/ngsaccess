
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
      const apiKey = localStorage.getItem('OPENAI_API_KEY');
      
      if (!apiKey) {
        setIsLocalModelConnected(false);
        toast({
          title: "OpenAI API Anahtarı Bulunamadı",
          description: "Lütfen API anahtarınızı ayarlardan kontrol edin.",
          variant: "destructive"
        });
        return false;
      }
      
      // Simple validation for API key format
      if (!apiKey.startsWith('sk-')) {
        setIsLocalModelConnected(false);
        toast({
          title: "Geçersiz OpenAI API Anahtarı",
          description: "API anahtarınızın formatı doğru değil. Anahtarlar genellikle 'sk-' ile başlar.",
          variant: "destructive"
        });
        return false;
      }
      
      // Perform a test request to validate the API key
      try {
        const testRequest = await fetch("https://api.openai.com/v1/models", {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        });
        
        if (!testRequest.ok) {
          const errorData = await testRequest.json().catch(() => ({}));
          throw new Error(`API test failed: ${testRequest.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
        
        setIsLocalModelConnected(true);
        toast({
          title: "OpenAI Bağlantısı Hazır",
          description: "API anahtarı doğrulandı, OpenAI kullanıma hazır.",
        });
        return true;
      } catch (requestError) {
        console.error("OpenAI test request failed:", requestError);
        setIsLocalModelConnected(false);
        
        toast({
          title: "OpenAI API Bağlantı Hatası",
          description: requestError instanceof Error ? requestError.message : "API anahtarı geçerli değil veya bağlantı hatası.",
          variant: "destructive"
        });
        
        return false;
      }
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
    // Short timeout to ensure localStorage is available
    const timer = setTimeout(() => {
      checkLocalModelStatus();
    }, 500);
    
    // Check connection every 5 minutes
    const intervalId = setInterval(() => {
      if (!isLocalModelConnected) {
        checkLocalModelStatus();
      }
    }, 300000); // 5 minutes
    
    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
    };
  }, [isLocalModelConnected]);

  return {
    isLocalModelConnected,
    checkLocalModelStatus
  };
}

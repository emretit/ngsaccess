
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

export function useModelStatus() {
  const { toast } = useToast();
  const [isOpenAIConnected, setIsOpenAIConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkOpenAIStatus = async () => {
    if (isChecking) return false;
    
    setIsChecking(true);
    try {
      // Check if OpenAI API key exists
      const apiKey = localStorage.getItem('OPENAI_API_KEY');
      
      if (!apiKey) {
        setIsOpenAIConnected(false);
        toast({
          title: "OpenAI API Anahtarı Bulunamadı",
          description: "Lütfen API anahtarınızı ayarlayın.",
          variant: "destructive"
        });
        return false;
      }
      
      // Simple validation for API key format
      if (!apiKey.startsWith('sk-')) {
        setIsOpenAIConnected(false);
        toast({
          title: "Geçersiz OpenAI API Anahtarı",
          description: "API anahtarınızın formatı doğru değil. Anahtarlar genellikle 'sk-' ile başlar.",
          variant: "destructive"
        });
        return false;
      }
      
      // Perform a test request to validate the API key
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const testRequest = await fetch("https://api.openai.com/v1/models", {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!testRequest.ok) {
          const errorData = await testRequest.json().catch(() => ({}));
          const errorMsg = errorData.error?.message || `HTTP ${testRequest.status}`;
          throw new Error(`API doğrulama hatası: ${errorMsg}`);
        }
        
        setIsOpenAIConnected(true);
        toast({
          title: "OpenAI Bağlantısı Hazır",
          description: "API anahtarı doğrulandı, OpenAI kullanıma hazır.",
        });
        return true;
      } catch (requestError) {
        console.error("OpenAI test request failed:", requestError);
        setIsOpenAIConnected(false);
        
        let errorMessage = "API anahtarı doğrulanamadı";
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          errorMessage = "API yanıt vermedi, zaman aşımı.";
        } else if (requestError instanceof Error) {
          errorMessage = requestError.message;
        }
        
        toast({
          title: "OpenAI API Bağlantı Hatası",
          description: errorMessage,
          variant: "destructive"
        });
        
        return false;
      }
    } catch (error) {
      console.error("OpenAI connection check error:", error);
      setIsOpenAIConnected(false);
      
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
      checkOpenAIStatus();
    }, 500);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return {
    isOpenAIConnected,
    checkOpenAIStatus
  };
}

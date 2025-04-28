
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LOCAL_LLAMA_ENDPOINTS } from './constants';

export function useModelStatus() {
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const { toast } = useToast();

  const checkLocalModelStatus = async () => {
    console.log("Checking local model status...");
    let modelConnected = false;

    for (const endpoint of LOCAL_LLAMA_ENDPOINTS.status) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const response = await fetch(endpoint, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Endpoint ${endpoint} response:`, data);
          setIsLocalModelConnected(true);
          modelConnected = true;
          console.log("Local model connection successful");
          
          // Test the completion endpoint as well to verify full functionality
          try {
            const testPrompt = "test connection";
            const completionEndpoint = endpoint.replace('/status', '/completion');
            console.log(`Testing completion endpoint: ${completionEndpoint}`);
            
            const completionResponse = await fetch(completionEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: testPrompt,
                max_tokens: 5,
                temperature: 0.7
              }),
              signal: AbortSignal.timeout(5000)
            });
            
            if (completionResponse.ok) {
              console.log("Completion endpoint working correctly!");
              toast({
                title: "Yerel AI modeline bağlanıldı",
                description: "Llama modeli ile bağlantı başarılı. Şimdi sorularınızı sorabilirsiniz.",
              });
            } else {
              console.log("Completion endpoint not working correctly");
              toast({
                title: "Yerel Model Bağlantısı Kısmen Başarılı",
                description: "Model durumu iyi ancak tamamlama işlevi çalışmıyor olabilir.",
                variant: "default" // Changed from "warning" to "default"
              });
            }
          } catch (completionError) {
            console.error("Completion endpoint test failed:", completionError);
          }
          
          return;
        }
      } catch (error) {
        console.warn(`Endpoint ${endpoint} connection error:`, error);
      }
    }

    if (!modelConnected) {
      console.log("All local model connection attempts failed");
      setIsLocalModelConnected(false);
      toast({
        title: "Yerel Model Bağlantısı Başarısız",
        description: "Yerel model kullanılamıyor. Cloud tabanlı doğal dil işleme modeli kullanılacak.",
        variant: "destructive"
      });
    }
  };

  return {
    isLocalModelConnected,
    checkLocalModelStatus
  };
}

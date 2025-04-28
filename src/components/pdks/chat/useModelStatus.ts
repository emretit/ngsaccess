
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LOCAL_LLAMA_ENDPOINTS } from './constants';

export function useModelStatus() {
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const { toast } = useToast();

  const checkLocalModelStatus = async () => {
    console.log("Checking local model status...");
    let modelConnected = false;
    let workingEndpoint = '';

    // Try all status endpoints
    for (const endpoint of LOCAL_LLAMA_ENDPOINTS.status) {
      try {
        console.log(`Trying status endpoint: ${endpoint}`);
        const response = await fetch(endpoint, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Status endpoint ${endpoint} response:`, data);
          setIsLocalModelConnected(true);
          modelConnected = true;
          workingEndpoint = endpoint;
          console.log("Local model status connection successful");
          break;
        }
      } catch (error) {
        console.warn(`Status endpoint ${endpoint} connection error:`, error);
      }
    }

    // If we found a working status endpoint, check corresponding completion endpoint
    if (modelConnected && workingEndpoint) {
      // Try to find a matching completion endpoint based on the working status endpoint
      let completionEndpoint = '';
      
      if (workingEndpoint.includes('/api/')) {
        completionEndpoint = workingEndpoint.replace('/api/status', '/api/completion');
      } else {
        completionEndpoint = workingEndpoint.replace('/status', '/completion');
      }
      
      try {
        console.log(`Testing completion endpoint: ${completionEndpoint}`);
        
        const completionResponse = await fetch(completionEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: "test connection",
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
          console.log("Completion endpoint not working correctly. Response:", await completionResponse.text());
          toast({
            title: "Yerel Model Bağlantısı Kısmen Başarılı",
            description: "Model durumu iyi ancak tamamlama işlevi çalışmıyor olabilir.",
            variant: "default" // Changed from "warning" to "default"
          });
        }
      } catch (completionError) {
        console.error("Completion endpoint test failed:", completionError);
        toast({
          title: "Yerel Model Kısmen Bağlı",
          description: "Model durumu iyi ancak tamamlama işlevi test edilemedi.",
          variant: "default"
        });
      }
    } else {
      console.log("All local model connection attempts failed");
      setIsLocalModelConnected(false);
      toast({
        title: "Yerel Model Bağlantısı Başarısız",
        description: "Yerel model kullanılamıyor. Cloud tabanlı doğal dil işleme modeli kullanılacak.",
        variant: "destructive"
      });
    }

    return modelConnected;
  };

  return {
    isLocalModelConnected,
    checkLocalModelStatus
  };
}

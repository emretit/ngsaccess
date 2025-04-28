
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LOCAL_LLAMA_ENDPOINTS } from './constants';

export function useModelStatus() {
  const [isLocalModelConnected, setIsLocalModelConnected] = useState(false);
  const { toast } = useToast();

  const checkLocalModelStatus = async () => {
    console.log("GPT4All model durumu kontrol ediliyor...");
    let modelConnected = false;
    let workingEndpoint = '';

    // Try all status endpoints
    for (const endpoint of LOCAL_LLAMA_ENDPOINTS.status) {
      try {
        console.log(`Model durumu kontrol noktası deneniyor: ${endpoint}`);
        const response = await fetch(endpoint, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Model durumu yanıtı ${endpoint}:`, data);
          setIsLocalModelConnected(true);
          modelConnected = true;
          workingEndpoint = endpoint;
          console.log("GPT4All model bağlantısı başarılı");
          break;
        }
      } catch (error) {
        console.warn(`Model durumu kontrolü başarısız ${endpoint}:`, error);
      }
    }

    // If we found a working status endpoint, check corresponding completion endpoint
    if (modelConnected && workingEndpoint) {
      // Try to find a matching completion endpoint based on the working status endpoint
      let completionEndpoint = workingEndpoint.replace('/v1/models', '/v1/chat/completions');
      
      try {
        console.log(`Tamamlama uç noktası test ediliyor: ${completionEndpoint}`);
        
        const completionResponse = await fetch(completionEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: "test connection"
              }
            ],
            model: "gpt4all-j",
            temperature: 0.7,
            max_tokens: 5
          }),
          signal: AbortSignal.timeout(5000)
        });
        
        if (completionResponse.ok) {
          console.log("Tamamlama uç noktası çalışıyor!");
          toast({
            title: "GPT4All Modeline Bağlanıldı",
            description: "GPT4All modeli ile bağlantı başarılı. Şimdi sorularınızı sorabilirsiniz.",
          });
        } else {
          console.log("Tamamlama uç noktası çalışmıyor. Yanıt:", await completionResponse.text());
          toast({
            title: "Model Bağlantısı Kısmen Başarılı",
            description: "Model durumu iyi ancak tamamlama işlevi çalışmıyor olabilir.",
            variant: "default"
          });
        }
      } catch (completionError) {
        console.error("Tamamlama testi başarısız:", completionError);
        toast({
          title: "Model Kısmen Bağlı",
          description: "Model durumu iyi ancak tamamlama işlevi test edilemedi.",
          variant: "default"
        });
      }
    } else {
      console.log("Tüm model bağlantı denemeleri başarısız");
      setIsLocalModelConnected(false);
      toast({
        title: "GPT4All Bağlantısı Başarısız",
        description: "Yerel GPT4All modeli kullanılamıyor. Cloud tabanlı doğal dil işleme modeli kullanılacak.",
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

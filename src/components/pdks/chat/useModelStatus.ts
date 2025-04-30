
import { useState, useCallback, useEffect } from 'react';

export function useModelStatus() {
  const [isOpenAIConnected, setIsOpenAIConnected] = useState<boolean>(false);

  const checkOpenAIStatus = useCallback(async () => {
    const apiKey = localStorage.getItem('OPENAI_API_KEY');
    
    if (!apiKey) {
      setIsOpenAIConnected(false);
      return;
    }

    try {
      // Make a simple call to OpenAI API to check if the key works
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      setIsOpenAIConnected(response.ok);
      
      if (!response.ok) {
        // If the key is invalid, remove it
        if (response.status === 401) {
          localStorage.removeItem('OPENAI_API_KEY');
        }
        console.error("OpenAI API key validation failed:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("OpenAI API check failed:", error);
      setIsOpenAIConnected(false);
    }
  }, []);

  // Check on initial load
  useEffect(() => {
    checkOpenAIStatus();
  }, [checkOpenAIStatus]);

  return {
    isOpenAIConnected,
    checkOpenAIStatus
  };
}

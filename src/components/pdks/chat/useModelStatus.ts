
import { useState, useCallback, useEffect } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

export function useModelStatus() {
  const [isOpenAIConnected, setIsOpenAIConnected] = useState<boolean>(false);
  const getOpenAIStatus = useAction(api.actions.openaiChat.status);

  const checkOpenAIStatus = useCallback(async () => {
    try {
      const response = await getOpenAIStatus({});
      setIsOpenAIConnected(response.configured);
    } catch (error) {
      console.error("OpenAI API check failed:", error);
      setIsOpenAIConnected(false);
    }
  }, [getOpenAIStatus]);

  // Check on initial load
  useEffect(() => {
    checkOpenAIStatus();
  }, [checkOpenAIStatus]);

  return {
    isOpenAIConnected,
    checkOpenAIStatus
  };
}

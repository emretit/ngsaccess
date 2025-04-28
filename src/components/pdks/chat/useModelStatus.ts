
import { useToast } from "@/hooks/use-toast";

export function useModelStatus() {
  const { toast } = useToast();

  const checkLocalModelStatus = async () => {
    return true; // Always return true since we're not using local models
  };

  return {
    isLocalModelConnected: true, // Always return true since we're not using local models
    checkLocalModelStatus
  };
}

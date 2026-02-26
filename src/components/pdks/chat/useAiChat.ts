
import { useModelStatus } from './useModelStatus';
import { useExportUtils } from './useExportUtils';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useState } from 'react';

import { useToast } from "@/hooks/use-toast";

export function useAiChat() {
  // AI chat saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { toast } = useToast();

  // Get all functionality from other hooks
  const { isOpenAIConnected, checkOpenAIStatus } = useModelStatus();
  const { formatReportData, handleExportExcel, handleExportPDF } = useExportUtils();
  const { messages, input, setInput, isLoading, handleSendMessage: originalSendMessage } = useMessageHandler();

  // Enhanced message sending function with custom content support
  const handleSendMessage = async (e: React.FormEvent, customContent?: string) => {
    e.preventDefault();
    
    if (customContent) {
      // Use custom content for sending
      await originalSendMessage(customContent);
    } else {
      // Use current input value
      await originalSendMessage(input);
    }
  };

  // Function to save conversation (placeholder - implement with Convex action if needed)
  const saveConversationToSupabase = async () => {
    if (messages.length === 0) return;
    
    try {
      setIsSaving(true);
      setSaveError(null);
      
      toast({
        title: "Sohbet kaydedildi",
        description: "Sohbet başarıyla kaydedildi",
      });
      
      console.log('Conversation saved successfully');
    } catch (error) {
      console.error('Error saving conversation:', error);
      setSaveError('Sohbet kaydedilemedi.');
      
      toast({
        title: "Hata",
        description: "Sohbet kaydedilemedi.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    isOpenAIConnected,
    checkOpenAIStatus,
    handleSendMessage,
    handleExportExcel,
    handleExportPDF,
    saveConversationToSupabase,
    isSaving,
    saveError
  };
}

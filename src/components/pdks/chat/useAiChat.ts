import { useMutation } from "convex/react";
import { useModelStatus } from './useModelStatus';
import { useExportUtils } from './useExportUtils';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { useState } from 'react';

import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/convexApi";

export function useAiChat() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { toast } = useToast();
  const { projectIds, isSuperAdmin } = useProjectAccess();
  const saveConversation = useMutation(api.chatConversations.save);

  const { isOpenAIConnected, checkOpenAIStatus } = useModelStatus();
  const { formatReportData, handleExportExcel, handleExportPDF } = useExportUtils();
  const { messages, input, setInput, isLoading, handleSendMessage: originalSendMessage } = useMessageHandler();

  const handleSendMessage = async (e: React.FormEvent, customContent?: string) => {
    e.preventDefault();

    if (customContent) {
      await originalSendMessage(customContent);
    } else {
      await originalSendMessage(input);
    }
  };

  const saveConversationToConvex = async () => {
    if (messages.length === 0) return;

    try {
      setIsSaving(true);
      setSaveError(null);

      const convexMessages = messages.map((m: any) => ({
        role: m.type as "user" | "assistant",
        content: m.content,
        data: m.data,
      }));

      await saveConversation({
        projectId: isSuperAdmin ? undefined : projectIds[0],
        title: messages[0]?.content?.slice(0, 50) ?? "Sohbet",
        messages: convexMessages,
      });

      toast({
        title: "Sohbet kaydedildi",
        description: "Sohbet başarıyla Convex'e kaydedildi",
      });
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
    saveConversation: saveConversationToConvex,
    isSaving,
    saveError
  };
}

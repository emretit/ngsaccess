
import { useModelStatus } from './useModelStatus';
import { useExportUtils } from './useExportUtils';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Message } from './types';
import { useToast } from '@/hooks/use-toast';

export function useAiChat() {
  const { toast } = useToast();
  // Get all functionality from other hooks
  const { isOpenAIConnected, checkOpenAIStatus } = useModelStatus();
  const { formatReportData, handleExportExcel, handleExportPDF } = useExportUtils();
  const { messages, input, setInput, isLoading, handleSendMessage, addMessage } = useMessageHandler();

  // Konuşmanın veritabanına kaydedilmesi işlemi
  const handleSaveConversation = useCallback(async () => {
    try {
      if (messages.length === 0) {
        toast({
          title: "Kaydetme başarısız",
          description: "Kaydedilecek konuşma bulunamadı.",
          variant: "destructive"
        });
        return;
      }
      
      const conversationTitle = messages.find(m => m.type === 'user')?.content.substring(0, 50) + "...";
      
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert([
          { 
            title: conversationTitle || "PDKS AI Konuşması", 
            messages: messages,
            created_at: new Date().toISOString()
          }
        ])
        .select();
      
      if (error) {
        console.error("Konuşma kaydedilirken hata:", error);
        throw error;
      }
      
      toast({
        title: "Konuşma kaydedildi",
        description: "AI konuşması başarıyla veritabanına kaydedildi."
      });
      
      return data;
    } catch (error) {
      console.error("Konuşma kaydedilemedi:", error);
      toast({
        title: "Kaydetme başarısız",
        description: "Konuşma kaydedilirken bir hata oluştu.",
        variant: "destructive"
      });
      return null;
    }
  }, [messages, toast]);

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
    handleSaveConversation
  };
}

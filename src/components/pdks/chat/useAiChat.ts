
import { useModelStatus } from './useModelStatus';
import { useExportUtils } from './useExportUtils';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useAiChat() {
  // AI sohbetini kaydetme durumu
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { toast } = useToast();

  // Get all functionality from other hooks
  const { isOpenAIConnected, checkOpenAIStatus } = useModelStatus();
  const { formatReportData, handleExportExcel, handleExportPDF } = useExportUtils();
  const { messages, input, setInput, isLoading, handleSendMessage } = useMessageHandler();

  // Sohbet mesajlarını veritabanına kaydetme fonksiyonu
  const saveConversationToSupabase = async () => {
    if (messages.length === 0) return;
    
    try {
      setIsSaving(true);
      setSaveError(null);
      
      // Sohbet verilerini hazırla
      const conversationData = {
        messages: JSON.stringify(messages),
        created_at: new Date().toISOString(),
        title: messages[0]?.content.substring(0, 50) || 'Yeni sohbet'
      };
      
      // Supabase'e kaydet - card_readings tablosunun conversation_data alanına
      const { error } = await supabase
        .from('card_readings')
        .insert([{
          card_no: 'AI_CHAT_' + new Date().getTime(),
          access_granted: true,
          conversation_data: conversationData
        }]);
      
      if (error) throw error;
      
      toast({
        title: "Sohbet kaydedildi",
        description: "Sohbet başarıyla kaydedildi",
      });
      
      console.log('Sohbet başarıyla kaydedildi');
    } catch (error) {
      console.error('Sohbet kaydedilirken hata:', error);
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

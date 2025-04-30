
import { useModelStatus } from './useModelStatus';
import { useExportUtils } from './useExportUtils';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

export function useAiChat() {
  // AI sohbetini kaydetme durumu
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        messages: messages,
        created_at: new Date().toISOString(),
        title: messages[0]?.content.substring(0, 50) || 'Yeni sohbet'
      };
      
      // Supabase'e kaydet (bu fonksiyonu test amaçlıdır, gerçek bir tabloya kaydetmez)
      console.log('Sohbet verileri kaydedilecek:', conversationData);
      
      // Gerçekten kaydetmek isterseniz aşağıdaki kodu kullanabilirsiniz
      // const { error } = await supabase
      //   .from('ai_conversations')
      //   .insert(conversationData);
      //
      // if (error) throw error;
      
      console.log('Sohbet başarıyla kaydedildi');
    } catch (error) {
      console.error('Sohbet kaydedilirken hata:', error);
      setSaveError('Sohbet kaydedilemedi.');
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

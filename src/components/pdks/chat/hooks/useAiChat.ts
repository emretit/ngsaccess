
import { useModelStatus } from '../useModelStatus';
import { useExportUtils } from '../useExportUtils';
import { useMessageHandler } from './useMessageHandler';

export function useAiChat() {
  const { isLocalModelConnected, checkLocalModelStatus } = useModelStatus();
  const { formatReportData, handleExportExcel, handleExportPDF } = useExportUtils();
  const { messages, input, setInput, isLoading, handleSendMessage } = useMessageHandler();

  return {
    messages,
    input,
    setInput,
    isLoading,
    isLocalModelConnected,
    checkLocalModelStatus,
    handleSendMessage,
    handleExportExcel,
    handleExportPDF
  };
}

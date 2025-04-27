import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AiChatMessage } from "./chat/AiChatMessage";
import { AiChatInput } from "./chat/AiChatInput";
import { AiModelStatus } from "./chat/AiModelStatus";
import { useAiChat } from "./chat/useAiChat";
import { Info } from "lucide-react";

export function PDKSAiChat() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    isLocalModelConnected,
    handleSendMessage,
    handleExportExcel,
    handleExportPDF
  } = useAiChat();

  return (
    <Card className="w-full h-[calc(100vh-12rem)] shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">PDKS AI Rapor Asistanı</CardTitle>
        <AiModelStatus isConnected={isLocalModelConnected} />
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4 flex flex-col h-full">
          <div className="bg-muted/50 rounded-lg p-2 text-xs text-muted-foreground flex items-start">
            <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <p>
              Departman adı yazarak (örn. "Engineering") ilgili çalışanları görebilirsiniz. 
              Tarih ve departmanı birlikte belirterek (örn. "Engineering departmanı mart ayı") 
              özel raporlar alabilirsiniz.
            </p>
          </div>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <AiChatMessage
                  key={message.id}
                  message={message}
                  onExportExcel={handleExportExcel}
                  onExportPDF={handleExportPDF}
                />
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2 flex space-x-2 items-center">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-300" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <AiChatInput
            input={input}
            isLoading={isLoading}
            onInputChange={setInput}
            onSubmit={handleSendMessage}
            placeholder="Departman adı veya rapor sorgusu yazın..."
          />
        </div>
      </CardContent>
    </Card>
  );
}


import { FileText, Download, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { PDKSReportTable } from "./PDKSReportTable";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageData } from './types';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  data?: MessageData[];
}

interface AiChatMessageProps {
  message: Message;
  onExportExcel: (data: MessageData[]) => void;
  onExportPDF: (data: MessageData[]) => void;
}

export function AiChatMessage({ message, onExportExcel, onExportPDF }: AiChatMessageProps) {
  const isUser = message.type === 'user';
  const hasData = message.data && message.data.length > 0;
  
  return (
    <div className={cn(
      "flex w-full",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-lg px-3 py-2 text-sm mb-2",
          isUser
            ? "bg-primary text-primary-foreground max-w-[85%]"
            : "bg-muted max-w-[85%]"
        )}
      >
        <div className="break-words">{message.content}</div>
        
        {hasData && (
          <div className="mt-2 w-full">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="h-7 gap-1"
                onClick={() => onExportExcel(message.data!)}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Excel</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="h-7 gap-1"
                onClick={() => onExportPDF(message.data!)}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>PDF</span>
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-7 gap-1"
                  >
                    <Info className="h-3.5 w-3.5" />
                    <span>Debug Bilgisi</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="font-medium">Sorgu Detayları</h4>
                    <div className="text-xs space-y-1">
                      <div>Departman Filtresi: <span className="font-mono bg-muted-foreground/20 px-1 rounded">{message.data?.[0]?.department || 'Belirtilmedi'}</span></div>
                      <div>Kayıt Sayısı: <span className="font-mono bg-muted-foreground/20 px-1 rounded">{message.data?.length || 0}</span></div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="rounded-md border overflow-hidden overflow-x-auto">
              <PDKSReportTable data={message.data} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

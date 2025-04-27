
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { PDKSReportTable } from "./PDKSReportTable";

interface MessageData {
  name: string;
  check_in: string;
  check_out: string | null;
  department: string;
}

interface AiChatMessageProps {
  message: {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    data?: MessageData[];
  };
  onExportExcel: (data: MessageData[]) => void;
  onExportPDF: (data: MessageData[]) => void;
}

export function AiChatMessage({ message, onExportExcel, onExportPDF }: AiChatMessageProps) {
  const renderMessageContent = () => {
    if (message.data) {
      return (
        <div className="space-y-2">
          <div className="flex justify-end gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExportExcel(message.data!)}
              title="Excel olarak indir"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExportPDF(message.data!)}
              title="PDF olarak indir"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
          <p>{message.content}</p>
          <PDKSReportTable data={message.data} />
        </div>
      );
    }
    return message.content;
  };

  return (
    <div
      key={message.id}
      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`rounded-lg px-4 py-2 max-w-[80%] animate-fade-in ${
          message.type === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        {renderMessageContent()}
      </div>
    </div>
  );
}

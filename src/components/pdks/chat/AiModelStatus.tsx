
import { Server, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AiModelStatusProps {
  isConnected: boolean;
}

export function AiModelStatus({ isConnected }: AiModelStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-xs text-gray-500 flex items-center gap-1">
        {isConnected ? (
          <>
            <Server size={12} /> 
            GPT4All Aktif
          </>
        ) : (
          <>
            <AlertCircle size={12} />
            Yerel AI Bağlantısı Yok
          </>
        )}
      </span>
    </div>
  );
}

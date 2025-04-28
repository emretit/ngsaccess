
import { Server, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AiModelStatusProps {
  isConnected: boolean;
}

export function AiModelStatus({ isConnected }: AiModelStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-xs text-gray-500 flex items-center gap-1">
        <Server size={12} /> 
        {isConnected ? 'Yerel Model Aktif' : 'Yerel Model Bağlantısı Yok'}
      </span>
      {!isConnected && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertTriangle size={14} className="text-amber-500 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-80">
            <p className="text-xs">
              Yerel Llama modeli bağlantısı kurulamadı. Lütfen sunucunun çalıştığından emin olun. 
              Kurulum detayları için <a href="#" className="text-blue-500 underline">local-llama-setup.md</a> dosyasını inceleyebilirsiniz.
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}


import { Sparkles, AlertCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AiModelStatusProps {
  isConnected: boolean;
}

export function AiModelStatus({ isConnected }: AiModelStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
      <span className="text-xs text-gray-500 flex items-center gap-1">
        {isConnected ? (
          <>
            <Sparkles size={12} className="text-amber-500" /> 
            <span>OpenAI Aktif</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={12} className="text-blue-500 ml-1 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[250px] text-xs">
                OpenAI bağlantısı aktif - API anahtarı doğrulandı
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <AlertCircle size={12} />
            <span>OpenAI Bağlantısı Yok</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={12} className="text-blue-500 ml-1 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[290px] text-xs">
                OpenAI API anahtarınızı kontrol edin veya yeniden girin.
                Geçerli bir API anahtarı (sk- ile başlayan) girmeniz gerekiyor.
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </span>
    </div>
  );
}

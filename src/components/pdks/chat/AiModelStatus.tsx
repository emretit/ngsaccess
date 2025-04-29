
import { Server, AlertCircle, Sparkles, Info } from "lucide-react";
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
            <span>GPT4All Aktif</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Sparkles size={12} className="text-amber-500 ml-1" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[250px] text-xs">
                PDKS uzman asistan sistemi aktif
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <AlertCircle size={12} />
            <span>Yerel AI Bağlantısı Yok</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={12} className="text-blue-500 ml-1" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[290px] text-xs">
                GPT4All uygulamasını başlatın ve API sunucusunu etkinleştirin. 
                Daha fazla bilgi için yardım dokümanını inceleyebilirsiniz.
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </span>
    </div>
  );
}

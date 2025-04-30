
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AiModelStatusProps {
  isConnected: boolean;
}

export function AiModelStatus({ isConnected }: AiModelStatusProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Badge 
            variant={isConnected ? "success" : "destructive"}
            className="gap-1.5 py-1"
          >
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {isConnected ? 'OpenAI Bağlı' : 'OpenAI Bağlı Değil'}
          </Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {isConnected 
          ? 'OpenAI API bağlantısı aktif' 
          : 'OpenAI API anahtarınızı ayarlamanız gerekiyor'}
      </TooltipContent>
    </Tooltip>
  );
}

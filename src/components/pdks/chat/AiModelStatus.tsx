import { Server } from "lucide-react";

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
    </div>
  );
}

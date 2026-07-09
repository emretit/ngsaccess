
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface OpenAiKeyInputProps {
  onComplete: () => void;
}

export function OpenAiKeyInput({ onComplete }: OpenAiKeyInputProps) {
  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <div className="text-center">
        <h3 className="text-lg font-semibold">OpenAI API Anahtarınız</h3>
        <p className="text-sm text-muted-foreground">
          PDKS AI Asistanı artık güvenli sunucu yapılandırmasını kullanır.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          OpenAI için Convex ortamında OPENAI_API_KEY tanımlı olmalıdır. Tarayıcıda API anahtarı saklanmaz.
        </AlertDescription>
      </Alert>

      <Button type="button" className="w-full" onClick={onComplete}>
        Devam Et
      </Button>
    </div>
  );
}

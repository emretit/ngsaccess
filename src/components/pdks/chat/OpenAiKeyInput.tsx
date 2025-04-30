
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface OpenAiKeyInputProps {
  onComplete: () => void;
}

export function OpenAiKeyInput({ onComplete }: OpenAiKeyInputProps) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      if (!apiKey.trim()) {
        setError("API anahtarı boş olamaz");
        return;
      }

      if (!apiKey.startsWith("sk-")) {
        setError("OpenAI API anahtarları 'sk-' ile başlamalıdır");
        return;
      }

      // Store the API key in localStorage
      localStorage.setItem('OPENAI_API_KEY', apiKey);
      
      // Validate the API key with a simple call
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "API anahtarı doğrulanamadı");
      }
      
      // If we got here, the key is valid
      onComplete();
      
    } catch (error) {
      console.error("API key validation error:", error);
      setError(error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <div className="text-center">
        <h3 className="text-lg font-semibold">OpenAI API Anahtarınız</h3>
        <p className="text-sm text-muted-foreground">
          PDKS AI Asistanı için OpenAI API anahtarınızı girin. 
          Bu anahtar tarayıcınızda yerel olarak saklanacak ve sunucuya gönderilmeyecektir.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            type="password"
            placeholder="OpenAI API anahtarınızı girin (sk-...)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            OpenAI API anahtarınızı <a 
              href="https://platform.openai.com/account/api-keys" 
              target="_blank" 
              rel="noreferrer" 
              className="underline hover:text-primary"
            >
              openai.com
            </a> adresinden alabilirsiniz.
          </p>
        </div>

        <Button 
          type="submit" 
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Doğrulanıyor..." : "API Anahtarını Doğrula"}
        </Button>
      </form>
    </div>
  );
}

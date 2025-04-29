
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OpenAiKeyInputProps {
  onComplete: () => void;
}

export function OpenAiKeyInput({ onComplete }: OpenAiKeyInputProps) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if key was provided in URL or exists in localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const keyFromUrl = urlParams.get('apikey');
    
    if (keyFromUrl) {
      setApiKey(keyFromUrl);
      // Remove the key from URL for security
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check if there's an API key in localStorage
      const storedKey = localStorage.getItem('OPENAI_API_KEY');
      if (storedKey) {
        setApiKey(storedKey);
      }
    }
  }, []);

  const validateApiKey = (key: string) => {
    if (!key.trim()) {
      return "API anahtarı boş olamaz";
    }
    
    if (!key.startsWith('sk-')) {
      return "API anahtarı 'sk-' ile başlamalıdır";
    }
    
    return "";
  };

  const handleSaveKey = () => {
    const validationError = validateApiKey(apiKey);
    if (validationError) {
      setError(validationError);
      toast({
        title: "API Anahtarı Geçersiz",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    // Clear any previous errors
    setError("");
    
    // Save to localStorage
    localStorage.setItem('OPENAI_API_KEY', apiKey);
    
    toast({
      title: "API Anahtarı Kaydedildi",
      description: "OpenAI API anahtarınız başarıyla kaydedildi.",
    });
    
    onComplete();
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center gap-2">
        <Key size={16} />
        <h3 className="text-sm font-medium">OpenAI API Anahtarı Ayarla</h3>
      </div>
      
      <p className="text-xs text-muted-foreground">
        PDKS AI asistanını kullanmak için OpenAI API anahtarı gereklidir. 
        API anahtarı 'sk-' ile başlamalıdır.
      </p>
      
      <div className="flex gap-2">
        <Input
          type={isVisible ? "text" : "password"}
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className={`flex-1 ${error ? "border-red-500" : ""}`}
        />
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? "Gizle" : "Göster"}
        </Button>
      </div>
      
      {error && (
        <div className="flex items-center text-red-500 text-xs gap-1">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
      
      <Button onClick={handleSaveKey} className="w-full">
        Kaydet ve Devam Et
      </Button>
    </div>
  );
}

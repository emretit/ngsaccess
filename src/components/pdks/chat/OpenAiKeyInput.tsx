
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OpenAiKeyInputProps {
  onComplete: () => void;
}

export function OpenAiKeyInput({ onComplete }: OpenAiKeyInputProps) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if key was provided in URL or exists in localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const keyFromUrl = urlParams.get('apikey');
    
    if (keyFromUrl) {
      setApiKey(keyFromUrl);
      // Remove the key from URL for security
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSaveKey = () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Anahtarı Gerekli",
        description: "Lütfen geçerli bir OpenAI API anahtarı girin.",
        variant: "destructive"
      });
      return;
    }

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
      </p>
      
      <div className="flex gap-2">
        <Input
          type={isVisible ? "text" : "password"}
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="flex-1"
        />
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? "Gizle" : "Göster"}
        </Button>
      </div>
      
      <Button onClick={handleSaveKey} className="w-full">
        Kaydet ve Devam Et
      </Button>
    </div>
  );
}


import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CardReaderTester = () => {
  const [cardNumber, setCardNumber] = useState("3505234822042881");
  const [deviceId, setDeviceId] = useState("1234");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const { toast } = useToast();
  
  const supabaseUrl = "https://gjudsghhwmnsnndnswho.supabase.co";
  const apiEndpoint = `${supabaseUrl}/functions/v1/device-readings`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    
    try {
      toast({
        title: "İstek gönderiliyor",
        description: `Kart No: ${cardNumber}, Cihaz ID: ${deviceId}`,
      });
      
      console.log("Sending test card reading request to:", apiEndpoint);

      // Edge function'ı direk çağıralım
      const { data, error } = await supabase.functions.invoke('device-readings', {
        body: {
          "user_id,serial": `%T${deviceId},${cardNumber}`
        },
        headers: {
          "x-api-key": "DEVICE_API_KEY"
        }
      });
      
      console.log("API Response:", data, error);
      setResponse(data || error);
      
      if (error) {
        toast({
          title: "Hata",
          description: `İstek başarısız: ${error.message || "Bilinmeyen hata"}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Başarılı",
          description: `Kart okutma kaydı oluşturuldu: ${data?.response || "OK"}`,
        });
      }
    } catch (error) {
      console.error("Test error:", error);
      setResponse(error);
      toast({
        title: "Hata",
        description: `İşlem hatası: ${(error as Error).message || "Bilinmeyen hata"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualRequest = async () => {
    setLoading(true);
    setResponse(null);
    
    try {
      toast({
        title: "Manuel istek gönderiliyor",
        description: "Doğrudan HTTP isteği yapılıyor...",
      });
      
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "DEVICE_API_KEY" // Gerçek ortamda bu anahtarı kullanın
        },
        body: JSON.stringify({
          "user_id,serial": `%T${deviceId},${cardNumber}`
        })
      });
      
      const data = await response.json();
      console.log("Manual API Response:", data);
      setResponse(data);
      
      if (!response.ok) {
        toast({
          title: "Hata",
          description: `HTTP İsteği başarısız: ${response.status} ${response.statusText}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Başarılı",
          description: `Kart okutma kaydı oluşturuldu: ${data?.response || "OK"}`,
        });
      }
    } catch (error) {
      console.error("Manual request error:", error);
      setResponse(error);
      toast({
        title: "Hata",
        description: `İstek hatası: ${(error as Error).message || "Bilinmeyen hata"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Kart Okuyucu Test Aracı</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="cardNumber">Kart Numarası:</Label>
          <Input
            id="cardNumber"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="Kart numarası giriniz"
            required
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="deviceId">Cihaz ID:</Label>
          <Input
            id="deviceId"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="Cihaz ID giriniz"
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Fonksiyon ile Test
          </Button>
          
          <Button type="button" variant="outline" onClick={handleManualRequest} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            HTTP ile Test
          </Button>
        </div>
      </form>
      
      {response && (
        <div className="mt-6">
          <h3 className="font-medium mb-2">API Yanıtı:</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-[300px]">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="mt-6 text-sm text-muted-foreground">
        <h3 className="font-medium mb-1">Kart Okuyucu Yapılandırması:</h3>
        <div className="space-y-1">
          <p><strong>API Endpoint:</strong> {apiEndpoint}</p>
          <p><strong>Header:</strong> x-api-key: DEVICE_API_KEY</p>
          <p><strong>Method:</strong> POST</p>
          <p><strong>Body Format:</strong> &#123;"user_id,serial": "%T[DEVICE_ID],[CARD_NUMBER]"&#125;</p>
        </div>
      </div>
    </Card>
  );
};

export default CardReaderTester;

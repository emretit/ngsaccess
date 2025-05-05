
import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const CardReaderTester = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [deviceId, setDeviceId] = useState("TEST-DEVICE-001");
  const [response, setResponse] = useState<any>(null);
  const [functionUrl, setFunctionUrl] = useState("https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/device-readings");
  
  const handleSendRequest = async () => {
    if (!cardNumber || !deviceId) {
      toast({
        title: "Eksik Bilgiler",
        description: "Kart numarası ve cihaz ID'si gereklidir",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          card_no: cardNumber,
          device_id: deviceId,
        }),
      });

      const data = await response.json();
      setResponse(data);
      
      toast({
        title: response.ok ? "İşlem Başarılı" : "Hata",
        description: response.ok ? "Kart okutma işlemi gerçekleşti." : "Kart okutma işleminde hata oluştu.",
        variant: response.ok ? "default" : "destructive",
      });
    } catch (error) {
      console.error("İstek hatası:", error);
      toast({
        title: "Bağlantı Hatası",
        description: "Edge function'a bağlantı sağlanamadı",
        variant: "destructive",
      });
      setResponse({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Kart Okuyucu Test Aracı</h2>
      
      <Tabs defaultValue="tester">
        <TabsList className="mb-4">
          <TabsTrigger value="tester">Kart Okuyucu Test</TabsTrigger>
          <TabsTrigger value="config">Ayarlar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tester" className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="cardNumber">Kart Numarası</Label>
              <Input 
                id="cardNumber" 
                value={cardNumber} 
                onChange={(e) => setCardNumber(e.target.value)} 
                placeholder="Kart numarasını girin" 
              />
            </div>
            
            <div>
              <Label htmlFor="deviceId">Cihaz ID</Label>
              <Input 
                id="deviceId" 
                value={deviceId} 
                onChange={(e) => setDeviceId(e.target.value)} 
                placeholder="Cihaz ID'sini girin"
              />
            </div>
            
            <Button 
              onClick={handleSendRequest} 
              disabled={loading}
              className="mt-2"
            >
              {loading ? "İşleniyor..." : "Kart Okut"}
            </Button>
          </div>
          
          {response && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Yanıt:</h3>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="config">
          <div className="space-y-4">
            <div>
              <Label htmlFor="functionUrl">Edge Function URL</Label>
              <Input 
                id="functionUrl" 
                value={functionUrl} 
                onChange={(e) => setFunctionUrl(e.target.value)} 
                placeholder="Edge function URL"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Varsayılan: https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/device-readings
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default CardReaderTester;

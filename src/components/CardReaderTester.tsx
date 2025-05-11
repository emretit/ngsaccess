
import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AccessManagementForm from './AccessManagementForm';

const CardReaderTester = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [deviceId, setDeviceId] = useState("TEST-DEVICE-001");
  const [response, setResponse] = useState<any>(null);
  const [apiUrl, setApiUrl] = useState("/api/card-reader");
  
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
      
      // Kart okuyucu cihazını simüle eden formatı hazırla
      const payload = {
        user_id_serial: `%T${cardNumber},${deviceId}`,
      };
      
      console.log("İstek gönderiliyor:", payload);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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
        description: "API endpoint'e bağlantı sağlanamadı",
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
          <TabsTrigger value="device-config">Cihaz Ayarları</TabsTrigger>
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
              <Label htmlFor="apiUrl">API Endpoint URL</Label>
              <Input 
                id="apiUrl" 
                value={apiUrl} 
                onChange={(e) => setApiUrl(e.target.value)} 
                placeholder="API endpoint URL"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Varsayılan: /api/card-reader
              </p>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="device-config">
          <AccessManagementForm />
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default CardReaderTester;

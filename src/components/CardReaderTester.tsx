
import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const CardReaderTester = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [deviceId, setDeviceId] = useState("TEST-DEVICE-001");
  const [response, setResponse] = useState<any>(null);
  const [apiUrl, setApiUrl] = useState("/api/card-reader");
  
  // Edge Function settings
  const [useEdgeFunction, setUseEdgeFunction] = useState(true);
  const [edgeFunctionUrl, setEdgeFunctionUrl] = useState("/.netlify/edge-functions/card-reader");
  
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
      
      // Use the edge function URL if selected, otherwise use the API URL
      const targetUrl = useEdgeFunction ? edgeFunctionUrl : apiUrl;
      
      const response = await fetch(targetUrl, {
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
          <TabsTrigger value="netlify">Netlify Edge</TabsTrigger>
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

        <TabsContent value="netlify">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="useEdgeFunction"
                checked={useEdgeFunction}
                onCheckedChange={setUseEdgeFunction}
              />
              <Label htmlFor="useEdgeFunction">Netlify Edge Function Kullan</Label>
            </div>
            
            {useEdgeFunction && (
              <div>
                <Label htmlFor="edgeFunctionUrl">Edge Function URL</Label>
                <Input
                  id="edgeFunctionUrl"
                  value={edgeFunctionUrl}
                  onChange={(e) => setEdgeFunctionUrl(e.target.value)}
                  placeholder="Edge Function URL"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Varsayılan: /.netlify/edge-functions/card-reader
                </p>
              </div>
            )}

            <div className="mt-4 border p-4 rounded-md bg-muted/50">
              <h3 className="font-medium mb-2">Netlify Edge Function Bilgisi</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Netlify Edge Functions, kart okuyucu isteklerini işlemek için kullanılabilir.
                Bu fonksiyonlar Deno runtime üzerinde çalışır ve global CDN altyapısında dağıtılır.
              </p>
              <Separator className="my-3" />
              <p className="text-sm">
                Netlify Edge Function kurulumu için:
              </p>
              <ol className="text-sm list-decimal list-inside text-muted-foreground mt-2">
                <li>netlify.toml dosyasında edge_functions bölümünü tanımlayın</li>
                <li>netlify/edge-functions klasörü içinde card-reader.js fonksiyonunu oluşturun</li>
                <li>Netlify'da projenizi deploy edin</li>
              </ol>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default CardReaderTester;

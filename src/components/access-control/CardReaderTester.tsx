
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CardReaderTester = () => {
  const [cardNumber, setCardNumber] = useState("3505234822042881");
  const [deviceId, setDeviceId] = useState("1234");
  const [deviceUrl, setDeviceUrl] = useState("http://localhost:8080/api/card-reading");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const { toast } = useToast();
  
  // Direct HTTP request to the card reader device
  const handleDirectDeviceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    
    try {
      toast({
        title: "İstek gönderiliyor",
        description: `Kart No: ${cardNumber}, Cihaz ID: ${deviceId}, URL: ${deviceUrl}`,
      });
      
      console.log("Sending card reading request directly to device:", deviceUrl);

      // Send HTTP request directly to the device
      const response = await fetch(deviceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "DEVICE_API_KEY" // This would be your actual device API key
        },
        body: JSON.stringify({
          "user_id,serial": `%T${deviceId},${cardNumber}`
        })
      });
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = { message: "JSON parsing error: " + (await response.text()) };
      }
      
      console.log("Device Response:", data);
      setResponse(data);
      
      if (!response.ok) {
        toast({
          title: "Hata",
          description: `Cihaz isteği başarısız: ${response.status} ${response.statusText}`,
          variant: "destructive",
        });
      } else {
        // If successful, also record this in our database
        await recordCardReading(cardNumber, deviceId, data);
        
        toast({
          title: "Başarılı",
          description: `Kart okutma kaydı oluşturuldu`,
        });
      }
    } catch (error) {
      console.error("Device request error:", error);
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

  // Record the card reading directly in the database
  const recordCardReading = async (cardNo: string, deviceId: string, responseData: any) => {
    try {
      // Get employee info based on card number
      const { data: employeeData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, photo_url')
        .eq('card_number', cardNo)
        .single();
      
      // Get device info
      const { data: deviceData } = await supabase
        .from('devices')
        .select('id, name, location')
        .eq('device_serial', deviceId)
        .single();
      
      // Determine access status
      const accessGranted = employeeData != null;
      
      // Insert card reading record
      const { data, error } = await supabase
        .from('card_readings')
        .insert({
          card_no: cardNo,
          access_granted: accessGranted,
          employee_id: employeeData?.id || null,
          employee_name: employeeData ? 
            `${employeeData.first_name} ${employeeData.last_name}` : 
            "Bilinmeyen Kart",
          employee_photo_url: employeeData?.photo_url || null,
          device_id: deviceData?.id || null,
          device_name: deviceData?.name || `Cihaz-${deviceId}`,
          device_location: deviceData?.location || "",
          device_ip: deviceId,
          device_serial: deviceId,
          status: accessGranted ? 'success' : 'denied',
          raw_data: JSON.stringify(responseData)
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error recording card reading:", error);
      throw error;
    }
  };

  // Simulate a card reading without external device
  const handleSimulateCardReading = async () => {
    setLoading(true);
    setResponse(null);
    
    try {
      toast({
        title: "Kart okutma simülasyonu",
        description: "Doğrudan veritabanına kayıt oluşturuluyor...",
      });
      
      // Get employee info based on card number
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, photo_url')
        .eq('card_number', cardNumber)
        .single();
        
      const accessGranted = employeeData != null;
      const simulatedResponse = {
        response: accessGranted ? "open_relay" : "close_relay",
        confirmation: accessGranted ? "relay_opened" : "access_denied",
        employee_name: employeeData ? 
          `${employeeData.first_name} ${employeeData.last_name}` : 
          "Bilinmeyen Kart",
        timestamp: new Date().toISOString()
      };
      
      // Insert card reading record
      const { data, error } = await supabase
        .from('card_readings')
        .insert({
          card_no: cardNumber,
          access_granted: accessGranted,
          employee_id: employeeData?.id || null,
          employee_name: employeeData ? 
            `${employeeData.first_name} ${employeeData.last_name}` : 
            "Bilinmeyen Kart",
          employee_photo_url: employeeData?.photo_url || null,
          device_id: null,
          device_name: `Cihaz-${deviceId}`,
          device_location: "",
          device_ip: deviceId,
          device_serial: deviceId,
          status: accessGranted ? 'success' : 'denied',
          raw_data: JSON.stringify(simulatedResponse)
        })
        .select()
        .single();

      setResponse(simulatedResponse);
      
      if (error) {
        throw error;
      } else {
        toast({
          title: "Başarılı",
          description: `Simüle edilmiş kart okutma kaydı oluşturuldu: ${data.id}`,
        });
      }
    } catch (error) {
      console.error("Simulation error:", error);
      setResponse(error);
      toast({
        title: "Hata",
        description: `Simülasyon hatası: ${(error as Error).message || "Bilinmeyen hata"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Kart Okuyucu Test Aracı</h2>
      
      <form onSubmit={handleDirectDeviceRequest} className="space-y-4">
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
        
        <div className="grid gap-2">
          <Label htmlFor="deviceUrl">Cihaz URL:</Label>
          <Input
            id="deviceUrl"
            value={deviceUrl}
            onChange={(e) => setDeviceUrl(e.target.value)}
            placeholder="Cihaz API URL'sini giriniz"
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Cihaza İstek Gönder
          </Button>
          
          <Button type="button" variant="outline" onClick={handleSimulateCardReading} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Simülasyon Yap
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
          <p><strong>Endpoint URL:</strong> {deviceUrl}</p>
          <p><strong>Header:</strong> x-api-key: DEVICE_API_KEY</p>
          <p><strong>Method:</strong> POST</p>
          <p><strong>Body Format:</strong> &#123;"user_id,serial": "%T[DEVICE_ID],[CARD_NUMBER]"&#125;</p>
        </div>
      </div>
    </Card>
  );
};

export default CardReaderTester;

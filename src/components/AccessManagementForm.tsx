
import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

const AccessManagementForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [protocol, setProtocol] = useState("HTTP");
  const [ssl, setSsl] = useState("ON");
  const [caFile, setCaFile] = useState<File | null>(null);
  const [host, setHost] = useState("https://ngsplus.app/api/card-reader");
  const [messageFormat, setMessageFormat] = useState("JSON");
  const [requestKey, setRequestKey] = useState("user_id_serial");
  const [requestValue, setRequestValue] = useState("%T,3505234822042881");
  const [responseKey, setResponseKey] = useState("response");
  const [responseValue, setResponseValue] = useState("open_relay");
  const [confirmationKey, setConfirmationKey] = useState("confirmation");
  const [confirmationValue, setConfirmationValue] = useState("relay_opened");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCaFile(e.target.files[0]);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setLoading(true);

      // Burada konfigürasyon kaydetme işlemini yapacağız
      const config = {
        protocol,
        ssl,
        host,
        messageFormat,
        request: {
          [requestKey]: requestValue
        },
        response: {
          [responseKey]: responseValue
        },
        confirmation: {
          [confirmationKey]: confirmationValue
        }
      };

      console.log("Kaydedilen konfigürasyon:", config);

      toast({
        title: "Konfigürasyon kaydedildi",
        description: "Cihaz ayarları başarıyla kaydedildi.",
        variant: "default"
      });

    } catch (error) {
      console.error("Konfigürasyon kaydetme hatası:", error);
      toast({
        title: "Hata",
        description: "Konfigürasyon kaydedilirken bir hata oluştu.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="bg-black text-white p-4 text-center text-2xl font-bold rounded-t-md -mt-6 -mx-6 mb-6">
        Access Management
      </div>

      <div className="grid gap-6">
        {/* Protocol */}
        <div className="grid grid-cols-3 items-center border-b pb-4">
          <Label htmlFor="protocol" className="text-lg">Protocol:</Label>
          <div className="col-span-2">
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger>
                <SelectValue placeholder="HTTP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HTTP">HTTP</SelectItem>
                <SelectItem value="HTTPS">HTTPS</SelectItem>
                <SelectItem value="TCP">TCP</SelectItem>
                <SelectItem value="UDP">UDP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* SSL */}
        <div className="grid grid-cols-3 items-center border-b pb-4">
          <Label htmlFor="ssl" className="text-lg">SSL:</Label>
          <div className="col-span-2">
            <Select value={ssl} onValueChange={setSsl}>
              <SelectTrigger>
                <SelectValue placeholder="ON" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ON">ON</SelectItem>
                <SelectItem value="OFF">OFF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* CA File */}
        <div className="grid grid-cols-3 items-center border-b pb-4">
          <Label htmlFor="caFile" className="text-lg">CA File:</Label>
          <div className="col-span-1">
            <Input
              type="file"
              id="caFile"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('caFile')?.click()}
              className="w-full"
            >
              Dosya Seç
            </Button>
          </div>
          <div className="col-span-1 px-2">
            {caFile ? caFile.name : "Dosya seçilmedi"}
          </div>
          <div className="ml-auto">
            <Button className="bg-black hover:bg-gray-800">
              <Upload className="mr-1 h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        {/* Host */}
        <div className="grid grid-cols-3 items-center border-b pb-4">
          <Label htmlFor="host" className="text-lg">Host:</Label>
          <div className="col-span-2">
            <Input
              id="host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="https://ngsplus.app/api/card-reader"
            />
          </div>
        </div>

        {/* Message Format */}
        <div className="grid grid-cols-3 items-center border-b pb-4">
          <Label htmlFor="messageFormat" className="text-lg">Message Format:</Label>
          <div className="col-span-2">
            <Select value={messageFormat} onValueChange={setMessageFormat}>
              <SelectTrigger>
                <SelectValue placeholder="JSON" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JSON">JSON</SelectItem>
                <SelectItem value="XML">XML</SelectItem>
                <SelectItem value="TEXT">TEXT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Request Body */}
        <div className="grid grid-cols-3 items-center border-b pb-4">
          <Label className="text-lg">Request Body:</Label>
          <div className="col-span-2 flex items-center">
            {"{"}"
            <Input
              value={requestKey}
              onChange={(e) => setRequestKey(e.target.value)}
              className="mx-1 w-56"
            />
            " : "
            <Input
              value={requestValue}
              onChange={(e) => setRequestValue(e.target.value)}
              className="mx-1 w-56"
            />
            {"}"}
          </div>
        </div>

        {/* Good Response */}
        <div className="grid grid-cols-3 items-center border-b pb-4">
          <Label className="text-lg">Good Response:</Label>
          <div className="col-span-2 flex items-center">
            {"{"}"
            <Input
              value={responseKey}
              onChange={(e) => setResponseKey(e.target.value)}
              className="mx-1 w-56"
            />
            " : "
            <Input
              value={responseValue}
              onChange={(e) => setResponseValue(e.target.value)}
              className="mx-1 w-56"
            />
            {"}"}
          </div>
        </div>

        {/* Relay Open Confirmation */}
        <div className="grid grid-cols-3 items-center border-b pb-4">
          <Label className="text-lg">Relay Open Confirmation:</Label>
          <div className="col-span-2 flex items-center">
            {"{"}"
            <Input
              value={confirmationKey}
              onChange={(e) => setConfirmationKey(e.target.value)}
              className="mx-1 w-56"
            />
            " : "
            <Input
              value={confirmationValue}
              onChange={(e) => setConfirmationValue(e.target.value)}
              className="mx-1 w-56"
            />
            {"}"}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8">
        <Button
          onClick={handleSaveConfig}
          disabled={loading}
          className="w-full bg-black hover:bg-gray-800 text-lg py-6"
        >
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </Card>
  );
};

export default AccessManagementForm;

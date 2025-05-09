
import React from 'react';
import QRCode from 'qrcode.react';
import { Card, CardContent } from "@/components/ui/card";
import { toast } from '@/components/ui/sonner';

interface VirtualReaderProps {
  id: string;
  label?: string;
  size?: number;
  deviceSerial?: string;
}

const VirtualReader = ({ 
  id, 
  label, 
  size = 128, 
  deviceSerial = 'VQR-001' 
}: VirtualReaderProps) => {
  const handleClick = async () => {
    try {
      const response = await fetch('/api/check-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          readerId: id,
          deviceSerial: deviceSerial 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check access');
      }

      const data = await response.json();
      toast(data.hasAccess ? "Giriş İzni Var" : "Giriş İzni Yok", {
        description: `Okuyucu ${label || id} - ${new Date().toLocaleTimeString()}`,
      });
    } catch (error) {
      console.error('Erişim kontrolünde hata:', error);
      toast("Hata", {
        description: "Erişim kontrolü başarısız",
      });
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer bg-white dark:bg-gray-800 border-burgundy/20">
      <CardContent 
        className="flex flex-col items-center justify-center p-6 space-y-4"
        onClick={handleClick}
      >
        <div className="bg-white p-2 rounded-lg shadow-sm">
          <QRCode
            value={id}
            size={size}
            level="H"
            className="rounded"
          />
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label || id}
        </span>
      </CardContent>
    </Card>
  );
};

export default VirtualReader;

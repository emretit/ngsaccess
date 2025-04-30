
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrData: { serial: string; name: string } | null;
  onDownload: () => void;
}

export function QRCodeDialog({
  open,
  onOpenChange,
  qrData,
  onDownload
}: QRCodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col items-center">
        <DialogHeader>
          <DialogTitle className="text-center">
            {qrData?.name} QR Kodu
          </DialogTitle>
        </DialogHeader>
        {qrData && (
          <div className="space-y-4">
            <QRCode
              id="qr-large"
              value={qrData.serial}
              size={256}
              level="H"
              className="rounded"
            />
            <Button 
              className="w-full" 
              onClick={onDownload}
            >
              <Download className="mr-2" />
              QR Kodunu İndir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

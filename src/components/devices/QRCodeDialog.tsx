
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG as QRCode } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
            Kimlik QR kodu — {qrData?.name}
          </DialogTitle>
        </DialogHeader>
        {qrData && (
          <div className="space-y-4">
            <DialogDescription>Cihaz kimlik etiketi. Bu QR kod geçiş yetkisi sağlamaz.</DialogDescription>
            <QRCode
              id="qr-large"
              role="img"
              aria-label={`${qrData.name} kimlik QR kodu`}
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
              QR Kodunu İndir (SVG)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

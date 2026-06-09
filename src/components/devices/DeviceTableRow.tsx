import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Device } from "@/types/device";
import { Edit2, Trash2, MapPin, QrCode, Undo2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Id } from "../../../convex/_generated/dataModel";

interface DeviceTableRowProps {
  device: Device;
  rowIndex?: number;
  zoneName?: string;
  doorName?: string;
  /** Admin görünümü: cihazın bağlı olduğu proje kolonunu göster. */
  showProject?: boolean;
  projectName?: string;
  /** Admin görünümü: bölge/kapı/erişim yönü kolonlarını ve "Konum Ata" aksiyonunu gizler. */
  hideLocation?: boolean;
  onDeleteDevice: (deviceId: string) => void;
  onAssignLocation?: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onQRClick?: (device: Device) => void;
  /** Verilirse "Havuza geri al" aksiyonu gösterilir (cihazı projeden çıkarır). */
  onReleaseDevice?: (device: Device) => void;
  selected: boolean;
  onSelect: (checked: boolean, deviceId: Id<"devices">) => void;
}

export function DeviceTableRow({
  device,
  rowIndex,
  zoneName,
  doorName,
  showProject,
  projectName,
  hideLocation,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  onQRClick,
  onReleaseDevice,
  selected,
  onSelect
}: DeviceTableRowProps) {
  const getStatusBadge = (status: 'online' | 'offline' | 'expired') => {
    switch (status) {
      case 'online':
        return <Badge variant="success">Çevrimiçi</Badge>;
      case 'offline':
        return <Badge variant="secondary">Çevrimdışı</Badge>;
      case 'expired':
        return <Badge variant="destructive">Süresi Dolmuş</Badge>;
      default:
        return <Badge variant="secondary">Bilinmiyor</Badge>;
    }
  };

  const getAccessDirectionText = (direction?: string) => {
    switch (direction) {
      case 'entry':
        return 'Giriş';
      case 'exit':
        return 'Çıkış';
      case 'both':
        return 'Giriş/Çıkış';
      default:
        return '-';
    }
  };

  const deviceId = String(device._id ?? "");

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) return;
        onEditDevice(device);
      }}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(checked as boolean, device._id)}
        />
      </TableCell>
      <TableCell className="font-medium text-muted-foreground">{rowIndex ?? '-'}</TableCell>
      {showProject && (
        <TableCell>
          {projectName ? <Badge variant="secondary">{projectName}</Badge> : <span className="text-muted-foreground">—</span>}
        </TableCell>
      )}
      <TableCell className="font-medium">{device.name || "—"}</TableCell>
      <TableCell>
        {device.brand === "ide_smart"
          ? device.ideUuid || "-"
          : device.deviceSerial || "-"}
      </TableCell>
      <TableCell>{device.deviceType || '-'}</TableCell>
      {!hideLocation && (
        <>
          <TableCell>{zoneName || '-'}</TableCell>
          <TableCell>{doorName || '-'}</TableCell>
          <TableCell>{getAccessDirectionText(device.accessDirection)}</TableCell>
        </>
      )}
      <TableCell>{getStatusBadge(device.status as 'online' | 'offline' | 'expired')}</TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {onQRClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onQRClick(device)}
              className="h-8 w-8"
              title="QR Kod"
            >
              <QrCode className="h-4 w-4" />
            </Button>
          )}
          {!hideLocation && onAssignLocation && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAssignLocation(device)}
              className="h-8 w-8"
              title="Konum Ata"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEditDevice(device)}
            className="h-8 w-8"
            title="Düzenle"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          {onReleaseDevice && device.brand === "ide_smart" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8"
                  title="Havuza geri al"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Havuza geri al</AlertDialogTitle>
                  <AlertDialogDescription>
                    {device.name ? `"${device.name}" cihazını` : "Bu cihazı"} projeden çıkarıp havuza
                    geri almak istediğinize emin misiniz? Cihazın kapıları ve okuma geçmişi silinir;
                    cihaz havuzda kalır ve başka projeye atanabilir.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>İptal</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onReleaseDevice(device)}>Havuza al</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 text-destructive hover:text-destructive"
                title="Sil"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cihazı Sil</AlertDialogTitle>
                <AlertDialogDescription>
                  {device.name ? `"${device.name}" cihazını` : "Bu cihazı"} silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDeleteDevice(deviceId)}>Sil</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

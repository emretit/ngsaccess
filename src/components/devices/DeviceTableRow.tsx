import { deviceDisplayName, deviceModel } from "@/lib/deviceDisplay";
import { useState } from "react";
import { DeviceDeleteDialog } from "./DeviceDeleteDialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Device } from "@/types/device";
import { Edit2, Trash2, MapPin, QrCode, Undo2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Id } from "../../../convex/_generated/dataModel";

interface DeviceTableRowProps {
  device: Device;
  rowIndex?: number;
  zoneName?: string;
  /** Admin görünümü: cihazın bağlı olduğu proje kolonunu göster. */
  showProject?: boolean;
  projectName?: string;
  /** Admin görünümü: bölge kolonunu ve "Konum Ata" aksiyonunu gizler. */
  hideLocation?: boolean;
  onDeleteDevice: (deviceId: string) => Promise<void> | void;
  onAssignLocation?: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onQRClick?: (device: Device) => void;
  /** Verilirse "Havuza geri al" aksiyonu gösterilir (cihazı projeden çıkarır). */
  onReleaseDevice?: (device: Device) => Promise<void> | void;
  selected: boolean;
  onSelect: (checked: boolean, deviceId: Id<"devices">) => void;
}

export function DeviceTableRow({
  device,
  rowIndex,
  zoneName,
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const getStatusBadge = () => <StatusBadge tone={device.connectionStatus === "online" ? "success" : "neutral"}>{device.connectionStatus === "online" ? "Çevrimiçi" : device.connectionStatus === "never" ? "Henüz bağlanmadı" : "Çevrimdışı"}</StatusBadge>;

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
          aria-label={`${deviceDisplayName(device)} cihazını seç`}
          checked={selected}
          onCheckedChange={(checked) => onSelect(checked === true, device._id)}
        />
      </TableCell>
      <TableCell className="font-medium text-muted-foreground">{rowIndex ?? '-'}</TableCell>
      {showProject && (
        <TableCell>
          {projectName ? <Badge variant="secondary">{projectName}</Badge> : <span className="text-muted-foreground">—</span>}
        </TableCell>
      )}
      <TableCell className="font-medium"><button type="button" onClick={() => onEditDevice(device)} className="text-left rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{deviceDisplayName(device)}</button></TableCell>
      <TableCell>
        {device.brand === "ide_smart"
          ? device.ideUuid || "-"
          : device.deviceSerial || "-"}
      </TableCell>
      <TableCell><span>{deviceModel(device)}</span>{device.deviceType && <span className="block text-xs text-muted-foreground">{device.deviceType}</span>}</TableCell>
      {!hideLocation && (
        <>
          <TableCell>{zoneName || '-'}</TableCell>
        </>
      )}
      <TableCell>{getStatusBadge()}</TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {onQRClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onQRClick(device)}
              className="h-8 w-8"
              disabled={!(device.deviceSerial?.trim() || device.ideUuid?.trim())}
              aria-label="Cihaz kimlik QR kodunu göster"
              title="Cihaz kimlik etiketi — geçiş yetkisi sağlamaz"
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
              aria-label={`${deviceDisplayName(device)} cihazına konum ata`}
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
            aria-label={`${deviceDisplayName(device)} cihazını düzenle`}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          {onReleaseDevice && device.brand === "ide_smart" && (
            <>
              <Button variant="ghost" size="icon" aria-label="Havuza geri al" onClick={() => setReleaseOpen(true)}><Undo2 className="h-4 w-4" /></Button>
              <ConfirmDestructive open={releaseOpen} onOpenChange={setReleaseOpen} title="Havuza geri al" objectName={device.name}
                effects={["Cihazın kapıları, okuyucuları ve erişim bağlantıları silinir.", "Kart okuma geçmişi korunur; cihaz başka projeye atanabilir."]}
                confirmLabel="Havuza al" onConfirm={async () => { await onReleaseDevice(device); }} />
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => { event.stopPropagation(); setDeleteDialogOpen(true); }}
            className="h-8 w-8 text-destructive hover:text-destructive"
            title="Sil"
            aria-label={`${deviceDisplayName(device)} cihazını sil`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <DeviceDeleteDialog
            isOpen={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            selectedCount={1}
            deviceName={device.name ?? device.deviceSerial ?? "Bu cihaz"}
            onConfirm={() => onDeleteDevice(deviceId)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

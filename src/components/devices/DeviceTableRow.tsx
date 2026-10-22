import { deviceConnectionBadge } from "./hooks/deviceConnectionBadge";
import { deviceDisplayName } from "@/lib/deviceDisplay";
import { deviceBrandLabel } from "@/lib/deviceBrand";
import { formatTrDateTime } from "@/lib/date";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useState } from "react";
import { DeviceDeleteDialog } from "./DeviceDeleteDialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/shared/RowActions";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  hideZoneColumn?: boolean;
  canManage?: boolean;
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
  zoneName,
  showProject,
  projectName,
  hideLocation,
  hideZoneColumn,
  canManage = false,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  onQRClick,
  onReleaseDevice,
  selected,
  onSelect,
}: DeviceTableRowProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const getStatusBadge = () => (
    <StatusBadge
      className="max-w-full gap-1 px-1.5 whitespace-normal text-left md:whitespace-nowrap"
      tone={deviceConnectionBadge(device.connectionStatus).tone}
    >
      {deviceConnectionBadge(device.connectionStatus).label}
    </StatusBadge>
  );

  const lastSeenValue =
    device.brand === "hikvision" && device.hikTransport !== "localBridge"
      ? (device.hikLastSeenAt ?? device.lastSeen)
      : device.lastSeen;
  const lastSeen = lastSeenValue === undefined ? null : new Date(lastSeenValue);
  const validLastSeen =
    lastSeen && !Number.isNaN(lastSeen.getTime()) ? lastSeen : null;
  const brandModel = [deviceBrandLabel(device.brand), device.hikModel?.trim()]
    .filter(Boolean)
    .join(" · ");
  const serial =
    device.brand === "ide_smart" ? device.ideUuid : device.deviceSerial;
  const deviceId = String(device._id ?? "");

  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell
        className="px-2 py-0 md:px-3"
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) onSelect(!selected, device._id);
        }}
      >
        <Checkbox
          aria-label={`${deviceDisplayName(device)} cihazını seç`}
          checked={selected}
          onCheckedChange={(checked) => onSelect(checked === true, device._id)}
        />
      </TableCell>
      {showProject && (
        <TableCell className="hidden lg:table-cell">
          {projectName ? (
            <Badge variant="secondary">{projectName}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      <TableCell className="min-w-0 overflow-hidden whitespace-normal break-words px-2 md:px-4 font-medium">
        {canManage ? (
          <button
            type="button"
            onClick={() => onEditDevice(device)}
            title={deviceDisplayName(device)}
            className="min-h-11 md:min-h-0 max-w-full break-words text-left md:block md:truncate md:whitespace-nowrap rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {deviceDisplayName(device)}
          </button>
        ) : (
          <span>{deviceDisplayName(device)}</span>
        )}
        <span className="block text-xs font-normal text-muted-foreground md:hidden">
          {hideLocation ? "" : `${zoneName || "Bölge seçilmedi"} · `}
          {serial ? `…${serial.slice(-6)}` : "Seri no yok"}
        </span>
      </TableCell>
      <TableCell
        title={brandModel}
        className="hidden md:table-cell truncate whitespace-nowrap"
      >
        <span>{brandModel}</span>
      </TableCell>
      <TableCell
        title={device.ideUuid || device.deviceSerial}
        className="hidden xl:table-cell tabular-nums truncate whitespace-nowrap"
      >
        {device.brand === "ide_smart"
          ? device.ideUuid || "—"
          : device.deviceSerial || "—"}
      </TableCell>
      {!(hideLocation || hideZoneColumn) && (
        <TableCell
          title={zoneName}
          className="hidden lg:table-cell truncate whitespace-nowrap"
        >
          {zoneName || "—"}
        </TableCell>
      )}
      <TableCell className="px-1 whitespace-normal [&_span]:whitespace-normal">
        {getStatusBadge()}
        {validLastSeen && device.connectionStatus !== "never" && (
          <span
            className="block text-xs text-muted-foreground"
            title={formatTrDateTime(validLastSeen)}
          >
            ·{" "}
            {formatDistanceToNow(validLastSeen, {
              addSuffix: true,
              locale: tr,
            })}
          </span>
        )}
      </TableCell>
      <TableCell
        className="px-0 py-0 text-right [&_button]:min-h-11 [&_button]:min-w-11 md:[&_button]:min-h-0 md:[&_button]:min-w-0 md:px-1"
        onClick={(e) => e.stopPropagation()}
      >
        <RowActions label={`${deviceDisplayName(device)} işlemleri`}>
          <DropdownMenuItem onSelect={() => onEditDevice(device)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Ayrıntıyı görüntüle
          </DropdownMenuItem>
          {onQRClick && (
            <DropdownMenuItem
              disabled={
                !(device.deviceSerial?.trim() || device.ideUuid?.trim())
              }
              onSelect={() => onQRClick(device)}
            >
              <QrCode className="mr-2 h-4 w-4" />
              Kimlik QR kodu
            </DropdownMenuItem>
          )}
          {canManage && !hideLocation && onAssignLocation && (
            <DropdownMenuItem onSelect={() => onAssignLocation(device)}>
              <MapPin className="mr-2 h-4 w-4" />
              Konum ata
            </DropdownMenuItem>
          )}
          {canManage && onReleaseDevice && device.brand === "ide_smart" && (
            <DropdownMenuItem onSelect={() => setReleaseOpen(true)}>
              <Undo2 className="mr-2 h-4 w-4" />
              Havuza geri al
            </DropdownMenuItem>
          )}
          {canManage && <DropdownMenuSeparator />}
          {canManage && (
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Cihazı sil
            </DropdownMenuItem>
          )}
        </RowActions>
        {canManage && onReleaseDevice && (
          <ConfirmDestructive
            open={releaseOpen}
            onOpenChange={setReleaseOpen}
            title="Havuza geri al"
            objectName={device.name}
            effects={[
              "Cihazın kapıları, okuyucuları ve erişim bağlantıları silinir.",
              "Kart okuma geçmişi korunur; cihaz başka projeye atanabilir.",
            ]}
            confirmLabel="Havuza al"
            onConfirm={async () => {
              await onReleaseDevice(device);
            }}
          />
        )}
        <DeviceDeleteDialog
          isOpen={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          selectedCount={1}
          deviceName={device.name ?? device.deviceSerial ?? "Bu cihaz"}
          onConfirm={() => onDeleteDevice(deviceId)}
        />
      </TableCell>
    </TableRow>
  );
}

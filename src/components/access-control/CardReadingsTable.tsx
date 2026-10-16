import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
type CardReading = FunctionReturnType<typeof api.cardReadings.list>["page"][number];
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

const trTime = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
import { Button } from "@/components/ui/button";

interface CardReadingsTableProps {
  readings: CardReading[];
  emptyMessage?: string;
  showClearFilters?: boolean;
  onClearFilters?: () => void;
}

export const CardReadingsTable = ({
  readings,
  emptyMessage = "Görüntülenecek kart okutma kaydı bulunamadı.",
  showClearFilters = false,
  onClearFilters,
}: CardReadingsTableProps) => {
  const getStatusBadge = (reading: CardReading) => (
    <StatusBadge tone={reading.accessStatus === "izin_verildi" ? "success" : reading.accessStatus === "reddedildi" ? "danger" : "neutral"}>
      {reading.accessStatus === "izin_verildi" ? "İzin Verildi" : reading.accessStatus === "reddedildi" ? "Reddedildi" : "Bilinmiyor"}
    </StatusBadge>
  );
  const getDirectionBadge = (reading: CardReading) => (
    <StatusBadge tone="neutral">{reading.direction === "entry" ? "Giriş" : reading.direction === "exit" ? "Çıkış" : "Bilinmiyor"}</StatusBadge>
  );

  // Helper function to get device display name
  const getDeviceDisplay = (reading: CardReading) => {
    // First try to get device name from devices relation
    if (reading.devices?.name) {
      return reading.devices.name;
    }
    // If no device name, try serial number
    if (reading.devices?.deviceSerial) {
      return reading.devices.deviceSerial;
    }
    // Fallback to default
    return reading.deviceId && !reading.devices ? "Silinmiş cihaz" : "Bilinmeyen Cihaz";
  };

  // Okuyucu/kapı: IDE Smart okumalarda hangi WIEGAND/io okudu (ideIoId → doors).
  // Kapı tanımlıysa adını, değilse ham io index'ini, IDE dışı okumada "-" göster.
  const getReaderDisplay = (reading: CardReading) => {
    if (reading.door?.readerName) {
      return reading.door.readerName;
    }
    if (reading.door?.name) {
      return reading.door.name;
    }
    if (reading.ideIoId !== undefined) {
      return `IO ${reading.ideIoId}`;
    }
    return "-";
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Çalışan</TableHead>
            <TableHead>Kart No</TableHead>
            <TableHead>Zaman (TR saati)</TableHead>
            <TableHead>Departman</TableHead>
            <TableHead>Cihaz</TableHead>
            <TableHead>Okuyucu / Kapı</TableHead>
            <TableHead>Yön</TableHead>
            <TableHead>Durum</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {readings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <EmptyState title={emptyMessage} />
                  {showClearFilters && onClearFilters && (
                    <Button variant="ghost" size="sm" onClick={onClearFilters}>
                      Filtreleri Temizle
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            readings.map((reading) => (
              <TableRow key={reading._id}>
                <TableCell>{reading.employeeName || "Bilinmeyen"}</TableCell>
                <TableCell>{reading.cardNo}</TableCell>
                <TableCell>
                  {Number.isFinite(Date.parse(reading.accessTime)) ? trTime.format(new Date(reading.accessTime)) : "Bilinmiyor"}
                </TableCell>
                <TableCell>{reading.employees?.departments?.name || "-"}</TableCell>
                <TableCell>{getDeviceDisplay(reading)}</TableCell>
                <TableCell>{getReaderDisplay(reading)}</TableCell>
                <TableCell>{getDirectionBadge(reading)}</TableCell>
                <TableCell>{getStatusBadge(reading)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

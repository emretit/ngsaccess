import { CardReading } from "@/types/access-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
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
  // Helper function to get status badge - using accessStatus
  const getStatusBadge = (reading: CardReading) => {
    if (reading.accessStatus === "izin_verildi") {
      return <Badge variant="success">İzin Verildi</Badge>;
    } else {
      return <Badge variant="destructive">Reddedildi</Badge>;
    }
  };

  // Yön badge'i: alan yoksa default "Giriş" göster (eski kayıtlar için).
  const getDirectionBadge = (reading: CardReading) => {
    if (reading.direction === "exit") {
      return <Badge variant="destructive">Çıkış</Badge>;
    }
    return <Badge variant="success">Giriş</Badge>;
  };

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
    return "Bilinmeyen Cihaz";
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
            <TableHead>Zaman</TableHead>
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
                  <p>{emptyMessage}</p>
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
                  {format(new Date(reading.accessTime), "dd.MM.yyyy HH:mm:ss", { locale: tr })}
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

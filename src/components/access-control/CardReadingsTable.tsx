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
  // Helper function to get status badge - using access_granted
  const getStatusBadge = (reading: CardReading) => {
    if (reading.access_granted) {
      return <Badge variant="success">İzin Verildi</Badge>;
    } else {
      return <Badge variant="destructive">Reddedildi</Badge>;
    }
  };

  // Helper function to get device display name
  const getDeviceDisplay = (reading: CardReading) => {
    // First try to get device name from devices relation
    if (reading.devices?.name) {
      return reading.devices.name;
    }
    // If no device name, try serial number
    if (reading.devices?.device_serial) {
      return reading.devices.device_serial;
    }
    // Fallback to default
    return "Bilinmeyen Cihaz";
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
            <TableHead>Durum</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {readings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
              <TableRow key={reading.id}>
                <TableCell>{reading.employee_name || "Bilinmeyen"}</TableCell>
                <TableCell>{reading.card_no}</TableCell>
                <TableCell>
                  {format(new Date(reading.access_time), "dd.MM.yyyy HH:mm:ss", { locale: tr })}
                </TableCell>
                <TableCell>{reading.employees?.departments?.name || "-"}</TableCell>
                <TableCell>{getDeviceDisplay(reading)}</TableCell>
                <TableCell>{getStatusBadge(reading)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

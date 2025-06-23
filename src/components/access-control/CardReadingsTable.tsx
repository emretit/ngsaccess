
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

interface CardReadingsTableProps {
  readings: CardReading[];
}

export const CardReadingsTable = ({ readings }: CardReadingsTableProps) => {
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
          {readings.map((reading) => (
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

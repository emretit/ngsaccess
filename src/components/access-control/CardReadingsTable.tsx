
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
  // Helper function to get status badge with combined status & access
  const getStatusBadge = (reading: CardReading) => {
    if (reading.status === 'success' || reading.access_granted) {
      return <Badge variant="success">İzin Verildi</Badge>;
    } else {
      return <Badge variant="destructive">Reddedildi</Badge>;
    }
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
            <TableHead>Konum</TableHead>
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
              <TableCell>{reading.device_name || "Bilinmeyen Cihaz"}</TableCell>
              <TableCell>{reading.device_location || "-"}</TableCell>
              <TableCell>{getStatusBadge(reading)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

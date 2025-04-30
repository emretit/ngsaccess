
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageData } from "./types";

interface PDKSReportTableProps {
  data: MessageData[];
}

export function PDKSReportTable({ data }: PDKSReportTableProps) {
  if (!data || data.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">Veri bulunamadı</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad Soyad</TableHead>
          <TableHead>Giriş Saati</TableHead>
          <TableHead>Departman</TableHead>
          <TableHead>Cihaz</TableHead>
          <TableHead>Konum</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, index) => (
          <TableRow key={index}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>{row.check_in}</TableCell>
            <TableCell>{row.department}</TableCell>
            <TableCell>{row.device || '-'}</TableCell>
            <TableCell>{row.location || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

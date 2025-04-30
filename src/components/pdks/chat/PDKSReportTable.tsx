
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageData } from "./types";

interface PDKSReportTableProps {
  data: MessageData[];
}

export function PDKSReportTable({ data }: PDKSReportTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Çalışan</TableHead>
          <TableHead>Departman</TableHead>
          <TableHead>Giriş Saati</TableHead>
          <TableHead>Cihaz</TableHead>
          <TableHead>Konum</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={`${item.name}-${index}`}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>{item.department}</TableCell>
            <TableCell>{item.check_in}</TableCell>
            <TableCell>{item.device}</TableCell>
            <TableCell>{item.location}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

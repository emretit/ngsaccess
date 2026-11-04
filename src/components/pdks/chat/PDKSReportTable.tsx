
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageData } from "./types";

interface PDKSReportTableProps {
  data: MessageData[];
}

export function PDKSReportTable({ data }: PDKSReportTableProps) {
  return (
    <Table resizeKey="pdks-chat-report">
      <TableHeader>
        <TableRow>
          <TableHead columnId="name" className="w-[200px]">Çalışan</TableHead>
          <TableHead columnId="department">Departman</TableHead>
          <TableHead columnId="check-in">Giriş Saati</TableHead>
          <TableHead columnId="device">Cihaz</TableHead>
          <TableHead columnId="location">Konum</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={`${item.name}-${index}`}>
            <TableCell className="truncate font-medium" title={item.name}>{item.name}</TableCell>
            <TableCell className="truncate" title={item.department}>{item.department}</TableCell>
            <TableCell className="truncate" title={item.check_in}>{item.check_in}</TableCell>
            <TableCell className="truncate" title={item.device}>{item.device}</TableCell>
            <TableCell className="truncate" title={item.location}>{item.location}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

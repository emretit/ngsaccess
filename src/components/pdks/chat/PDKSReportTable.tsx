
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MessageData {
  name: string;
  check_in: string;
  check_out: string | null;
  department: string;
}

interface PDKSReportTableProps {
  data: MessageData[];
}

export function PDKSReportTable({ data }: PDKSReportTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full bg-white border border-gray-300">
        <TableHeader>
          <TableRow>
            <TableHead>İsim</TableHead>
            <TableHead>Giriş Saati</TableHead>
            <TableHead>Çıkış Saati</TableHead>
            <TableHead>Departman</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record, index) => (
            <TableRow key={index}>
              <TableCell>{record.name}</TableCell>
              <TableCell>{new Date(record.check_in).toLocaleString()}</TableCell>
              <TableCell>
                {record.check_out ? new Date(record.check_out).toLocaleString() : '-'}
              </TableCell>
              <TableCell>{record.department}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

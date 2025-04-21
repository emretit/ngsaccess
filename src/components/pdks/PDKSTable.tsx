
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PDKSRecord {
  id: number;
  employee_first_name: string;
  employee_last_name: string;
  date: string;
  entry_time: string;
  exit_time: string;
  status: string;
}

interface PDKSTableProps {
  records: PDKSRecord[];
  loading: boolean;
  searchTerm: string;
  statusFilter: string;
}

export function PDKSTable({
  records,
  loading,
  searchTerm,
  statusFilter,
}: PDKSTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce animation-delay-200"></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce animation-delay-400"></div>
        </div>
      </div>
    );
  }
  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {searchTerm || statusFilter !== "all"
          ? "Arama kriterlerine uygun kayıt bulunamadı"
          : "Henüz kayıt bulunmuyor"}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="font-semibold">Ad Soyad</TableHead>
            <TableHead className="font-semibold">Tarih</TableHead>
            <TableHead className="font-semibold">Giriş Saati</TableHead>
            <TableHead className="font-semibold">Çıkış Saati</TableHead>
            <TableHead className="font-semibold">Durum</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-medium">
                {record.employee_first_name} {record.employee_last_name}
              </TableCell>
              <TableCell>{new Date(record.date).toLocaleDateString('tr-TR')}</TableCell>
              <TableCell>{record.entry_time}</TableCell>
              <TableCell>{record.exit_time}</TableCell>
              <TableCell>
                <span className={`pill-badge ${
                  record.status === 'present'
                    ? 'bg-green-100 text-green-800'
                    : record.status === 'late'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }`}>
                  {record.status === 'present' ? 'Mevcut'
                    : record.status === 'late' ? 'Geç'
                    : 'Yok'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

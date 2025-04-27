
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface MessageData {
  name: string;
  check_in: string;
  check_out: string | null;
  department: string;
  device?: string;
  location?: string;
}

interface PDKSReportTableProps {
  data: MessageData[];
}

export function PDKSReportTable({ data }: PDKSReportTableProps) {
  // Format date for display
  const formatDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr || dateTimeStr === '-') return '-';
    
    try {
      // If it already looks like a formatted string, return as is
      if (dateTimeStr.includes('/') && dateTimeStr.includes(':')) {
        return dateTimeStr;
      }
      
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) return dateTimeStr;
      
      return date.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.log("Date formatting error:", e);
      return dateTimeStr;
    }
  };

  // Dynamically determine columns based on data
  const columns = data.length > 0 ? Object.keys(data[0] || {}).filter(key => 
    // Only show these fields in the table
    ['name', 'check_in', 'check_out', 'department', 'device', 'location'].includes(key)
  ) : [];

  // Map column keys to display names
  const columnDisplayNames: Record<string, string> = {
    name: 'İsim',
    check_in: 'Giriş Saati',
    check_out: 'Çıkış Saati',
    department: 'Departman',
    device: 'Cihaz',
    location: 'Konum'
  };

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full bg-white border border-gray-300">
        <TableHeader>
          <TableRow>
            {columns.map(column => (
              <TableHead key={column} className="font-semibold">
                {columnDisplayNames[column] || column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record, index) => (
            <TableRow key={index} className={cn(
              index % 2 === 0 ? "bg-white" : "bg-gray-50",
              "hover:bg-gray-100 transition-colors"
            )}>
              {columns.map(column => (
                <TableCell key={`${index}-${column}`}>
                  {column === 'check_in' || column === 'check_out' 
                    ? formatDateTime(record[column as keyof MessageData] as string) 
                    : record[column as keyof MessageData] || '-'}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length || 6} className="text-center py-4">
                Veri bulunamadı
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

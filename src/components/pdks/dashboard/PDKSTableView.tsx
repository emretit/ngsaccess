
import { useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EmployeeRecord {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  firstEntry: string;
  lastExit: string;
  totalHours: string;
  overtime: string;
  leaveType: string;
  status: 'present' | 'late' | 'absent' | 'leave';
  detailedLogs?: Array<{
    time: string;
    action: string;
    location: string;
  }>;
}

interface PDKSTableViewProps {
  records: EmployeeRecord[];
  loading?: boolean;
}

export function PDKSTableView({ records, loading = false }: PDKSTableViewProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      present: { variant: "default" as const, label: "Mevcut", color: "bg-green-100 text-green-800" },
      late: { variant: "secondary" as const, label: "Geç", color: "bg-yellow-100 text-yellow-800" },
      absent: { variant: "destructive" as const, label: "Yok", color: "bg-red-100 text-red-800" },
      leave: { variant: "outline" as const, label: "İzinli", color: "bg-blue-100 text-blue-800" }
    };
    
    const config = variants[status as keyof typeof variants] || variants.present;
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#711A1A]"></div>
            <span className="ml-2">Yükleniyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Çalışan Kayıtları</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                İndir
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem>PDF</DropdownMenuItem>
              <DropdownMenuItem>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Çalışan Adı</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Departman</TableHead>
                <TableHead>İlk Giriş</TableHead>
                <TableHead>Son Çıkış</TableHead>
                <TableHead>Toplam Saat</TableHead>
                <TableHead>Mesai</TableHead>
                <TableHead>İzin Türü</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <>
                  <TableRow 
                    key={record.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => toggleRowExpansion(record.id)}
                  >
                    <TableCell>
                      {expandedRows.has(record.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{record.name}</TableCell>
                    <TableCell>{record.employeeId}</TableCell>
                    <TableCell>{record.department}</TableCell>
                    <TableCell>{record.firstEntry}</TableCell>
                    <TableCell>{record.lastExit}</TableCell>
                    <TableCell>{record.totalHours}</TableCell>
                    <TableCell>{record.overtime}</TableCell>
                    <TableCell>{record.leaveType}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                  {expandedRows.has(record.id) && record.detailedLogs && (
                    <TableRow>
                      <TableCell colSpan={10} className="bg-gray-50 dark:bg-gray-800/30">
                        <div className="p-4">
                          <h4 className="font-semibold mb-3 text-sm">Günlük Detaylı Kayıtlar</h4>
                          <div className="space-y-2">
                            {record.detailedLogs.map((log, index) => (
                              <div key={index} className="flex justify-between items-center text-sm py-1 px-2 bg-white dark:bg-gray-700 rounded">
                                <span className="font-medium">{log.time}</span>
                                <span>{log.action}</span>
                                <span className="text-gray-500">{log.location}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

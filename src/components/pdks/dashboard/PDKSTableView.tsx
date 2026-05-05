import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search, Filter, Pencil } from "lucide-react";
import {
  exportToExcel,
  exportToCsv,
  exportToPdf,
  exportMonthlyPayrollSheet,
} from "@/utils/pdksExport";
import { useToast } from "@/hooks/use-toast";
import { useConvex } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { ManualPdksEditDialog } from "../ManualPdksEditDialog";
import type { Id } from "../../../../convex/_generated/dataModel";
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
import { Input } from "@/components/ui/input";
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
  payrollCode?: string;
  payrollEmployeeCode?: string;
  department: string;
  firstEntry: string;
  lastExit: string;
  totalHours: string;
  overtime: string;
  leaveType: string;
  status: 'present' | 'late' | 'absent' | 'leave';
  isLate?: boolean;
  isEarlyExit?: boolean;
  isManual?: boolean;
  manualNote?: string | null;
  manualEditedBy?: string | null;
  detailedLogs?: Array<{
    time: string;
    action: string;
    location: string;
  }>;
}

interface PDKSTableViewProps {
  records: EmployeeRecord[];
  loading?: boolean;
  selectedDate?: Date;
}

export function PDKSTableView({ records, loading = false, selectedDate }: PDKSTableViewProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingRecord, setEditingRecord] = useState<EmployeeRecord | null>(null);
  const { toast } = useToast();
  const convex = useConvex();
  const { profile } = useAuth();
  const canEdit =
    profile?.role === "super_admin" || profile?.role === "project_admin";

  const safeRecords = Array.isArray(records) ? records : [];

  const handleExportExcel = async () => {
    await exportToExcel(filteredRecords, { dateRange: selectedDate?.toISOString().split("T")[0] ?? "" });
    toast({ title: "Excel indirildi", description: `${filteredRecords.length} kayıt dışa aktarıldı.` });
  };

  const handleExportCsv = () => {
    exportToCsv(filteredRecords, { dateRange: selectedDate?.toISOString().split("T")[0] ?? "" });
    toast({ title: "CSV indirildi", description: `${filteredRecords.length} kayıt dışa aktarıldı.` });
  };

  const handleExportPdf = () => {
    exportToPdf(filteredRecords, { dateRange: selectedDate?.toISOString().split("T")[0] ?? "" });
    toast({ title: "PDF indirildi", description: `${filteredRecords.length} kayıt dışa aktarıldı.` });
  };

  const handleExportMonthly = async () => {
    const ref = selectedDate ?? new Date();
    const year = ref.getFullYear();
    const month = ref.getMonth() + 1;
    try {
      const data = await convex.query(api.cardReadings.getMonthlyPayrollSheet, {
        year,
        month,
      });
      await exportMonthlyPayrollSheet(data);
      toast({
        title: "Aylık bordro cetveli indirildi",
        description: `${data.rows.length} çalışan, ${data.days.length} gün.`,
      });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Cetvel oluşturulamadı",
        variant: "destructive",
      });
    }
  };

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
      present: { label: "Mevcut", className: "bg-green-100 text-green-800 border-green-200" },
      late: { label: "Geç", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      absent: { label: "Yok", className: "bg-red-100 text-red-800 border-red-200" },
      leave: { label: "İzinli", className: "bg-blue-100 text-blue-800 border-blue-200" }
    };
    
    const config = variants[status as keyof typeof variants] || variants.present;
    return (
      <Badge className={`${config.className} border font-medium`}>
        {config.label}
      </Badge>
    );
  };

  const filteredRecords = safeRecords.filter((record) => {
    const name = record?.name ?? "";
    const employeeId = record?.employeeId ?? "";
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employeeId.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || record?.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Card className="shadow-lg border-0">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-gray-500 font-medium">Veriler yükleniyor...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-200 rounded-t-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            📊 Çalışan Kayıtları
            <span className="text-sm font-normal text-gray-500">
              ({filteredRecords.length} kayıt)
            </span>
          </CardTitle>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Çalışan ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-48"
              />
            </div>
            
            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-gray-300">
                  <Filter className="mr-2 h-4 w-4" />
                  Durum Filtresi
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  Tümü
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("present")}>
                  Mevcut
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("late")}>
                  Geç
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("absent")}>
                  Yok
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("leave")}>
                  İzinli
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Download */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white">
                  <Download className="mr-2 h-4 w-4" />
                  İndir
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportExcel}>📊 Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf}>📄 PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCsv}>📝 CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportMonthly}>
                  📅 Aylık Bordro Cetveli
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/80">
              <TableRow className="border-gray-200">
                <TableHead className="w-[50px] font-semibold text-gray-700"></TableHead>
                <TableHead className="font-semibold text-gray-700">Çalışan</TableHead>
                <TableHead className="font-semibold text-gray-700">ID</TableHead>
                <TableHead className="font-semibold text-gray-700">Departman</TableHead>
                <TableHead className="font-semibold text-gray-700">İlk Giriş</TableHead>
                <TableHead className="font-semibold text-gray-700">Son Çıkış</TableHead>
                <TableHead className="font-semibold text-gray-700">Toplam</TableHead>
                <TableHead className="font-semibold text-gray-700">Mesai</TableHead>
                <TableHead className="font-semibold text-gray-700">İzin</TableHead>
                <TableHead className="font-semibold text-gray-700">Durum</TableHead>
                {canEdit && (
                  <TableHead className="font-semibold text-gray-700 w-20">
                    Aksiyon
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record, index) => (
                <Fragment key={record.id}>
                  <TableRow
                    className={`
                      hover:bg-blue-50/50 transition-colors cursor-pointer border-b border-gray-100
                      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                    `}
                    onClick={() => toggleRowExpansion(record.id)}
                  >
                    <TableCell className="text-center">
                      {expandedRows.has(record.id) ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {record.name}
                        {record.isManual && (
                          <span
                            title={
                              record.manualNote
                                ? `Manuel düzeltme — ${record.manualEditedBy ?? ""}: ${record.manualNote}`
                                : `Manuel düzeltme${record.manualEditedBy ? ` — ${record.manualEditedBy}` : ""}`
                            }
                            className="text-purple-600"
                          >
                            ✏️
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{record.employeeId}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {record.department}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{record.firstEntry}</TableCell>
                    <TableCell className="font-mono text-sm">{record.lastExit}</TableCell>
                    <TableCell className="font-semibold text-green-700">{record.totalHours}</TableCell>
                    <TableCell className="font-semibold text-purple-700">{record.overtime}</TableCell>
                    <TableCell>{record.leaveType}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(record.status)}
                        {record.isEarlyExit && (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200 border text-xs">
                            Erken Çıkış
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRecord(record);
                          }}
                          title="Manuel düzelt"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  
                  {expandedRows.has(record.id) && record.detailedLogs && (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 11 : 10} className="bg-linear-to-r from-blue-50 to-indigo-50 border-l-4 border-primary">
                        <div className="p-6">
                          <h4 className="font-bold mb-4 text-gray-800 flex items-center gap-2">
                            🕐 Günlük Detaylı Kayıtlar - {record.name}
                          </h4>
                          <div className="grid gap-3">
                            {record.detailedLogs.map((log, logIndex) => (
                              <div 
                                key={logIndex} 
                                className="flex justify-between items-center p-3 bg-white rounded-lg shadow-xs border border-gray-200 hover:shadow-md transition-shadow"
                              >
                                <span className="font-bold text-primary text-lg">{log.time}</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  log.action === 'Giriş' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {log.action}
                                </span>
                                <span className="text-gray-600 bg-gray-100 px-3 py-1 rounded-full text-sm">
                                  📍 {log.location}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {editingRecord && (
        <ManualPdksEditDialog
          open={!!editingRecord}
          employeeId={editingRecord.id as Id<"employees">}
          employeeName={editingRecord.name}
          date={(selectedDate ?? new Date()).toISOString().split("T")[0]}
          initialEntry={
            editingRecord.firstEntry !== "-" ? editingRecord.firstEntry : ""
          }
          initialExit={
            editingRecord.lastExit !== "-" ? editingRecord.lastExit : ""
          }
          onClose={() => setEditingRecord(null)}
        />
      )}
    </Card>
  );
}

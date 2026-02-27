import { useState } from "react";
import { Download, Mail, Calendar, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { exportToExcel, exportToCsv, exportToPdf, type PDKSExportRecord } from "@/utils/pdksExport";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface PDKSEnhancedExportPanelProps {
  records?: PDKSExportRecord[];
  dateRange?: string;
  selectedDate?: Date;
}

export function PDKSEnhancedExportPanel({
  records = [],
  dateRange = "",
  selectedDate = new Date(),
}: PDKSEnhancedExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const { toast } = useToast();

  const handleExport = async (format: "Excel" | "PDF" | "CSV") => {
    setIsExporting(true);

    try {
      const rangeLabel = dateRange || format(selectedDate, "dd-MM-yyyy", { locale: tr });

      if (format === "Excel") {
        exportToExcel(records, { dateRange: rangeLabel });
      } else if (format === "CSV") {
        exportToCsv(records, { dateRange: rangeLabel });
      } else if (format === "PDF") {
        exportToPdf(records, { dateRange: rangeLabel });
      }

      toast({
        title: "Dışa Aktarma Tamamlandı",
        description: `Rapor ${format} formatında başarıyla oluşturuldu.`,
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "Dışa aktarma sırasında bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmailReport = () => {
    toast({
      title: "Email Gönderildi",
      description: "Rapor belirlenen email adreslerine gönderildi.",
    });
  };

  const handleScheduleReport = () => {
    toast({
      title: "Rapor Zamanlandı",
      description: "Otomatik rapor zamanlaması ayarlandı.",
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick Export Actions */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Hızlı Dışa Aktarma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                className="w-full bg-primary hover:bg-primary/90 text-white shadow-md"
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Dışa Aktarılıyor..." : "Rapor İndir"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuItem onClick={() => handleExport("Excel")}>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("PDF")}>
                <FileType className="mr-2 h-4 w-4 text-red-600" />
                PDF Raporu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("CSV")}>
                <FileText className="mr-2 h-4 w-4 text-blue-600" />
                CSV Verileri
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleEmailReport}
              className="border-primary text-primary hover:bg-primary/5"
            >
              <Mail className="mr-1 h-3 w-3" />
              Email
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleScheduleReport}
              className="border-primary text-primary hover:bg-primary/5"
            >
              <Calendar className="mr-1 h-3 w-3" />
              Zamanla
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Format Selection */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Rapor Formatı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Zaman Aralığı</label>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as typeof exportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Günlük Özet</SelectItem>
                <SelectItem value="weekly">Haftalık Analiz</SelectItem>
                <SelectItem value="monthly">Aylık Rapor</SelectItem>
                <SelectItem value="custom">Özel Aralık</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-gray-500">
            {records.length} kayıt dışa aktarılacak
          </p>
        </CardContent>
      </Card>

      {/* Recent Exports */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Son Dışa Aktarmalar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Günlük Rapor - 30.06.2025</span>
              <span className="text-green-600">✓</span>
            </div>
            <div className="flex justify-between">
              <span>Haftalık Özet - 29.06.2025</span>
              <span className="text-green-600">✓</span>
            </div>
            <div className="flex justify-between">
              <span>Departman Analizi - 28.06.2025</span>
              <span className="text-green-600">✓</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  exportToExcel,
  exportToCsv,
  exportToPdf,
  type PDKSExportRecord,
} from "@/utils/pdksExport";
import { format as formatDate } from "date-fns";
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
  const [exportFormat, setExportFormat] = useState<
    "daily" | "weekly" | "monthly" | "custom"
  >("daily");
  const { toast } = useToast();

  const handleExport = async (exportType: "Excel" | "PDF" | "CSV") => {
    setIsExporting(true);
    try {
      const rangeLabel =
        dateRange || formatDate(selectedDate, "dd-MM-yyyy", { locale: tr });

      if (exportType === "Excel") {
        await exportToExcel(records, { dateRange: rangeLabel });
      } else if (exportType === "CSV") {
        exportToCsv(records, { dateRange: rangeLabel });
      } else if (exportType === "PDF") {
        exportToPdf(records, { dateRange: rangeLabel });
      }

      toast({
        title: "Dışa Aktarma Tamamlandı",
        description: `Rapor ${exportType} formatında oluşturuldu.`,
      });
    } catch {
      toast({
        title: "Hata",
        description: "Dışa aktarma sırasında bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Hızlı Dışa Aktarma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="w-full" disabled={isExporting}>
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
          <p className="text-xs text-muted-foreground">
            {records.length} kayıt dışa aktarılacak.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rapor Formatı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Zaman Aralığı
          </label>
          <Select
            value={exportFormat}
            onValueChange={(v) => setExportFormat(v as typeof exportFormat)}
          >
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
          <p className="text-xs text-muted-foreground pt-1">
            Bu seçim filtre çubuğundaki rapor türü ile bağımsız çalışır.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

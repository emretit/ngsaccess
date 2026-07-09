import { useState } from "react";
import { useConvex } from "convex/react";
import { Download, FileText, FileSpreadsheet, FileType, FileBadge } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
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
  const convex = useConvex();

  const handleSgkExport = async () => {
    setIsExporting(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      const result = await convex.query(api.sgkExport.buildAphbForMonth, {
        year,
        month,
      });
      if (!result.xml) {
        toast({
          title: "SGK XML üretilemedi",
          description: "Veri bulunamadı.",
          variant: "destructive",
        });
        return;
      }
      const blob = new Blob([result.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "SGK Aylık Bildirim",
        description: `${result.filename} indirildi.`,
      });
    } catch (e) {
      toast({
        title: "SGK XML hatası",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

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
        await exportToPdf(records, { dateRange: rangeLabel });
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
              <DropdownMenuItem onClick={handleSgkExport}>
                <FileBadge className="mr-2 h-4 w-4 text-amber-600" />
                SGK Aylık Bildirim (XML)
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

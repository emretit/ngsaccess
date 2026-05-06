import ExcelJS from "exceljs";
import { useToast } from "@/hooks/use-toast";
import { MessageData } from './types';
import { toLocalDateString } from "@/lib/date";

export function useExportUtils() {
  const { toast } = useToast();

  const formatReportData = <T extends { check_in?: string | Date | null; check_out?: string | Date | null }>(data: T[]) => {
    return data.map(record => {
      const checkInDate = record.check_in ? new Date(record.check_in) : null;
      const checkOutDate = record.check_out ? new Date(record.check_out) : null;

      return {
        ...record,
        check_in: checkInDate ? checkInDate.toLocaleString('tr-TR') : '-',
        check_out: checkOutDate ? checkOutDate.toLocaleString('tr-TR') : '-',
      };
    });
  };

  const handleExportExcel = async (messageData: MessageData[]) => {
    if (!messageData || !Array.isArray(messageData) || messageData.length === 0) {
      console.log("Export Excel error: No data to export", messageData);
      toast({
        title: "Dışa aktarılamadı",
        description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
        variant: "destructive",
      });
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("PDKS Raporu");
      const headers: (keyof MessageData)[] = ["name", "check_in", "check_out", "department", "device", "location"];
      worksheet.addRow(["Ad Soyad", "Giriş Saati", "Çıkış Saati", "Departman", "Cihaz", "Konum"]);
      messageData.forEach((row) =>
        worksheet.addRow(headers.map((h) => row[h] ?? ""))
      );
      worksheet.columns = [
        { width: 25 },
        { width: 25 },
        { width: 25 },
        { width: 20 },
        { width: 15 },
        { width: 20 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pdks_rapor_${toLocalDateString()}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Excel dosyası indirildi",
        description: "Rapor başarıyla Excel formatında dışa aktarıldı.",
      });
    } catch (error) {
      console.error("Excel export error:", error);
      toast({
        title: "Excel oluşturma hatası",
        description: "Excel dosyası oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async (messageData: MessageData[]) => {
    if (!messageData || !Array.isArray(messageData)) {
      console.log("Export PDF error: No data to export", messageData);
      toast({
        title: "Dışa aktarılamadı",
        description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare data for PDF generation
      const pdfData = {
        title: "PDKS Rapor",
        date: new Date().toLocaleDateString('tr-TR'),
        headers: ["Ad Soyad", "Giriş Saati", "Çıkış Saati", "Departman", "Cihaz", "Konum"],
        rows: messageData.map(item => [
          item.name || '-',
          item.check_in || '-',
          item.check_out || '-',
          item.department || '-',
          item.device || '-',
          item.location || '-'
        ])
      };

      // TODO: Migrate PDF generation to Convex Action
      const response = await fetch(`/api/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pdfData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`PDF generation failed: ${errorData.error || response.statusText}`);
      }

      // For direct browser rendering of PDF
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Open PDF in a new tab
      window.open(url, '_blank');
      
      toast({
        title: "PDF oluşturuldu",
        description: "Rapor PDF formatında başarıyla oluşturuldu ve yeni sekmede açıldı.",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "PDF oluşturma hatası",
        description: `PDF dosyası oluşturulurken bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
        variant: "destructive",
      });
    }
  };

  return {
    formatReportData,
    handleExportExcel,
    handleExportPDF
  };
}

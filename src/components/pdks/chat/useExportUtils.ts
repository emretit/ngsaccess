import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { MessageData } from './types';
import { toLocalDateString } from "@/lib/date";

const COL_HEADERS = ["Ad Soyad", "Giriş Saati", "Çıkış Saati", "Departman", "Cihaz", "Konum"] as const;
const COL_KEYS: (keyof MessageData)[] = ["name", "check_in", "check_out", "department", "device", "location"];

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
      worksheet.addRow([...COL_HEADERS]);
      messageData.forEach((row) =>
        worksheet.addRow(COL_KEYS.map((h) => row[h] ?? ""))
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

  const handleExportPDF = (messageData: MessageData[]) => {
    if (!messageData || !Array.isArray(messageData) || messageData.length === 0) {
      toast({
        title: "Dışa aktarılamadı",
        description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // Title
      doc.setFontSize(14);
      doc.text("PDKS Raporu", 14, 15);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleDateString('tr-TR'), 14, 21);

      // Table layout
      const colWidths = [45, 35, 35, 35, 35, 35];
      const rowH = 8;
      const startX = 14;
      let y = 28;

      // Header row
      doc.setFillColor(59, 130, 246);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      let x = startX;
      COL_HEADERS.forEach((h, i) => {
        doc.rect(x, y, colWidths[i], rowH, "F");
        doc.text(h, x + 2, y + 5.5);
        x += colWidths[i];
      });
      y += rowH;

      // Data rows
      doc.setTextColor(30, 30, 30);
      messageData.forEach((row, rowIdx) => {
        if (y > 185) {
          doc.addPage();
          y = 15;
        }
        const fill = rowIdx % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
        doc.setFillColor(fill[0], fill[1], fill[2]);
        x = startX;
        COL_KEYS.forEach((k, i) => {
          doc.rect(x, y, colWidths[i], rowH, "F");
          const cell = String(row[k] ?? "-");
          const clipped = doc.splitTextToSize(cell, colWidths[i] - 3)[0] ?? cell;
          doc.text(clipped, x + 2, y + 5.5);
          x += colWidths[i];
        });
        // row border
        doc.setDrawColor(220, 220, 220);
        doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowH, "S");
        y += rowH;
      });

      doc.save(`pdks_rapor_${toLocalDateString()}.pdf`);

      toast({
        title: "PDF indirildi",
        description: "Rapor başarıyla PDF formatında dışa aktarıldı.",
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

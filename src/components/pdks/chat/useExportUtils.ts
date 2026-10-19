import { errorMessage, notify } from "@/lib/notify";
import { MessageData } from './types';
import { toLocalDateString } from "@/lib/date";

const COL_HEADERS = ["Ad Soyad", "Giriş Saati", "Çıkış Saati", "Departman", "Cihaz", "Konum"] as const;
const COL_KEYS: (keyof MessageData)[] = ["name", "check_in", "check_out", "department", "device", "location"];

/** Converts the HSL channels stored in A2 CSS variables for jsPDF's RGB API. */
export function pdfThemeColor(channels: string): [number, number, number] {
  const [hue = 0, saturation = 0, lightness = 0] = channels.trim().split(/\s+/).map(parseFloat);
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4)];
}

/** The PDF is printed on paper: read the light theme tokens even while the app is in dark mode. */
function readPdfPalette() {
  const root = document.documentElement;
  const dark = root.classList.contains("dark");
  if (dark) root.classList.remove("dark");
  try {
    const theme = getComputedStyle(root);
    const color = (token: string) => pdfThemeColor(theme.getPropertyValue(token));
    return {
      headerFill: color("--primary"),
      headerText: color("--primary-foreground"),
      text: color("--foreground"),
      alternateFill: color("--subtle"),
      surfaceFill: color("--surface"),
      border: color("--line"),
    };
  } finally {
    if (dark) root.classList.add("dark");
  }
}

export function useExportUtils() {
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
      notify.error("Dışa aktarılamadı", "Bu mesaj dışa aktarılabilir bir rapor içermiyor.");
      return;
    }

    try {
      const { default: ExcelJS } = await import("exceljs");
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

      notify.success("Excel dosyası indirildi", "Rapor başarıyla Excel formatında dışa aktarıldı.");
    } catch (error) {
      console.error("Excel export error:", error);
      notify.error("Excel oluşturma hatası", "Excel dosyası oluşturulurken bir hata oluştu.");
    }
  };

  const handleExportPDF = async (messageData: MessageData[]) => {
    if (!messageData || !Array.isArray(messageData) || messageData.length === 0) {
      notify.error("Dışa aktarılamadı", "Bu mesaj dışa aktarılabilir bir rapor içermiyor.");
      return;
    }

    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const { headerFill, headerText, text, alternateFill, surfaceFill, border } = readPdfPalette();

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
      doc.setFillColor(...headerFill);
      doc.setTextColor(...headerText);
      doc.setFontSize(8);
      let x = startX;
      COL_HEADERS.forEach((h, i) => {
        doc.rect(x, y, colWidths[i], rowH, "F");
        doc.text(h, x + 2, y + 5.5);
        x += colWidths[i];
      });
      y += rowH;

      // Data rows
      doc.setTextColor(...text);
      messageData.forEach((row, rowIdx) => {
        if (y > 185) {
          doc.addPage();
          y = 15;
        }
        const fill = rowIdx % 2 === 0 ? alternateFill : surfaceFill;
        doc.setFillColor(...fill);
        x = startX;
        COL_KEYS.forEach((k, i) => {
          doc.rect(x, y, colWidths[i], rowH, "F");
          const cell = String(row[k] ?? "-");
          const clipped = doc.splitTextToSize(cell, colWidths[i] - 3)[0] ?? cell;
          doc.text(clipped, x + 2, y + 5.5);
          x += colWidths[i];
        });
        // row border
        doc.setDrawColor(...border);
        doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowH, "S");
        y += rowH;
      });

      doc.save(`pdks_rapor_${toLocalDateString()}.pdf`);

      notify.success("PDF indirildi", "Rapor başarıyla PDF formatında dışa aktarıldı.");
    } catch (error) {
      console.error('PDF export error:', error);
      notify.error("PDF oluşturma hatası", `PDF dosyası oluşturulurken bir hata oluştu: ${errorMessage(error)}`);
    }
  };

  return {
    formatReportData,
    handleExportExcel,
    handleExportPDF
  };
}

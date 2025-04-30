
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { MessageData } from './types';

export function useExportUtils() {
  const { toast } = useToast();

  const formatReportData = (data: any[]) => {
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

  const handleExportExcel = (messageData: MessageData[]) => {
    if (!messageData || !Array.isArray(messageData)) {
      console.log("Export Excel error: No data to export", messageData);
      toast({
        title: "Dışa aktarılamadı",
        description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
        variant: "destructive",
      });
      return;
    }

    try {
      const ws = XLSX.utils.json_to_sheet(messageData);
      
      // Set column widths for better readability
      const wscols = [
        { wch: 25 },  // name
        { wch: 25 },  // check_in
        { wch: 25 },  // check_out
        { wch: 20 },  // department
        { wch: 15 },  // device
        { wch: 20 }   // location
      ];
      
      ws['!cols'] = wscols;
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PDKS Raporu");
      
      XLSX.writeFile(wb, `pdks_rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
  
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
      const PDF_GENERATION_ENDPOINT = "/api/generate-pdf";
      
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

      // Use the Supabase Edge Function to generate PDF
      const response = await fetch(`https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/generate-pdf`, {
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

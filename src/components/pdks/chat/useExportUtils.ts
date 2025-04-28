
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { MessageData } from './types';
import { PDF_GENERATION_ENDPOINT } from './constants';

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

  const handleExportExcel = (messageData: any) => {
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
      
      const wscols = [
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 20 }
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
      const headers = Object.keys(messageData[0]).filter(key => 
        key !== 'id' && key !== 'access_granted' && key !== 'status'
      );
      
      const rows = messageData.map(record => {
        return headers.map(header => {
          if (header === 'check_in' || header === 'check_out') {
            return record[header] ? new Date(record[header]).toLocaleString('tr-TR') : '-';
          }
          return record[header] || '-';
        });
      });
      
      const currentDate = new Date().toLocaleDateString('tr-TR');
      
      const response = await fetch(PDF_GENERATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          headers: headers.map(h => h.charAt(0).toUpperCase() + h.slice(1).replace('_', ' ')),
          rows,
          title: "PDKS Raporu",
          date: currentDate
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PDF oluşturma hatası: ${response.status} ${errorText}`);
      }

      const htmlBlob = await response.blob();
      const url = window.URL.createObjectURL(htmlBlob);
      window.open(url, '_blank');
      
      toast({
        title: "PDF görüntüleniyor",
        description: "PDF raporu yeni pencerede açılıyor. Tarayıcınızın yazdırma dialogu ile kaydedebilirsiniz.",
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

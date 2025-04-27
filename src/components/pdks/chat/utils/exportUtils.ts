
import * as XLSX from 'xlsx';
import { toast } from "@/hooks/use-toast";
import { MessageData } from "../types";

export const handleExportExcel = (messageData: MessageData[]) => {
  if (!messageData || !Array.isArray(messageData)) {
    toast({
      title: "Dışa aktarılamadı",
      description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
      variant: "destructive",
    });
    return;
  }

  const ws = XLSX.utils.json_to_sheet(messageData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rapor");
  XLSX.writeFile(wb, `pdks_rapor_${new Date().toISOString().split('T')[0]}.xlsx`);

  toast({
    title: "Excel dosyası indirildi",
    description: "Rapor başarıyla Excel formatında dışa aktarıldı.",
  });
};

export const handleExportPDF = async (messageData: MessageData[]) => {
  if (!messageData || !Array.isArray(messageData)) {
    toast({
      title: "Dışa aktarılamadı",
      description: "Bu mesaj dışa aktarılabilir bir rapor içermiyor.",
      variant: "destructive",
    });
    return;
  }

  try {
    const headers = Object.keys(messageData[0]);
    const rows = messageData.map(Object.values);
    
    const response = await fetch('https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        headers,
        rows,
        title: "PDKS Raporu",
        date: new Date().toLocaleDateString('tr-TR')
      }),
    });

    if (!response.ok) throw new Error('PDF oluşturma hatası');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdks_rapor_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "PDF dosyası indirildi",
      description: "Rapor başarıyla PDF formatında dışa aktarıldı.",
    });
  } catch (error) {
    console.error('PDF export error:', error);
    toast({
      title: "PDF oluşturma hatası",
      description: "PDF dosyası oluşturulurken bir hata oluştu.",
      variant: "destructive",
    });
  }
};

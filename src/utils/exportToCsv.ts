
import { PDKSRecord } from "@/hooks/usePdksRecords";

export function exportToCsv(records: PDKSRecord[]) {
  const headers = ["Ad Soyad", "Tarih", "Giriş Saati", "Çıkış Saati", "Durum"];
  const csvRows = [
    headers.join(','),
    ...records.map(record => {
      const values = [
        `${record.employee_first_name} ${record.employee_last_name}`,
        new Date(record.date).toLocaleDateString('tr-TR'),
        record.entry_time,
        record.exit_time,
        record.status === 'present' ? 'Mevcut' : record.status === 'late' ? 'Geç' : 'Yok'
      ];
      return values.join(',');
    })
  ];
  
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `pdks_records_${new Date().toLocaleDateString()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

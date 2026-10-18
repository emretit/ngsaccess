export type ReportType = "sgk" | "overtime" | "attendance" | "department";
export const REPORT_TEMPLATES = [
  { id: "sgk", label: "SGK Aylık Döküm", description: "Çalışan başına gün, saat, mesai, izin" },
  { id: "overtime", label: "Fazla Mesai Özet", description: "Aylık/yıllık mesai toplamları" },
  { id: "attendance", label: "Devam Özet" , description: "Devam, devamsızlık, izin günleri" },
  { id: "department", label: "Departman Maliyet", description: "Maliyet analizi" },
];


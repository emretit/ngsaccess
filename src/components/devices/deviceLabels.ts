export const deviceLabels = {
  capabilities: "Özellikleri tara",
  workStatus: "Çalışma durumu",
  reconcile: "Eşitlik kontrolü",
  reboot: "Yeniden başlat",
  backfillEvents: "Olayları tara",
  captureCard: "Kart okut",
  triggerSync: "Panel senkronu",
  pending: "Bekliyor",
  processing: "İşleniyor",
  failed: "Başarısız",
  zone: "Bölge seçin",
  newZone: "+ Yeni bölge oluştur",
  optionalIp: "IP adresi (isteğe bağlı)",
  ipPlaceholder: "ör. 192.168.1.x",
  uuidHelp: "Panelin Sistem ekranındaki 15 haneli UUID — seri numarası değil",
  commandSent: "Komut cihaza iletildi",
  offlineConfirmation: "Cihaz çevrimdışı; komut başarısız olabilir.",
  longRunning: "İşlem arka planda sürüyor, paneli kapatabilirsiniz.",
} as const;
export function deviceEventLabel(label: string): string {
  const match =
    /^(?:Cihaz istisnası|Cihaz durum olayı|Bilinmeyen olay|Cihaz olayı)\s*\((?:kod )?(\d+)\)$/.exec(
      label,
    );
  return match ? `Cihaz olayı (kod ${match[1]})` : label;
}

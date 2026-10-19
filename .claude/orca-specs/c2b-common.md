# Faz C2b — ortak ek (C2a sonrası)
ÖNCE `.claude/orca-specs/c2-common.md` oku; oradaki tüm kurallar geçerli. Bu dosya yalnız C2b farklarını ekler.
- Repo HEAD `cd0d85f` (C2a canlı: 02/03/04/08). C2b sayfaları: 05 Geçiş Kontrol, 06 Ziyaretçiler, 07 Canlı İzleme, 09 Vardiyalar.
- Akış: önce sayfa başına backend worker (bu dalga), koordinatör kapısı + denetim, sonra aynı sayfanın frontend worker'ı
  backend raporundaki sözleşmeyle. Backend worker frontend'e (src/**) DOKUNMAZ.
- Canlıdaki eski frontend, bu backend deploy edildiğinde de çalışmaya devam etmeli: mevcut query/mutation imzalarını KIRMA.
  Yeni ihtiyaç = yeni fonksiyon veya opsiyonel yeni arg. Eskiyi kaldırmak frontend dalgasından sonra koordinatörün işi.
- C2a'da gelen ortak parçaları yeniden yazma, kullan: `convex/lib/pdksSource.ts` (okuma kaynağı/biyometri sınıflaması),
  `convex/lib/projectScope.ts` `resolveProjectScope`, `convex/lib/peopleHikSnapshot.ts` `getEmployeeTargetDevices`,
  `convex/peopleActivity.ts` (kişi bazlı senkron durumu — Hik `done` teslim kanıtı DEĞİL, IDE `acked` doğrulanmış sayılır).
- Paralel backend worker'ları: c2b-05-api, c2b-06-api, c2b-07-api, c2b-09-api. Ownership listeleri ayrık; `convex/_generated/api.d.ts`
  herkesin ortak dosyası — yalnız KENDİ modül satırlarını ekle, başkasının satırını silme/yeniden sıralama.
- Şema: `convex/schema.ts` koordinatörde. Yeni tablo/alan/index gerekiyorsa `ask` ile TAM tanımı gönder (gerekçe + defineTable/index
  satırı). Koordinatör ekler ve cevap verir; o sırada şemaya bağlı olmayan işe devam et. Yeni alanlar `v.optional` (widen).
- Kapılar backend için: convex tsc 0 · `node_modules/.bin/eslint convex` 0 hata · `npx vitest run` yeşil (yeni saf mantık testleriyle).
- Rapor: `worker_done` ≤10 satır + `.claude/orca-specs/reports/c2b-<ad>.md`: her yeni/değişen fonksiyonun TAM arg + dönüş tipi
  (frontend worker yalnız bu dosyayla çalışacak), Türkçe durum etiketi önerileri, tarama sınırları, açık riskler.

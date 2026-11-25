# P1-1 — Hik kapısına göre geçiş geçmişi

- Mevcut durum: `convex/cardReadings.ts:194` kapıda IDE `ioId` zorunlu tutuyor; `:273` yalnız `ideIoId` eşleştiriyor.
- Hik okumaları `hikCardReaderNo` taşır (`convex/schema.ts:705`); okuyucu-kapı bağlantısı `readers.by_door` ile mevcut (`:426`).
- Mevcut `by_project_device_time`, cihaz/kişi/sonuç indeksleri ve 2.000 satır/2 MB sayfalama sınırları korunacak.
- Değişecek: `convex/cardReadings.ts`, yeni `convex/cardReadings.doorFilter.test.ts`.
- Gerekirse: `src/components/live-monitoring/**` içindeki kapı seçimi/istemci filtresi.
- Yetki dışı ihtiyaç: `convex/lib/cardReadingAudit.ts` Hik kapısı zenginleştirmiyor (`:100`); istemci `matchesFilters` kapı kimliğini istiyor (`src/components/live-monitoring/lib/readings.ts:18`). Koordinatörden izin istenecek.
- Şema değişikliği: planlanmıyor; yeni indeks/DB yazma yok.
- Testler: Hik iki kapı/giriş-çıkış okuyucuları; IDE IO=0 regresyonu; proje/cihaz uyuşmazlığı; kişi/tarih/sonuç/kaynak/arama birleşimi; sayfalama ve okuma sınırı.
- Kapılar: uygulama tsc, değişen dosyalarda eslint, ilgili vitest, find-node-leak.
- Onay: `cardReadingAudit.ts` ownership verildi; seçili Hik kapısında bir kez `readers.by_door.take(101)` sorgusu ayrıca onaylandı.
- Uygulama: gerçek okuyucu numaraları öncelikli; yalnız okuyucu kaydı yoksa 2N-1/2N (kapı numarası yoksa 1) kullanılır. 101 kayıt açık hata verir.
- Zenginleştirme seçili kapı belgesini yeniden kullanır; ek kapı sorgusu yok. IDE indeks/eşleştirme yolu değişmedi.
- Doğrulama: 15 backend + 34 mevcut frontend testi = 49/49; değişen üç TS dosyasında ESLint 0 hata; Node sızıntısı 0; diff whitespace kontrolü temiz.
- Koordinatör talimatıyla çalışan app tsc durduruldu; app tsc koordinatöre devredildi (paralel kontroller makineyi zorluyor).

## Denetim D1 / D2 / E1 düzeltmeleri
- D1: canlı Hik okumaları cihaz başına bir kez doors/readers.by_device haritasıyla kapıya bağlanır; Hik sorguları 101 kapı/201 okuyucu ile sınırlı, sınır aşımı açık hatadır. IDE yolu korunur.
- D2: yeni `convex/lib/hikDoorReaders.ts` ortak yardımcı; eksik numara ve both yönü desteklenir; history/live/getPlanReaders kullanır (`doors.ts` bu çıkarım için izinli).
- E1: cardReadings içindeki findDeviceCardEmployee boş/whitespace kart için DB aramasından önce null döner; diğer E1 dosyaları P1-2 worker kapsamındadır.
- Dosyalar: yukarıdaki iki Convex dosyası, doors.ts, yeni yardımcı, cardReadings.doorFilter.test.ts ve yeni cardReadingAudit.hik.test.ts.
- Kapılar: hedefli vitest, değişen dosyalarda eslint, find-node-leak; tam app tsc koordinatördedir; şema/indeks değişikliği yok.
- Sonuç: 4 dosya / 64 test geçti; 6 değişen TS dosyasında ESLint 0 hata; Node sızıntısı 0; diff whitespace temiz.
- D1 toplam ek Hik harita bütçesi: istek başına 1000 kapı/2000 okuyucu; cihaz başına 100 kapı/200 okuyucu; tüm aşım durumları açık hata, sessiz kesme yok.

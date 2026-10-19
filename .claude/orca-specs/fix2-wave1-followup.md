# UI Audit 2 — Dalga 1 denetim bulgularının düzeltmesi

## Hedef
`docs/ui-audit-2/review-wave1.md` raporundaki şu bulguları düzelt: R1-E1 (Engel), R1-D1, R1-D2, R1-D3, R1-D5, R1-D6, R1-N3, R1-N4, R1-N5.
Bitti = her biri düzeltildi (ya da raporda gerekçeyle "yapılamadı") + kapılar yeşil.

## Notlar
- R1-E1: Canlı İzleme `source` (Kart/QR/Mobil/Biyometrik) filtresi sayfalamadan SONRA uygulanıyor. Sayfalamadan ÖNCE uygulanmalı
  (Convex `.withIndex(...).filter(q => ...)` sonra `.paginate()` → süzme taramada olur; ya da kaynağı belirleyen alanlar index'liyse index aralığı).
  Kaynak sınıflaması JS'te hesaplanıyorsa ve `q.filter` ile ifade edilemiyorsa: saklanan alan + backfill GEREKİR → bu bir migration'dır, YAPMA;
  bunun yerine filtre aktifken boş sayfa yerine taramaya devam eden (sayfa dolana ya da bütçe bitene kadar) sunucu döngüsü yaz ve sonuçta
  "taranan/eşleşen" bilgisini dürüst döndür. Index gerekiyorsa `ask` ile iste (convex/schema.ts koordinatörde).
- R1-D2: çevrimdışı uyarısı yalnız komutun gerçekten kuyruğa alındığı taşıma türlerinde ("komut kuyruğa alınır"); diğerlerinde doğru metin
  ("Cihaz çevrimdışı — komut gönderilemez" vb.). Komut gönderme davranışı DEĞİŞMEZ.
- R1-D5: hata yakalanınca kullanıcıya bildirilsin VE onay penceresi açık kalsın (hata yeniden fırlatılsın ya da `run()` false dönsün — `ConfirmDestructive` sözleşmesine bak, değiştirme).
- R1-D6: kişi arama sorgusu ziyaretçileri (`isVisitor`) dışlasın (eski `employees.list` davranışı).
- R1-N5: pasif kişide gönderim cihazdan SİLER — onay penceresi metni bunu doğru söylesin.

## Bağlam
Repo /Users/emreaydin/ngsaccess. Kurallar: `any` YASAK, `unknown` + daraltma; `!` yerine optional chaining; Türkçe sade metin.
Convex kodundan önce `convex/_generated/ai/guidelines.md` oku. Aynı ağaçta başka worker'lar ve bir ölü-kod temizliği oturumu var: yalnız Ownership'e yaz.

## Ownership
`convex/cardReadings.ts` (yalnız Canlı İzleme liste/geçmiş/kişi arama fonksiyonları), `convex/lib/liveReadings*.ts`, `src/components/access-control/CardReadings*.tsx`,
`src/components/live-monitoring/**`, `src/components/layout/AppSidebarNav.tsx`, `src/components/devices/DeviceCommandCenter.tsx`,
`src/components/devices/DeviceApiTokenCard.tsx` (+test), `src/components/employees/{EmployeeTable,EmployeeSyncConfirmDialog,EmployeeBulkActions}.tsx` (+testleri)

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` (kapsam dışı hata olursa dosya adını raporla, dokunma)
- `node_modules/.bin/eslint <değişen dosyalar>` → 0 error
- `node_modules/.bin/vitest run src/components/live-monitoring src/components/access-control src/components/devices src/components/employees src/components/layout convex/lib` → yeşil
- Her davranış düzeltmesine test.

## Yasak
commit/push/deploy/migration/DB yazma YOK, `npx convex` YOK, paket ekleme YOK.

## Rapor (worker_done ≤10 satır)
Bulgu ID → yapılan + file:line; yapılamayanlar; kapı sayıları; `--files-modified`.

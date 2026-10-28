# Güvenlik denetimi — genel kart okuyucu ret fix'i (9a28fb69 + 35a47867; Claude yazdı)

Rol: SALT-OKUMA denetçi. Hiçbir dosyaya yazma (yalnız rapor). commit/push/deploy/DB/`npx convex` YOK.
Çalışma dizini /Users/emreaydin/ngsaccess (main, worktree YOK). Başka oturumların commit'siz dosyaları var (git status M) — onları DENETLEME, dokunma.

Hedef: `git diff bdb4e3a2 35a47867 -- convex/lib/processCardReadingCore.ts convex/processCardReading.characterization.test.ts` değişikliğinin (a) hiçbir izin yolunu genişletmediğini, (b) iddia edilen 3 açığı gerçekten kapattığını, (c) 35a47867 birleştirmesinin yazılan ret satırını birebir koruduğunu kanıtla ya da çürüt.

## Bağlam
- `processGenericCardReading` (convex/lib/processCardReadingCore.ts ~:300-360) genel kart okuyucu (ESP32/HTTP) yolu. Önceden yalnız `employee.isActive` bakıyordu; işten çıkış cron'u isActive'i kapatana kadar çıkışı geçmiş kişi ve süresi dolmuş ziyaretçi kartla geçebiliyordu, pasif cihazdan okuma kabul ediliyordu.
- Fix, token yolunun (convex/lib/mobileAccess.ts `genericReaderTokenAllowed`) kullandığı aynı kuralları ekledi: `employeeWithinAccessEpoch` (accessStartsAt/accessExpiresAt), `employedOn` (convex/lib/employment.ts, son gün DAHİL), `device.isActive === false` reddi.
- Hik/IDE panel yolları (aynı dosyadaki diğer fonksiyonlar) bilinçli olarak değişmedi.

## Sorular
1. Saat dilimi: `trDateKey(accessTime)` İstanbul günü mü veriyor? accessTime UTC ISO iken 21:00-23:59 UTC aralığında son çalışma günü yanlış güne kayıyor mu? `employedOn` hangi alanlara bakıyor (employmentStartDate da var mı? başlangıçtan önceki okuma artık reddediliyor mu — bu beklenen mi, token yoluyla tutarlı mı)?
2. `Date.parse(accessTime)` NaN olursa (bozuk/boş zaman) `employeeWithinAccessEpoch` ne döner — izin mi ret mi? accessTime nereden geliyor (args.accessTime mı, sunucu saati mi)? İstemci gelecekteki/geçmişteki bir accessTime göndererek pencere/işten çıkış kontrolünü atlatabilir mi? (Eski kodda da aynıysa NOT, yeni açılan bir yol ise ENGEL.)
3. Token yoluyla tutarlılık: `genericReaderTokenAllowed` ile yeni koşulların birebir aynı semantiği var mı (aynı alanlar, aynı sınır dahil/haric, aynı zaman kaynağı)? Fark varsa listele.
4. 35a47867: kaldırılan `!device` dalının yazdığı satır (projectForRow(employee.projectId, undefined), deviceId yok, direction yok, hikFields, rawData, createdAt/updatedAt) birleşik dalın `device` undefined iken yazdığıyla alan alan aynı mı? Dönüş `{ granted: false }` ve scheduler çağrısı yokluğu aynı mı?
5. Ret → izin dönüşen herhangi bir girdi var mı (ENGEL)? Karakterizasyon testleri 4 yeni ret + endsToday iznini gerçekten doğru fixture tarihleriyle mi sınıyor (test "bugün" = hangi tarih)? Eksik kritik dal (ör. employmentStartDate gelecekte, accessStartsAt gelecekte, gece yarısı sınırı) NOT olarak.

## Kapılar (kendin koş)
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`
- `node_modules/.bin/vitest run convex/processCardReading.characterization.test.ts convex/lib/mobileAccess convex/lib/employment`
- `node /tmp/find-node-leak.mjs` (repo kökünden; çıktısız olmalı)
(Başka oturumun yarım dosyasından tsc hatası gelirse yalnız denetlenen dosyalarda hata olmadığını doğrula, dış hatayı file:line raporla.)

Rapor: /tmp/denetim-kart-guvenlik-fix.md — her bulgu ENGEL/DÜZELT/NOT, file:line, eski vs yeni davranış, somut girdi örneği, öneri; sonda tek satır hüküm GÜVENLİ / GÜVENLİ DEĞİL + kapı özeti.
worker_done (≤10 satır): bulgu sayıları + hüküm + kapılar.

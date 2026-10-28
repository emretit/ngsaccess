# Güvenlik denetimi — QR/mobil yoluna son çalışma günü kontrolü (Claude yazdı)

Rol: SALT-OKUMA denetçi. Rapor dışında dosya yazma. commit/push/deploy/DB/`npx convex` YOK. Çalışma dizini /Users/emreaydin/ngsaccess (main, worktree YOK). Başka oturumların commit'siz dosyalarını denetleme.
Eski hâl `git show HEAD:<dosya>`, yeni hâl çalışma kopyası (`git diff HEAD -- <dosya>`).

Dosyalar: convex/lib/mobileAccess.ts (employeeWithinAccessEpoch), YENİ convex/lib/mobileAccess.test.ts, convex/processCardReading.characterization.test.ts (token "endedEmployee" vakası), convex/lib/processCardReadingCore.ts (yalnız yorum).

Hedef: `employeeWithinAccessEpoch`'a eklenen kontrol (isVisitor değil + employmentEndDate var + TR günü > bitiş → ret; `!Number.isFinite(now)` → ret) (a) hiçbir yerde izni genişletmiyor, (b) QR okuyucu token yolu (`genericReaderTokenAllowed`), mobil kapı açma (`listMobileTargets`/`resolveMobileTarget`) ve QR check-in (`convex/employeeCheckIn.ts:16,:49`) için işten çıkış boşluğunu kapatıyor, (c) istenmeyen bir yan etki üretmiyor.

## Sorular
1. `employeeWithinAccessEpoch`'ın TÜM çağıranlarını bul (grep). Her biri için yeni ret ne demek: kullanıcıya hangi hata/reason döner (ACCESS_EPOCH_DENIED, TARGET_NOT_ALLOWED, "expired")? İşten çıkan kişinin son gününden sonra mobil uygulamada yanlış/kafa karıştırıcı bir durum (ör. çıkış yapamama, kendi geçmiş kayıtlarını görememe, ziyaretçi ev sahibi akışı) oluşuyor mu? Uygulama kırılıyor mu?
2. Saat dilimi: `trDateKey(new Date(now).toISOString())` İstanbul gününü veriyor mu (bitiş günü 21:00Z sınırı)? `employedOn` ile semantik (son gün dahil) aynı mı? Kart yolundaki (processCardReadingCore ~:338) kontrolle birebir aynı karar mı (aynı an için)?
3. `!Number.isFinite(now)`: eski davranışta NaN zaten ret idi; ±Infinity için fark var mı ve herhangi bir çağıran bunu geçebilir mi? `new Date(now).toISOString()` hiçbir girdide throw edemiyor mu?
4. Ziyaretçi: `isVisitor === true` iken employmentEndDate yok sayılıyor — ziyaretçi bitişini erişim penceresi mi kapatıyor (accessExpiresAt)? Ziyaretçi için davranış HEAD ile aynı mı?
5. Ret → izin dönüşen girdi var mı (ENGEL)? Testler (yeni unit test + token endedEmployee) eski kodda kırmızı / yenide yeşil mi — doğrula: `git stash` YASAK; HEAD export: `rm -rf /tmp/qr-head && mkdir /tmp/qr-head && git archive HEAD | tar -x -C /tmp/qr-head && cp convex/lib/mobileAccess.test.ts /tmp/qr-head/convex/lib/ && cp convex/processCardReading.characterization.test.ts /tmp/qr-head/convex/ && ln -s /Users/emreaydin/ngsaccess/node_modules /tmp/qr-head/node_modules` sonra orada koş (beklenen: 3 kırmızı).
6. mobileAccess.ts V8'de çalışıyor: yeni import'lar (./employment, ./trDate) node-yalnız değil mi; import döngüsü yok mu?

## Kapılar (kendin koş)
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `-p tsconfig.app.json`
- `node_modules/.bin/vitest run` (TAM suite; `convex/w5aFix2.test.ts` yük altında flaky — düşerse tek başına koş)
- `node /tmp/find-node-leak.mjs` çıktısız

Rapor: /tmp/denetim-qr-employment.md — ENGEL/DÜZELT/NOT, file:line, eski vs yeni, somut girdi, öneri; sonda GÜVENLİ / GÜVENLİ DEĞİL + kapı özeti.
worker_done (≤10 satır): sayılar + hüküm + kapılar.

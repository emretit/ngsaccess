# FAZ 4-A — Saklama/temizlik cron'ları (R-04, B-07, Y-08) + QR tamamlanmış yanıtta kişisel veri yok (B-01 yanıt kısmı)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB). Rapor: `/tmp/fix-f4-a-saklama-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` B-07, B-01, Y-08 · `M4-hesap-yonetim.md` R-04 (kanıt satırlarını yeniden doğrula). Convex kuralları: `convex/_generated/ai/guidelines.md`.

## Hedef (test edilebilir)
Süresi dolmuş/terminal operasyon ve geçici kayıtlar günlük, sayfalı (≤200/mutation, devamı `scheduler.runAfter(0, ...)` ile) cron'larla silinir; hiçbir purge tek transaction'da sınırsız `collect` yapmaz; tamamlanmış QR token'ı oturumsuz çağrıya kişi adı/saati döndürmez.

## Ownership
`convex/crons.ts`, yeni `convex/retention.ts` (+ `convex/retention.test.ts`), `convex/employeeCheckIn.ts` (+ testi), `convex/emailVerification.ts` (+ testi), `convex/schema.ts` (YALNIZ purge için gereken süre/durum index'leri — yeni alan YOK; mevcut index yetiyorsa dokunma).
DOKUNMA: `convex/employees.ts`, `convex/lib/employeeCascade.ts`, `convex/files.ts` (F4-B) · `convex/http.ts`, `convex/actions/openaiChat.ts`, `convex/alarms.ts`, `convex/biometricDestruction.ts`, `convex/fingerprintEnrollment.ts` (F4-C) ·
`convex/privacyRetention.ts` (mevcut cardReadings saklaması — OKU, deseni kullan) · `convex/lib/pdks*`, `src/components/reports/**`, `src/lib/reports/**` (başka oturumun WIP'i).

## Saklama süreleri (varsayılan; `retention.ts` başında adlandırılmış sabit, rapora tablo olarak yaz)
| Kayıt | Silinecek | Süre |
|---|---|---|
| `hikPendingOperations`, `idePendingOperations` | yalnız TERMINAL (done/acked/dismissed/failed — şemadaki gerçek terminal durumlar) | 30 gün (son güncellemeden) |
| `deviceSyncRuns` + `deviceSyncRunTargets` | biten/iptal run ve hedefleri (önce hedefler, sonra run) | 90 gün |
| `deviceEvents` | hepsi | 365 gün |
| `checkInTokens` | süresi dolmuş veya kullanılmış | 7 gün |
| `employeeSessions` | süresi dolmuş | 30 gün |
| mobil kapı niyeti/komut tablosu (B-07; şemada bul) | terminal/süresi dolmuş | 30 gün |
| `auditLog` | **SİLME YOK** (yasal saklama kararı Emre'de) — rapora "karar gerekli" yaz | — |
KESİN KURAL: `pending`/`sent` ya da devam eden (running) iş, aktif oturum, kullanılmamış geçerli token ASLA silinmez. Hik/IDE erişim GERİ ALMA (deleteUser/deletePerson) işi terminal değilse silinmez.

## Değişiklikler
1. `retention.ts`: her tablo için `internalMutation` sayfalı purge (index ile süre aralığı; index yoksa schema'ya ekle), batch sonu devam planlaması, toplam üst sınır (cron başına ≤ 20 zincir halkası). `crons.ts`'e tek günlük giriş (TR gece, mevcut cron saatleriyle çakışmasın) → sırayla tabloları süren bir orkestratör.
2. **Y-08** `emailVerification.ts:cleanupExpiredTokens` (~112-127): aralıksız `collect` + tek mutation patch → süre aralıklı, 200'lük sayfalı (`employeeAuth.cleanupExpiredSetupTokens` deseni).
3. **B-01** `employeeCheckIn.ts:~61-63`: tamamlanmış (`usedAt`) token için `employeeName`/`usedAt` DÖNDÜRME; yalnız durum ("kullanıldı"). UI'nın bu alanları kullanıp kullanmadığını `src/` içinde grep'le; kullanıyorsa `ask`.
4. `maintenance.ts` "stale cleanup" adı yanıltıcıysa yalnız yorum/rapor notu (davranış değiştirme).

## Kabul (testler)
- Her purge: süresi geçmiş terminal kayıt silinir; süresi geçmemiş ya da terminal olmayan kayıt kalır; 450 kayıtta 3 sayfa + devam planlaması; erişim geri alma işi pending iken silinmez.
- QR: tamamlanmış token yanıtında kişi adı yok; geçerli token akışı değişmedi.
- Kapılar (fix-ortak.md) + `vitest run convex/retention.test.ts convex/employeeCheckIn*.test.ts convex/emailVerification*.test.ts convex/privacyRetention*.test.ts`.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.

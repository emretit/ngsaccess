# FAZ 4-C — AI asistan sınırı (Y-06) · alarm e-posta bekçisi (Y-05) · biyometrik imha iş kimlikleri (Y-04) · HTTP auth-önce + gövde sınırı (C-11)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB). Rapor: `/tmp/fix-f4-c-dayaniklilik-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` Y-06, Y-05, Y-04 · `M2-cihaz.md` C-11 (kanıt satırlarını yeniden doğrula).

## Hedef (test edilebilir)
(a) AI sohbeti kullanıcı başına hız sınırı + giriş uzunluk sınırıyla çalışır; (b) "sending"de takılan alarm e-postası 10 dk sonra kurtarılır; (c) biyometrik imha tutanağı eski tarama purge işleri bitmeden "tamamlandı" demez; (d) `/card-reader` ve köprü uçları kimlik doğrulamadan ÖNCE gövdeyi parse etmez, büyük gövdeye 413, bozuk JSON'a 400 döner.

## Ownership
`convex/actions/openaiChat.ts`, `convex/lib/rateLimit.ts` (yalnız yeni limit tanımı ekle), `convex/alarms.ts`, `convex/biometricDestruction.ts`, `convex/fingerprintEnrollment.ts` (yalnız `removeAllForEmployee` dönüşü ~215-221), `convex/http.ts`, `convex/lib/cardReaderParse.ts`, ilgili testler + yeni `convex/fixF4Resilience.test.ts`.
DOKUNMA: `convex/crons.ts`, `convex/retention.ts`, `convex/employeeCheckIn.ts`, `convex/emailVerification.ts`, `convex/schema.ts` (F4-A) · `convex/employees.ts`, `convex/lib/employeeCascade.ts`, `convex/files.ts` (F4-B) · `convex/lib/processCardReadingCore.ts` (yeni commit'li; okumak serbest) ·
`convex/lib/pdks*`, `src/components/reports/**`, `src/lib/reports/**` (başka oturum). Şema değişikliği gerekirse `ask`.

## Değişiklikler
1. **Y-06** — `processMessage` (`openaiChat.ts:~40-80`): kullanıcı başına `limiter` (mevcut `lib/rateLimit.ts` RateLimiter) ör. 20 mesaj/saat token bucket; `input` > 4000 karakter → Türkçe hata. Sınır aşımında OpenAI çağrısı YAPILMAZ.
2. **Y-05** — `claimEmail` (`alarms.ts:~174`) claim anında 10 dk sonrasına kurtarma işi planlasın: hâlâ "sending" ise "failed/retry" durumuna çekip yeniden deneme planlar (sonsuz döngü yok: deneme sayacı ≤ 3).
3. **Y-04** — `removeAllForEmployee` (`fingerprintEnrollment.ts:~215-221`) oluşturduğu purge iş kimliklerini döndürsün; `biometricDestruction.ts:~129-142` bu kimlikleri imha kaydının `pendingOpIds`'ine eklesin → tutanak ancak hepsi bitince "tamamlandı".
4. **C-11** — `http.ts` `/card-reader` (~93), `/ide-bridge/*` (~345, ~400): önce auth (header/token) kontrolü, sonra gövde; `Content-Length` > 64 KB veya okunan gövde > 64 KB → 413; JSON parse hatası / zorunlu alan tipi yanlış → 400 (ortak yardımcı); `/sent` JSON/ID hatası da ortak 400. Mevcut başarılı yanıt shape'leri ve köprü sözleşmesi DEĞİŞMEZ (köprü `scripts/**` dokunulmaz).

## Kabul (testler)
- AI: 21. mesaj reddedilir + OpenAI mock çağrılmaz; 4001 karakter reddedilir.
- Alarm: claim sonrası kurtarma planlanır; "sent" olmuşsa kurtarma no-op; 3 denemeden sonra durur.
- İmha: eski tarama purge'ü bitmeden tutanak açık; bitince kapanır.
- HTTP: auth'suz istek gövde okunmadan 401; 65 KB → 413; bozuk JSON → 400; geçerli istek eskisi gibi (mevcut http testleri yeşil).
- Kapılar (fix-ortak.md) + ilgili `vitest run` (openaiChat, alarms, biometricDestruction, fingerprintEnrollment, http, cardReaderParse testleri + yeni dosya) + `node --test scripts/lib/ide-mqtt-routing.nodetest.mjs` (köprü sözleşmesi bozulmadı).
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.

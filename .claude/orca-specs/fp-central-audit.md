# FP-Central denetimi (SALT OKUMA) — 2026-10-22

## Hedef
Codex'in yazdığı FP-Central değişikliğini (spec `.claude/orca-specs/fp-central.md`) diff üzerinden denetle; P1/P2/P3 bulguları
file:line + somut senaryo ile `/Users/emreaydin/ngsaccess/.claude/orca-specs/fp-central-denetim-rapor.md`'ye yaz.

## Kapsam
`git -C /Users/emreaydin/ngsaccess diff` + yeni dosyalar `convex/lib/fingerprintCrypto.ts`, `convex/lib/fingerprintCrypto.test.ts`.
Yazarın raporu `/tmp/fp-central-report.md` yalnız harita; hükmü diff'e ve kendi koşumuna dayandır.

## Kontrol listesi (öncelik sırası)
1. **Şablon sızıntısı (P1):** düz şablon hiçbir tabloya, log'a, audit'e, hata mesajına, scheduler argümanına veya public
   query/action dönüşüne gidiyor mu? `encData`/`iv` herhangi bir public fonksiyondan dönüyor mu? Gateway yanıt gövdesi/exception dışarı sızıyor mu?
2. **Yetki (P1):** yeni/değişen public fonksiyonlar (`resendFingerprint`, `removeFingerprint`, `removeFingerprintFromDevice`, `listForEmployee`)
   isManager/admin + proje erişimi kontrol ediyor mu? Başka projenin kişisine/cihazına yayma veya silme mümkün mü?
3. **KVKK silme yolları (P1):** rıza iptali, pasif, işten çıkış, kişi silme, Excel import, biyometri modülü imhası → merkezi satır + cihaz
   kayıtları siliniyor mu? Kart değişiminde merkezi şablon KORUNUP yeni employeeNo ile yeniden gönderiliyor mu? Atlanan çağrı yeri var mı
   (`grep -rn scheduleFingerprintPurge convex`)?
4. **Yayma doğruluğu (P2):** her hedefte modül/rıza/aktiflik/kart/kapsam tekrar kontrol ediliyor mu? Rıza iptali ile eşzamanlı push
   (yarış) iptal edilmiş kişiye şablon yazabilir mi? Kaynak cihaz hariç mi? Cihaz başı hata izole mi?
5. **Döngü + kota (P2):** sync kancası → push → (herhangi bir yol) → sync → push sonsuz döngü var mı? Şablonu olmayan kişide kanca hiç
   action schedule etmiyor mu (Convex function-call kotası daha önce yandı)? Kart değişimi purge→push zinciri tekrar tetikleniyor mu?
6. **Kripto (P2):** AES-GCM IV tekrar kullanımı, AAD bağlama (employeeId:fingerNo), anahtar doğrulama, fail-closed davranışı, base64
   encode'da `Uint8Array.buffer` ofset tuzağı (`convex/lib/fingerprintCrypto.ts`).
7. **Şema (P2):** `employeeFingerprints.fingerData` kaldırıldı — prod'da 0 satır (doğrulandı); başka okuyan kod kaldı mı?
8. **UI (P3):** `EmployeeFingerprintCard.tsx` metinler, onay diyaloğu, "x/y cihazda", resend; proje kuralları (any yok, `!` yok).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `npx vitest run convex/lib/fingerprintCrypto.test.ts convex/actions/hikFingerprint.test.ts
convex/fingerprintEnrollment.test.ts convex/hikvisionSync.test.ts convex/actions/hikQueueWorker.test.ts src/components/employees/EmployeeFingerprintCard.test.tsx`

## YASAK
Kod değiştirme (yalnız rapor dosyası yazılır) · commit/push/deploy · `npx convex` komutları · DB yazma · worktree.

## Rapor
`worker_done` ≤10 satır: P1/P2/P3 sayıları + en kritik 3 bulgu file:line. Ayrıntı rapor dosyasında (her bulgu: dosya:satır, senaryo, önerilen düzeltme).

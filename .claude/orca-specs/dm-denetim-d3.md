# Denetim · Dalga 3a + 3b (C-05, B-04/B-05, C-01, C-04)

Kapsam (diff): `convex/privacyRetention.ts`, `convex/reports.ts`, `convex/actions/sendScheduledReports.ts`, `convex/invites.ts`, `convex/mailSettings.ts`, `convex/schema.ts` (yalnız `reportDeliveries` tablosu, `projectPrivacySettings.visitorRetention*` alanları ve `invites.claim*` alanları), testler `convex/privacyRetention.fairness.test.ts` (yeni), `convex/actions/sendScheduledReports.test.ts` (yeni), `convex/retention.test.ts`, `convex/invites.test.ts`, `convex/invites.security.test.ts`, `convex/mailSettings.test.ts`.
Not: `convex/reports.ts`'te başka oturumun değişikliği olabilir; yalnız teslim kaydı/retry kısmını denetle.

Özellikle:
1. C-05: `by_visitorRetentionLastProcessedAt` sıralaması — hiç işlenmemiş (undefined) projeler önce mi geliyor; cursor/cutoff kalıcılığı saklama süresi değişince doğru sıfırlanıyor mu; Dalga 1'in `purgeMobileOperations` mantığı korunmuş mu?
2. B-04/B-05: dönem claim'i gerçekten atomik mi (aynı dönem iki satır olabilir mi); retry scheduler'ı sınırlı mı; 1 saatlik `sending` watchdog'u nerede tetikleniyor (cron yok — kim çağırıyor?).
3. C-01: claim rezervasyonu (15 dk UUID) — süresi dolunca yeniden claim; claimToken public dönüyor mu; frontend `src/pages/UserSetup.tsx` akışı (claim → signIn → consume) değişmeden çalışıyor mu?
4. C-04: `mailSettings.ts` yazma-anı kontrolü mevcut `authedAction` giriş kontrolüyle tutarlı mı, super_admin yolu bozuldu mu?
## Denetim kuralları (SALT OKUMA)
- Repo /Users/emreaydin/ngsaccess (main). HİÇBİR dosyaya yazma (yalnız rapor çıktısı worker_done içinde). git add/commit/stash/checkout/reset/restore YASAK; `npx convex dev/deploy/run` YASAK.
- Yazar Codex worker'larıydı. Raporlarına değil diff'e ve kendi koştuğun teste dayan: `git diff -- <dosya>` + yeni dosyalar için `cat`.
- Çalışma ağacında başka oturumların commit'lenmemiş değişiklikleri var (ör. convex/schema.ts'de 35 satır başka oturumun, PDKS dosyaları). Yalnız aşağıdaki kapsamdaki hunk'ları denetle.
- Kaynak bulgu metinleri: `docs/audits/2026-11-14-implicit-state-machines/README.md` + `device-sync.md`, `access-visitor-account.md`, `people-pdks.md`. Convex kuralları: `convex/_generated/ai/guidelines.md`, `CLAUDE.md`.
- Bak: bulguyu gerçekten kapatıyor mu · yeni yarış/ezme yolu · eski istemci/geri uyumluluk (canlı veride yeni alan YOK, opsiyonel alanlar undefined) · yetki/sızıntı (token public query'de dönüyor mu) · sınırsız döngü/okuma (Convex limitleri) · testler gerçekten başarısız senaryoyu kanıtlıyor mu.
- İlgili test dosyalarını `npx vitest run <dosyalar>` ile koşabilirsin (tam vitest koşma, koordinatör koşuyor).
- Rapor (worker_done, ≤15 satır): bulgu başına `şiddet (critical/high/medium/low) · file:line · sorun · önerilen düzeltme`. Bulgu yoksa "temiz" + neyi doğruladığın.

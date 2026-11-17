# Denetim · Dalga 2 (A-03 + C-03 + A-04 + A-05 Hik ayağı)

Kapsam (diff): `convex/hikvisionSync.ts`, `convex/http.ts`, `convex/ideSync.ts`, `convex/lib/grantStatus.ts`, `convex/lib/hikSyncEmployee.ts`, `convex/lib/mobileAccess.ts`, `convex/schema.ts` (yalnız :539 ve :781 civarındaki 3 opsiyonel alan), testler `convex/hikvisionSync.attempt.test.ts` (yeni), `convex/hikvisionSync.test.ts`, `convex/accessGrantStatus.test.ts` (yalnız :385/:603 filtreleri).

Özellikle:
1. Hik ACK: attempt'siz eski ACK (köprü bugün attempt göndermiyor) hangi koşulda kabul ediliyor; yeni payload'ı ezebilir mi?
2. C-03: `beginGatewayGrants`/`finishGatewayGrants` nesil yarışı; nesil yoksa (eski satır) davranış; `removed` sonrası eski `effective` yazılamıyor mu?
3. A-04: msxId'siz ACK'te "tek sent adayı" seçimi doğru indeksle mi, birden fazla adayda no-op mu?
4. `convex/http.ts` ACK değişikliği canlı Linux köprüsünü (`infra/hik-event-bridge`) veya MQTT köprüsünü (`scripts/lib/ide-mqtt-routing.mjs`) kırıyor mu?
## Denetim kuralları (SALT OKUMA)
- Repo /Users/emreaydin/ngsaccess (main). HİÇBİR dosyaya yazma (yalnız rapor çıktısı worker_done içinde). git add/commit/stash/checkout/reset/restore YASAK; `npx convex dev/deploy/run` YASAK.
- Yazar Codex worker'larıydı. Raporlarına değil diff'e ve kendi koştuğun teste dayan: `git diff -- <dosya>` + yeni dosyalar için `cat`.
- Çalışma ağacında başka oturumların commit'lenmemiş değişiklikleri var (ör. convex/schema.ts'de 35 satır başka oturumun, PDKS dosyaları). Yalnız aşağıdaki kapsamdaki hunk'ları denetle.
- Kaynak bulgu metinleri: `docs/audits/2026-11-14-implicit-state-machines/README.md` + `device-sync.md`, `access-visitor-account.md`, `people-pdks.md`. Convex kuralları: `convex/_generated/ai/guidelines.md`, `CLAUDE.md`.
- Bak: bulguyu gerçekten kapatıyor mu · yeni yarış/ezme yolu · eski istemci/geri uyumluluk (canlı veride yeni alan YOK, opsiyonel alanlar undefined) · yetki/sızıntı (token public query'de dönüyor mu) · sınırsız döngü/okuma (Convex limitleri) · testler gerçekten başarısız senaryoyu kanıtlıyor mu.
- İlgili test dosyalarını `npx vitest run <dosyalar>` ile koşabilirsin (tam vitest koşma, koordinatör koşuyor).
- Rapor (worker_done, ≤15 satır): bulgu başına `şiddet (critical/high/medium/low) · file:line · sorun · önerilen düzeltme`. Bulgu yoksa "temiz" + neyi doğruladığın.

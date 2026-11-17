## Denetim kuralları (SALT OKUMA)
- Repo /Users/emreaydin/ngsaccess (main). HİÇBİR dosyaya yazma (yalnız rapor çıktısı worker_done içinde). git add/commit/stash/checkout/reset/restore YASAK; `npx convex dev/deploy/run` YASAK.
- Yazar Codex worker'larıydı. Raporlarına değil diff'e ve kendi koştuğun teste dayan: `git diff -- <dosya>` + yeni dosyalar için `cat`.
- Çalışma ağacında başka oturumların commit'lenmemiş değişiklikleri var (ör. convex/schema.ts'de 35 satır başka oturumun, PDKS dosyaları). Yalnız aşağıdaki kapsamdaki hunk'ları denetle.
- Kaynak bulgu metinleri: `docs/audits/2026-11-14-implicit-state-machines/README.md` + `device-sync.md`, `access-visitor-account.md`, `people-pdks.md`. Convex kuralları: `convex/_generated/ai/guidelines.md`, `CLAUDE.md`.
- Bak: bulguyu gerçekten kapatıyor mu · yeni yarış/ezme yolu · eski istemci/geri uyumluluk (canlı veride yeni alan YOK, opsiyonel alanlar undefined) · yetki/sızıntı (token public query'de dönüyor mu) · sınırsız döngü/okuma (Convex limitleri) · testler gerçekten başarısız senaryoyu kanıtlıyor mu.
- İlgili test dosyalarını `npx vitest run <dosyalar>` ile koşabilirsin (tam vitest koşma, koordinatör koşuyor).
- Rapor (worker_done, ≤15 satır): bulgu başına `şiddet (critical/high/medium/low) · file:line · sorun · önerilen düzeltme`. Bulgu yoksa "temiz" + neyi doğruladığın.

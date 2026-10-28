# DENETİM — Mobil talepler (1.0.5) — SALT OKUMA

Çalışma dizini: `/Users/emreaydin/ngsaccess` (main). Hiçbir dosyaya YAZMA (rapor dosyası hariç). `git add/commit/stash/reset/checkout/restore` YOK.
`npx convex *` YOK, canlı backend/DB YOK.

## Girdi
- İş tanımı: `.claude/orca-specs/mobil-talepler-v105.md` (önce oku; sözleşme ve kapsam oradadır).
- Diff: `git diff -- convex/leaveRequests.ts convex/attendanceCorrections.ts convex/lib/requestRules.ts convex/leaveRequests.test.ts convex/attendanceCorrections.test.ts convex/lib/requestRules.test.ts mobile/`
  + `git status --short mobile/` (yeni dosyalar untracked olabilir; onları da oku). Yazarın raporunu (`/tmp/mobil-talepler-rapor.md`) kanıt sayma; diff'i ve kendi kapını oku.

## Kendi kapın (koş, çıktıyı rapora yaz)
`node_modules/.bin/vitest run convex/leaveRequests.test.ts convex/attendanceCorrections.test.ts convex/lib/requestRules.test.ts` ·
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `cd mobile && flutter analyze --no-pub && flutter test --no-pub` (sırayla).

## Odak
1. **Sözleşme:** 16 kod adı spec'tekiyle birebir; her `throw` kodlu; `message` metinleri eskisiyle aynı; yönetici uçlarına dokunulmamış.
2. **Güvenlik:** çalışan yalnız kendi kaydını görür/geri çeker (IDOR); sessionToken log'a/diagnostics'e sızmıyor; sunucu metni UI'a basılmıyor;
   kişi verisi loglanmıyor; deep link allowlist'i yalnız `/requests` ekliyor.
3. **Çift kayıt:** mutasyonlar `retry:false`; ağ hatasında otomatik yeniden gönderme yok; düğme kilidi gerçekten çift çağrıyı engelliyor.
4. **Tarih/saat:** TR günü (Europe/Istanbul) doğru; 30/60 gün ve 5/300 sınırları sunucuyla aynı; HH:mm 24 saat; cihaz saat dilimi farklıyken doğru.
5. **Dayanıklılık:** bilinmeyen enum listeyi düşürmüyor; malformed → ProtocolError; dispose sonrası setState/notify yok; EMPLOYMENT_ENDED global yolu.
6. **Kapsam:** Ownership dışı dosya değişikliği var mı (`git status --short` tamamı); pubspec/native/sürüm dokunulmamış.
7. **Testler:** spec'teki zorunlu testler gerçekten var ve doğru şeyi doğruluyor (boş assert / sahte geçiş yok).

## Rapor
`/tmp/mobil-talepler-denetim.md`: bulgular **ENGEL / DÜZELTİLMELİ / NOT** etiketli, her biri file:line + neden + önerilen düzeltme.
Kapı çıktıları. `worker_done`'da ≤10 satır (ENGEL/DÜZELTİLMELİ/NOT sayıları + en önemli 3 bulgu) + `--report-path`.

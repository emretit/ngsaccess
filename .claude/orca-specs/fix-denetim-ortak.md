# FİX DENETİMİ — ORTAK (Claude denetçi; yazan Codex'ti, sen bağımsız denetçisin)

Çalışma dizini `/Users/emreaydin/ngsaccess` (main). SALT-OKUMA: kod düzenleme YOK, git add/commit/stash/checkout/reset/restore YOK,
npx convex YOK, DB/Supabase YOK. Yalnız spec'teki rapor dosyasını yaz. Aynı ağaçta başka worker'lar başka dosyalarda çalışıyor —
yalnız denetlediğin dosya listesine bak (`git diff -- <dosyalar>`).

## Yöntem
1. Fix spec'ini oku (hedef + kabul). Worker raporunu oku ama GÜVENME; `git diff -- <dosyalar>` ile değişikliği satır satır incele.
2. Her bulgu ID'si için: açık gerçekten kapandı mı (bypass yolu kaldı mı — aynı veriye/işleme giden başka uç?), regresyon var mı
   (yetkili kullanıcı işini hâlâ yapabiliyor mu, mevcut UI akışı kırıldı mı), hata mesajı Türkçe ve anlaşılır mı, CLAUDE.md kuralları
   (any, !, filter(Boolean)), Convex guidelines (validator, index, internal), testler gerçekten reddi/başarıyı doğruluyor mu.
3. Kendi koşun: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`,
   `node_modules/.bin/eslint <dosyalar>`, `node_modules/.bin/vitest run <ilgili testler>`. (Tam suite koşma.)

## Rapor (Türkçe, ≤ 80 satır)
- **Karar:** ENGEL (yayına giremez) / DÜZELTİLMELİ (küçük, aynı turda) / TEMİZ.
- Tablo: `# | Önem (ENGEL/DÜZELT/NOT) | file:line | Sorun | Öneri`.
- Kapı çıktıları (kendi koşun). `worker_done` ≤10 satır + `--report-path`, `--outcome succeeded`.

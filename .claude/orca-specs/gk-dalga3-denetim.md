# Geçiş Kontrol Dalga 3 — çapraz denetim (salt okuma)

## Hedef
Codex'in yazdığı Dalga 3 değişikliklerini denetle; bulguları `docs/ui-audit-gk/review-dalga3.md` dosyasına yaz. Kod DEĞİŞTİRME.

## Kapsam
Taban HEAD cead1059 (Dalga 1 bf97e90b, Dalga 2 78557c85 dahil). Denetlenecek diff: `git diff -- src/components/access-control` (convex değişmedi) + `git status --short src/components/access-control` içindeki untracked yeni dosyalar. Başka klasörlerdeki M dosyalar başka oturumun; denetleme.

## Ne istendi (doğrula)
Spec'ler: `.claude/orca-specs/gk-dalga3-ortak.md`, `-A-kural.md`, `-A2-arama.md`, `-B-sablon.md`, `-D-yetki.md`, `-C1-kapi-form.md`, `-C2-kapi-liste.md`. Bağlam `docs/ui-audit-gk/00_OZET.md` + sekme raporları + `review-dalga2.md`.
Kontrol et:
1. Her madde yapılmış mı (A: 01-O2, 01-O6, 01-D1, "teslim kanıtı" metni; A2: 01-O3; B: 02-O4; D: 03-O3..O8; C1: 04-O1, 04-O4, 04-O7; C2: 04-O5, 04-O6, 04-D1, GK-4).
2. Regresyon: Dalga 1/2 davranışları (Kaydet ve cihaza gönder, etki özeti, tekrar gönder, GK-1 hata nedeni, rozet=filtre=sayaç + aria-pressed, Proje özeti/Filtre sonucu, TemplatePicker boş durumu). Özellikle: C1 kapalı plan gizlenince kaydet payload'u değişti mi; "Hafta içi" seçimi doğru segment üretiyor mu; C2 seçili tür kopyasında seçilmeyen alanlar hedefte gerçekten korunuyor mu (bulk.ts + updatePlans argümanları — convex/doors.ts updatePlans yalnız okunur); D devices.manage kontrolü backend izniyle (convex/accessGrantStatus.ts:226) tutarlı mı; D filtre temizleme/kart koruma; odak dönüşü; mobil filtre paneli masaüstünü bozuyor mu.
3. CLAUDE.md kuralları (any yok, `!` yok, camelCase).
4. Erişilebilirlik: yeni düğme/etiketlerin erişilebilir adları, aria-invalid/describedby bağları, 44px hedefler (sınıf düzeyinde).
5. Testler davranışı sınıyor mu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`, `node_modules/.bin/vitest run src/components/access-control`, `node_modules/.bin/eslint src/components/access-control`.

## Yasaklar
Kod/dosya değiştirme (yalnız rapor dosyası). git add/commit/stash/checkout/reset, push, deploy, `npx convex` YASAK. Tarayıcı kullanma.

## Rapor
`docs/ui-audit-gk/review-dalga3.md`: üstte karar (Geçti / Düzeltme gerekli) + kapı sonuçları; tablo: ID | önem (Engel/Önemli/Küçük) | dosya:satır | sorun | öneri. worker_done ≤10 satır, `--report-path` ile rapor yolu.

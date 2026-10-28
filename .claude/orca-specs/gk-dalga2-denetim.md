# Geçiş Kontrol Dalga 2 — çapraz denetim (salt okuma)

## Hedef
Codex'in yazdığı Dalga 2 değişikliklerini denetle; bulguları `docs/ui-audit-gk/review-dalga2.md` dosyasına yaz. Kod DEĞİŞTİRME.

## Kapsam
Taban commit aa045840 (Dalga 1 = bf97e90b dahil). Denetlenecek diff: `git diff -- src/components/access-control convex/accessGrantStatus.ts convex/accessGrantStatus.test.ts` + `git status --short src/components/access-control` içindeki untracked yeni dosyalar. Başka klasörlerdeki M dosyalar başka oturumun; denetleme.

## Ne istendi (doğrula)
Spec'ler: `.claude/orca-specs/gk-dalga2-ortak.md`, `-A-kural.md`, `-B-sablon-yetki.md`, `-C-kapi.md`. Bulgu bağlamı `docs/ui-audit-gk/00_OZET.md` + sekme raporları.
Kontrol et:
1. Her madde gerçekten yapılmış mı (A: 01-O4, 01-O8, 01-D2, 01-D3, TemplatePicker boş durumu, Kurallar başlığı; B: 02-O1, 02-O5, 03-D1, 03-O2, rozet aria-pressed, iki sekme başlığı; C: 04-O2, 04-O3, DoorSaveResults sahte "kaydedildi" + yinelenen hata, Kapı Planları başlığı).
2. Davranış hatası/regresyon: Dalga 1 davranışları korunmuş mu (Kaydet ve cihaza gönder, etki özeti, Cihaza tekrar gönder, rozet=filtre=sayaç). TemplatePicker boş durumu üç çağıranda (CreateRuleDialog, DoorPlanDialog, CopyDoorPlansDialog) doğru çalışıyor mu, kaydedilmemiş değişiklik koruması atlanıyor mu. DoorPlanDialog tatil takvimi bağlantısı doğru rotaya mı gidiyor ve guard'dan geçiyor mu. `convex/accessGrantStatus.ts` `personCount` eklemesi: yalnız alan ekleme mi, sorgu maliyeti (ek tarama/okuma) arttı mı, tüketiciler (`grep -rn accessGrantStatus src convex`) kırıldı mı.
3. CLAUDE.md kuralları (any yok, `!` yok, camelCase, Doc|null filtre tipi).
4. Türkçe metin sade, tutarlı; kullanıcıya görünen "panel" kalmadı mı (`grep -rn -i "panel" src/components/access-control --include=*.tsx` sonuçlarını kullanıcı metni / kod adı diye ayır); dört sekme başlığı aynı kalıpta mı.
5. Testler davranışı gerçekten sınıyor mu (yalnız metin snapshot'ı değil).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`, `node_modules/.bin/vitest run src/components/access-control convex/accessGrantStatus.test.ts`, `node_modules/.bin/eslint src/components/access-control convex/accessGrantStatus.ts`.

## Yasaklar
Kod/dosya değiştirme (yalnız rapor dosyası). git add/commit/stash/checkout/reset, push, deploy, `npx convex` YASAK. Tarayıcı kullanma.

## Rapor
`docs/ui-audit-gk/review-dalga2.md`: üstte karar (Geçti / Düzeltme gerekli) + kapı sonuçları; tablo: ID | önem (Engel/Önemli/Küçük) | dosya:satır | sorun | öneri. worker_done ≤10 satır, `--report-path` ile rapor yolu.

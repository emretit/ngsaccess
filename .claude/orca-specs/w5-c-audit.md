# W5-C DENETİM — PDKS kuralları arayüzü (SALT-OKUMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w5-pdks-rules` — İLK İŞ `cd` oraya. Bu ağaçta üç commit'siz iş var: W5-A backend (`convex/**`, ayrıca denetlendi; düzeltmesi başka yerde sürüyor), W5-D export kolon seçici (denetlendi), W5-C arayüzü (SENİN KONUN). W5-C dosyaları: `/tmp/w5c-report.md` listesi (16 dosya; `src/components/settings/sections/components/PdksRules*`, `WorkAndPayrollSettings.tsx`, `src/components/pdks/**`, `src/components/settings/sections/reports/exportReport*`, `src/lib/reports/{registry,rows}*`). Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w5-c-pdks-rules-ui.md`. API: `/tmp/w5a-api.md`. Not: W5-A düzeltmesi APHB'ye `blockedByReview` alanı ekleyecek (XML boş döner); `getRules`/`listCheckpointTargets` admin'e kısıtlanacak — UI bunu kaldırabiliyor mu bak.

## YASAK
Kod/dosya düzenleme (rapor dosyası hariç), commit, push, deploy, `npx convex *`, DB yazma, paket kurma.

## Odak
1. **Ayar formu doğruluğu:** varsayılan tarih yarın (Europe/Istanbul, UTC kayması yok); geçmiş/bugün seçilemez; legacy ↔ kurallar geçişinde öneri değerleri; requirements'ta 4 alan payload'da; `selected` + boş hedef engeli; ≤500; seçilemeyen kapı devre dışı + neden; aynı tarihe gelecek sürüm "yerine geçer" onayı; gelecek sürüm silme onayı; backend hata metni gösteriliyor; `z.infer` payload tipi.
2. **Yetki:** bölüm yalnız `isAdmin`; project_user'da sorgular `"skip"` (admin kısıtında hata fırlatmamalı); deep-link/başka yoldan erişim yok.
3. **APHB:** `blockedByReview === true` ya da reviewDays varken indirme kapalı + liste; `xml` boş olunca eski "veri bulunamadı" hatası yanlışlıkla çıkmıyor; reviewDays yokken akış ESKİSİYLE AYNI; W5-D kolon seçici davranışı bozulmamış.
4. **PDKS gösterimi:** İnceleme rozeti + `punchQuality` ipucu metinleri; `durationMeasured === false` → "Süre hesaplanamadı" (tablo, mobil kart, detay çekmecesi); legacy satır (alanlar yok) görünümü değişmemiş; `incompleteDays` sayaçları.
5. **Raporlar:** İnceleme kolonu `/reports`'ta varsayılan gizli; SGK/Devam Özeti dışa aktarmasında YALNIZ bir satırda `incompleteDays > 0` iken; legacy çıktı birebir (test bunu gerçekten sabitliyor mu).
6. **Kota/UI kuralları:** yeni polling yok; `useQuery` yalnız ayar bölümünde ve admin'de; `any`/`as any`/`!`/`filter(Boolean)` yok; `FunctionReturnType`; Türkçe sade metin; 360 px taşma; erişilebilirlik (etiketler, klavye).
7. **Kapsam:** `convex/**` W5-C tarafından değiştirilmemiş; ownership dışı dosya yok; mevcut testlerde yalnız ekleme.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run src` (sayı) · `node_modules/.bin/vite build`.

## Rapor
`/tmp/w5c-denetim.md`: 1-2 cümle sonuç · kapılar · ENGEL / DÜZELTİLMELİ / NOT (file:line + senaryo + öneri). `worker_done`'da ≤10 satır özet + yol.

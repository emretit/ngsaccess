# W5-D DENETİM — PDKS dışa aktarma kolon seçici (SALT-OKUMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w5-export-columns` — İLK İŞ `cd` oraya. Fark: `git status --short` + `git diff HEAD` (taban `2b67349`). Yazan: Codex. Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w5-d-export-columns.md`. Yazar raporu: `/tmp/w5d-report.md`. Tasarım: `/Users/emreaydin/ngsaccess/.claude/designs/w5-pdks-codex.md` §4.

## YASAK
Kod/dosya düzenleme (rapor dosyası hariç), commit, push, deploy, `npx convex *`, DB yazma, paket kurma.

## Odak
1. **Birebir uyumluluk:** seçim yokken Excel/CSV/PDF başlık, sıra, hücre değerleri, ayraç ve dosya adı bugünküyle aynı mı (altın test gerçekten eski çıktıyı mı sabitliyor, yoksa yeni kodla üretilmiş beklentiyi mi). Aylık bordro ve APHB akışı değişmemiş mi. `/reports` davranışı ve mevcut `src/lib/reports/*.test.ts` beklentileri değişmemiş mi.
2. **Güvenlik:** CSV/Excel formül enjeksiyonu (`=`, `+`, `-`, `@`, TAB/CR başlangıcı) tüm formatlarda; seçilen ayraca göre doğru tırnaklama; UTF-8 BOM.
3. **KVKK/ücret:** hassas kolon kalıcı tercihten otomatik açılmıyor; admin olmayan ücret kolonunu göremiyor/indiremiyor; localStorage'da satır/hassas değer yok; anahtar proje+kullanıcı kapsamlı (başka kullanıcının tercihi sızmıyor).
4. **Tercih dayanıklılığı:** bozuk JSON, eski sürüm, bilinmeyen anahtar, boş liste → varsayılan; en az 1 kolon kuralı UI ve üreticide.
5. **UI:** erişilebilir sıra butonları (klavye, aria-label), 360 px taşma, önizleme 5 satır ve gerçek sıra, Türkçe metinler, mevcut shadcn bileşenleri; yeni Convex çağrısı/`useQuery` eklenmemiş.
6. **Kapsam:** `convex/**` dokunulmamış; ownership dışı dosya yok; repo kuralları (`any`/`as any`/`!`/`filter(Boolean)` yok).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run src` (sayı) · `node_modules/.bin/vite build`.

## Rapor
`/tmp/w5d-denetim.md`: 1-2 cümle sonuç · kapılar · ENGEL / DÜZELTİLMELİ / NOT (file:line + senaryo + öneri). `worker_done`'da ≤10 satır özet + yol.

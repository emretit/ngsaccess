# Kişi "Erişim başlangıcı" (Emre kararı 2026-10-22 22:10, CEO ngsaccess-41)

## Hedef
Çalışana Kişiler formundan "Erişim başlangıcı" tarihi girilebilsin; bu tarihten (TR günü 00:00, dahil) önce
kart / QR / mobil kapı / QR check-in reddedilsin VE Hikvision cihazına giden kişi kaydında geçerlilik başlangıcı
bu tarih olsun (cihaz yerel karar veriyor, sunucu reddi orada yetmez).

## Bilinen durum (CEO doğruladı)
- Alan şemada VAR: `employees.accessStartsAt: v.optional(v.string())` (convex/schema.ts:123). Şema değişikliği YOK.
- Ortak kapı zaten uyguluyor: `employeeWithinAccessEpoch` (convex/lib/mobileAccess.ts:49-58) `now >= Date.parse(accessStartsAt)`.
- Bugün yalnız ziyaretçide set ediliyor (convex/visitors.ts:334, lib/mobileVisitors.ts:67). Çalışan create/update akışında YOK.
- Hik kişi sync'i `Valid.beginTime`'ı varsayılan "bugün" ile yazıyor (convex/lib/gateway/persons.ts:63, :92-94); accessStartsAt'a bakmıyor.

## Yapılacaklar
1. Çalışan create/update mutation'larına `accessStartsAt` (ISO string | null = temizle) argümanı; yalnız ziyaretçi olmayan çalışan;
   TR gün başı (`YYYY-MM-DDT00:00:00+03:00` → ISO). Yetki: mevcut çalışan düzenleme yetkisiyle aynı. Audit satırı mevcut desene uysun.
2. Kişiler formu (src/components/employees/**): "Erişim başlangıcı" tarih alanı (opsiyonel, temizlenebilir), zod schema, payload.
   Kişiler'in mevcut onlyChangedFields/dirty desenine uy. Etiket altı kısa ipucu: "Bu tarihten önce kart, QR ve mobil erişim reddedilir."
3. Hik sync: kişi Valid.beginTime = accessStartsAt (TR yerel saat biçimi, mevcut defaultValidBegin biçimiyle aynı) varsa; yoksa
   bugünkü varsayılan. accessStartsAt değişince kişinin Hik kaydı yeniden senkron kuyruğuna girsin (mevcut değişiklik→sync deseni).
4. IDE paneli: geçerlilik başlangıcı destekleniyor mu ARAŞTIR (kod + docs/ide-smart). Destekliyorsa öner, UYGULAMA; raporda yaz.

## Ownership (yalnız bunlar)
convex/employees.ts (+ gerekiyorsa çalışan create/update lib dosyası), src/components/employees/**, src/**/employee*Schema*,
convex/lib/hikSyncEmployee.ts, convex/lib/gateway/persons.ts, ilgili *.test.ts dosyaları.

## Kapsam dışı
convex/lib/mobileAccess.ts (kapı zaten doğru) · mobil auth / login (ngsaccess-93'te, EMPLOYMENT_ENDED) · mobile/** · şema · Excel import ·
yeni "işe başlama tarihi" alanı · ziyaretçi akışı.

## Kurallar
- commit / push / deploy / migration / canlı DB yazma YOK. Canlıya `convex run` ile yazma YOK.
- Node modülü import eden convex dosyası "use node" ister; `node scripts/find-node-leak.mjs` temiz olmalı.
- Testler: create/update arg doğrulama (gün başı, null temizler, ziyaretçide yok sayılır/ret), Hik payload beginTime, form alanı.

## Kapılar
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
`node_modules/.bin/eslint src convex` · TAM `node_modules/.bin/vitest run` (src + convex) · `node scripts/find-node-leak.mjs`.

## Rapor (CEO'ya, ≤10 satır, file:line)
Değişen dosyalar (pathspec), kapı sonuçları, Hik beginTime kanıtı (test), IDE bulgusu, açık soru.

# Görev: SGK eksik gün kodları + eksik gün hesabını düzelt — Faz 0 / P2 + P3

Repo: /Users/emreaydin/ngsaccess (Convex backend + React). Önce `convex/_generated/ai/guidelines.md` oku.
Ön koşul: `convex/lib/trDate.ts` mevcut (trDateKey, trDayRangeISO, trTodayKey) — TR gün sınırı için ONU kullan.

## Hedef (test edilebilir)
`convex/sgkExport.ts` `buildAphbForMonth` doğru SGK eksik gün sayısı ve kodu üretir: tam ay çalışan personelde eksik gün 0; hafta tatili, resmi tatil (UBGT) ve ücretli izinler eksik gün sayılmaz; kodlar resmi SGK listesiyle uyumlu.

## Mevcut hatalar
1. `convex/lib/sgkCodes.ts` kod tablosu yanlış: "02" yok; "08" SGK'da Grev (kodda devamsızlık), "09" Lokavt, "10" Genel hayatı etkileyen olaylar, "11" Doğal afet, "12" Birden fazla neden; yıllık izin "21" ile eksik gün yazılıyor.
2. `sgkExport.ts:91-93` eksik gün = ay gün sayısı − çalışılan − izin → hafta sonu + resmi tatiller eksik gün oluyor.
3. super_admin'de tüm projelerin çalışanları tek işyerine; `args.projectId` çalışan filtresinde kullanılmıyor; `isActive=false` olup ay içinde okuması olan personel listede yok; boş `tcNo` sessizce geçiyor; gün anahtarı UTC.

## Resmi kod listesi (MUHSGK/APHB)
01 İstirahat · 03 Disiplin cezası · 04 Gözaltına alınma · 05 Tutukluluk · 06 Kısmi istihdam · 07 Puantaj kayıtları · 08 Grev · 09 Lokavt · 10 Genel hayatı etkileyen olaylar · 11 Doğal afet · 12 Birden fazla · 13 Diğer nedenler · 15 Devamsızlık · 16 Fesih tarihinde çalışmamış · 17 Ev hizmetlerinde 30 günden az · 18 Kısa çalışma ödeneği · 19 Ücretsiz doğum izni · 20 Ücretsiz yol izni · 21 Diğer belgeli nedenler · 22 Yarım çalışma ödeneği · 23 Yarım çalışma ödeneği ve diğer · 24 Diğer belgesiz nedenler · 25 İşçinin vefatı · 26 Kısmi istihdama izinli yabancı · 27 Kısa çalışma ödeneği ve diğer · 28 Pandemi ücretsiz izin · 29 Pandemi ücretsiz izin ve diğer.

## Değişiklik
1. `sgkCodes.ts`: tabloyu yukarıdaki listeyle değiştir (literal union tip). İzin eşlemesi: sick → 01; parental (analık izni, SGK ödeneği) → 01; unpaid → 21 (dilekçeli ücretsiz izin, belgeli) ; ücretli izinler (annual, marriage, bereavement, paternity, excuse, compensatory, lactation) → eksik gün DEĞİL (null). Devamsızlık → 15. Ay içinde birden fazla farklı neden → 12.
2. Yeni saf modül `convex/lib/sgkEksikGun.ts` + `convex/lib/sgkEksikGun.test.ts`: girdi = ayın günleri, çalışma günleri (generalSettings çalışma günleri; yoksa Pzt–Cum), tatil haritası, çalışılan günler (TR gün anahtarı), onaylı izinler; çıktı = { eksikGunSayisi, eksikGunNedeni, primGunu (aylık: 30 − eksik, alt sınır 0) }.
   Bir gün eksik sayılır ⇔ planlı iş günü AND resmi tatil değil AND okuma yok AND (izin yok → 15 | izin ücretsiz/rapor → ilgili kod). Hafta tatili ve UBGT asla eksik değil.
   Kapsam dışı (yorumla belgele, uygulama YOK): md. 46 hafta tatili ücreti hak etme kuralı, ay ortası işe giriş/çıkış (işe giriş tarihi alanı henüz yok), kısmi süreli çalışanlar.
3. `sgkExport.ts`: TR gün anahtarı/aralığı (`trDate.ts`); çalışan kümesi = seçilen projenin çalışanları (`args.projectId` zorunlu değilse non-super için allowedProjectIds[0], super_admin için projectId yoksa açık hata "Proje seçin"); ay içinde okuması olan pasif çalışanlar dahil; tcNo boşsa `warnings` listesine ekle. Dönüş tipi geriye uyumlu genişlesin: `{ xml, filename, warnings: string[] }`. Mevcut yetki denetimini KORU (allowedProjectIds dışındaki projeye erişim yok).
4. Frontend çağıran (grep `buildAphbForMonth` src/) yalnız `warnings` göstermek için minimal düzenlenebilir (toast/liste); başka UI değişikliği yok.

## Ownership (YALNIZ bunlara yaz)
convex/lib/sgkCodes.ts, convex/sgkExport.ts, convex/lib/sgkEksikGun.ts (yeni), convex/lib/sgkEksikGun.test.ts (yeni), buildAphbForMonth'u çağıran tek src bileşeni, convex/_generated/api.d.ts (yalnız `npx convex codegen` çıktısı).

## Kapsam dışı / DOKUNMA
cardReadings.ts, pdks*.ts, breakDeduction.ts, employeeCheckIn.ts, trDate.ts (yalnız import et), schema.ts (şema değişikliği YOK).

## Proje kuralları
TypeScript strict; `any`/`as any` YASAK → `unknown` + narrowing; `!` yerine erken return; `db.get` null filtrelerinde type guard. Türkçe yorum, mevcut stil.

## YASAK
commit / push / deploy (`npx convex dev`, `npx convex deploy`) / migration / canlı DB'ye yazma (Convex/Supabase MCP dahil) YOK. `npx convex codegen` serbest.

## Kapılar
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint src convex   (0 error)
npx vitest run

## Rapor
worker_done özetinde ≤10 satır: file:line, kod eşleme kararları, kapsam dışı bırakılanlar, kapı sonuçları.

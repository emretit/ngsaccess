# Convex sorgu sınırı düzeltmeleri (item #343)

## Hedef
`docs/convex-audit/CONVEX_OLCEK_2026-11-27.md` §2 Engel E1–E5 ve D7: hiçbir sorgu veri büyüdükçe tek transaction'da
16 MiB / 32.000 belge / 4.096 index aralığı sınırına doğru büyümesin; her biri index aralığıyla sınırlı ve testli olsun.
Önce raporu oku.

## Ownership (yalnız bunlar + kendi test dosyaları)
`convex/dashboard.ts`, `convex/lib/pdksTableQuery.ts`, `convex/lib/pdksPayrollQuery.ts`, `convex/shifts.ts`,
`src/hooks/useDashboard.ts` ve bunları çağıran ön yüz bileşenleri (yalnız gerekirse, arg değişikliği için).
Main'de başka worker'ların commit'siz işi var (Kişiler/Hik: employees*, hik*, schema.ts, peopleHikSnapshot vb.) — DOKUNMA.

## Kurallar
- `convex/schema.ts`'e dokunma. Yeni index/tablo gerekiyorsa (ör. E1 için aylık özet tablosu) DUR, tasarımı
  (alan, index, backfill gereği, mevcut veriyle davranış) `orchestration ask` ile koordinatöre sor.
- Mevcut index'lerle çözülebileni çöz: aralıksız `by_access_time`/`by_project` + `.filter` → `by_project_access_time` aralığı;
  tüm-tenant `leaves`/`departments` taraması → proje index'i; `.collect()` → sınırlı/sayfalı ya da kişi başı index'li parça.
- Davranış değişmesin (aynı sonuç), değişiyorsa raporda açıkça yaz. Super_admin "proje seçilmemiş" görünümü için makul
  sınır (ör. son N gün / sayfalı) seç, gerekçesini yaz.
- `npx convex ...` ÇALIŞTIRMA (canlıya push eder). commit/push/deploy/migration/DB yazma YOK.
- Makine yüklü: tam `vitest` ve `tsc` koşma (koordinatör koşar). Yalnız ilgili test dosyaları + değişen dosyalarda eslint.

## Kapılar (senin koşacakların)
`npx vitest run <değişen/ilgili test dosyaları>` · `npx eslint <değişen dosyalar>`. Her Engel için en az bir test:
sınır aşacak hacimde fixture (ör. 40.000 okuma yerine index aralığının dışında kalanlar okunmuyor mu) ya da okunan belge
sayısının sabit/sınırlı kaldığını gösteren test.

## Rapor (worker_done, ≤10 satır)
Her Engel: ne değişti (file:line), davranış farkı, test. Çözülemeyen/şema isteyen kalemler ayrı satırda.

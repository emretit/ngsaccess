# UI Audit 2 düzeltme — __TITLE__

## Hedef
`__REPORTS__` raporundaki şu bulguları düzelt: __DO__.
Rapor sonundaki **"Kararlar (Emre)"** bölümü bağlayıcıdır. Bitti = listelenen her bulgu düzeltildi (ya da raporda gerekçeyle "yapılamadı") + kapılar yeşil.
__NOTES__

## Bağlam
Repo: /Users/emreaydin/ngsaccess (React + Vite + TS strict, Convex). Arayüz metinleri Türkçe, sade, cümle düzeni.
Proje kuralları: `any`/`as any` YASAK (eslint error) → `unknown` + daraltma; `!` non-null yerine optional chaining + erken dönüş;
Convex alanları camelCase, snake_case yeniden mapleme yok; `db.get` sonuçlarında `filter((p): p is NonNullable<typeof p> => p !== null)`.
Convex kodu yazacaksan önce `convex/_generated/ai/guidelines.md` oku.
Ortak yardımcılar (Adım 0'da hazırlandı, KULLAN, değiştirme): `formatTrDateTime`/`formatTrDate` (`src/lib/date.ts`, Europe/Istanbul),
`todayInTurkey` (`src/lib/date.ts`), `deviceBrandLabel` (`src/lib/deviceBrand.ts`), `EmptyState` `live` prop'u, `ui/checkbox` (24px tıklama alanı),
`DeviceSyncStatusBanner`, `UnsavedChangesDialog` ("Düzenlemeye dön"/"Kaydetmeden çık"), `TimeSchedule` + `weekdays`.
Aynı çalışma ağacında başka worker'lar paralel çalışıyor: yalnız Ownership'teki dosyalara yaz.

## Ownership (yalnız bunlar + bunların test dosyaları + yeni dosyalar bu dizinlerde)
__OWN__

## Kapsam dışı
__OUT__
`convex/schema.ts` koordinatörde: yeni index gerekirse YAZMA, `ask` ile iste (tablo, index adı, alanlar, neden) ve cevabı bekle.
`src/components/shared/**`, `src/components/ui/**`, `src/lib/date.ts`, `src/lib/deviceBrand.ts` değiştirilmez (gerekirse `ask`).

## Kapılar (hepsi yeşil; sayıları rapora yaz)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata (başka worker'ın yarım dosyası yüzünden hata çıkarsa dosya adını raporla, onu düzeltme)
- `node_modules/.bin/eslint __LINT__` → 0 error
- `node_modules/.bin/vitest run __TESTS__` → yeşil
- Davranış değişikliği olan her düzeltme için en az bir test (mevcut test dosyasına ekle ya da yeni).

## Yasak
commit / push / deploy / migration / Convex DB yazma YOK. `npx convex dev|deploy|run` YOK. Paket ekleme YOK. Tarayıcıda veri değiştiren işlem YOK.

## Rapor (worker_done, ≤10 satır)
Bulgu ID → yapılan + `file:line` (kısa); yapılamayanlar ve nedeni; kapı sonuçları. Tam dosya listesi `--files-modified` ile.

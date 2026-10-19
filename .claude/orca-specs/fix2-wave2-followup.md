# UI Audit 2 — Dalga 2 denetim takibi (R2-D2 … R2-D5 + küçük notlar)

## Hedef
`docs/ui-audit-2/review-wave2.md` denetim raporundaki şu bulguları düzelt: R2-D2, R2-D3, R2-D4, R2-D5, R2-N5, R2-N8. (R2-D1 = deploy sırası, koordinatörde; dokunma.) Raporun "öneri" sütunu yol gösterir; bağlayıcı kararlar `docs/ui-audit-2/{06,09,12}-*.md` "Kararlar (Emre)" bölümlerinde. Bitti = altı bulgu düzeltildi + testlerle kanıtlandı + kapılar yeşil.
- R2-D2: `definitionImpacts` hatası tüm "Vardiya tanımları" panelini düşürmesin. Sayaç kendi küçük alt bileşeninde + `QuerySectionBoundary`; hata/`skip`te satırda "Sayı yüklenemedi", panel + Yeni vardiya/Düzenle/Etkinleştir çalışmaya devam. Sunucu tek bozuk kayıtta (başka proje) tüm projeyi reddetmesin: o kaydı atla.
- R2-D3: paylaşılan 5000 okuma bütçesi bitince sonraki tanımlar "En az 0" göstermesin ve silme düğmesi kapanmasın. Bütçesi biten tanım: sayı yerine "Hesaplanamadı"; silme etkisi tek tanım için mevcut `assignmentDeleteImpact` sorgusuyla istenir (silme diyaloğu açılınca). En azından "ataması var/yok" için index'li `take(1)`. `shiftAssign.test.ts:302-308` testi yeni davranışa göre güncelle.
- R2-D4: `convex/visitors.ts` `listPage`/`summary`: `now = clamp(args.now ?? Date.now(), Date.now() - 5 dk, Date.now() + 5 dk)`; test: aşırı `now` kırpılıyor.
- R2-D5: `src/components/audit/auditLabels.ts` alan etiketleri: `visitorKvkkUrl` "Ziyaretçi aydınlatma metni bağlantısı", `visitorKvkkVersion` "Ziyaretçi aydınlatma metni sürümü", `documentVersion` "Belge sürümü". `auditLabels.test.ts`'e: `convex/` altındaki `writeAudit` çağrılarının `oldValue`/`newValue` nesne anahtarlarını tarayıp etiketsiz alan kalmadığını doğrulayan test (statik tarama yeterli; çıkarılamayan dinamik anahtarları atla).
- R2-N5: `WeekdaySelection.tsx` `role="group"` üzerindeki `aria-invalid`'i kaldır (hata `aria-describedby` ile bağlı kalsın); `ShiftCalendarGrid.tsx:71` rolsüz `<span aria-label>` yerine `<abbr title>` ya da görünmez tam tarih metni (`sr-only`).
- R2-N8: manuel pasif yapılmış kayıt etiketi "Sonlandırıldı / pasif" (ya da durum açıklamasında pasif olduğu belli olsun); sayaç ve liste tutarlı kalsın.

## Bağlam
Repo: /Users/emreaydin/ngsaccess (React + Vite + TS strict, Convex). Arayüz metinleri Türkçe, sade, cümle düzeni.
Proje kuralları: `any`/`as any` YASAK (eslint error) → `unknown` + daraltma; `!` non-null yerine optional chaining + erken dönüş;
Convex alanları camelCase, snake_case yeniden mapleme yok; `db.get` sonuçlarında `filter((p): p is NonNullable<typeof p> => p !== null)`.
Convex kodu yazacaksan önce `convex/_generated/ai/guidelines.md` oku.
Ortak yardımcılar (Adım 0'da hazırlandı, KULLAN, değiştirme): `formatTrDateTime`/`formatTrDate` (`src/lib/date.ts`, Europe/Istanbul),
`todayInTurkey` (`src/lib/date.ts`), `deviceBrandLabel` (`src/lib/deviceBrand.ts`), `EmptyState` `live` prop'u, `ui/checkbox` (24px tıklama alanı),
`DeviceSyncStatusBanner`, `UnsavedChangesDialog` ("Düzenlemeye dön"/"Kaydetmeden çık"), `TimeSchedule` + `weekdays`.
Aynı çalışma ağacında başka worker'lar paralel çalışıyor: yalnız Ownership'teki dosyalara yaz.

## Ownership (yalnız bunlar + bunların test dosyaları)
`src/components/shifts/**`, `convex/shifts.ts`, `convex/lib/shiftAssign.ts`, `convex/lib/shiftUx.ts`, `convex/visitors.ts`, `convex/lib/visitorStatus.ts`, `src/components/visitors/**`, `src/hooks/useVisitors.ts`, `src/components/audit/auditLabels.ts`

## Kapsam dışı
PDKS (`convex/lib/pdks*.ts`, `src/components/pdks/**`, `convex/cardReadings.ts`) ve Raporlar — paralel worker'larda. `convex/lib/auditLogQuery.ts` (koordinatörde). Kart okutma / cihaza yazma mantığı. 09 kararları: tek gün istisnası YOK, mobilde ajanda kalır, 09-O7 sayfa boyutu ölçüme kaldı.
`convex/schema.ts` koordinatörde: yeni index gerekirse YAZMA, `ask` ile iste. `src/components/shared/**`, `src/components/ui/**`, `src/lib/date.ts` değiştirilmez.

## Kapılar (hepsi yeşil; sayıları rapora yaz)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata (başka worker'ın yarım dosyası yüzünden hata çıkarsa dosya adını raporla, onu düzeltme)
- `node_modules/.bin/eslint src/components/shifts src/components/visitors src/components/audit src/hooks/useVisitors.ts convex/shifts.ts convex/visitors.ts convex/lib/shiftAssign.ts convex/lib/shiftUx.ts convex/lib/visitorStatus.ts` → 0 error
- `node_modules/.bin/vitest run src/components/shifts src/components/visitors src/components/audit convex/lib/shiftAssign.test.ts convex/lib/shiftUx.test.ts convex/lib/visitorStatus.test.ts` → yeşil

## Yasak
commit / push / deploy / migration / Convex DB yazma YOK. `npx convex dev|deploy|run` YOK. Paket ekleme YOK. Tarayıcıda veri değiştiren işlem YOK.

## Rapor (worker_done, ≤10 satır)
Bulgu ID → yapılan + `file:line`; yapılamayanlar ve nedeni; kapı sonuçları. Tam dosya listesi `--files-modified` ile.

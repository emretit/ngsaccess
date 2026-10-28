# Geçiş Kontrol Dalga 3 — C1: Kapı planı formu (etkin değil, hafta içi, mobil uzunluk)

## Hedef
Kapı planı formunda kapalı plan alanları uygulanacakmış gibi görünmez, hafta içi düzeni tek seçimle kurulur, ve mobilde form kısa kalıp kaydet düğmesine kolay ulaşılır.

## Ownership (yalnız bunlar; testleri dahil)
- src/components/access-control/door-plans/DoorPlanDialog.tsx (+ DoorPlanDialog.test.tsx), DoorPlanImpactSummary.tsx (+ test)
- src/components/access-control/door-dialog/DoorStatusPlanSection.tsx, DoorVerifyPlanSection.tsx, DoorVerifyPlanEditor.tsx (+ DoorVerifyPlanEditor.test.tsx)
- src/components/access-control/DoorStatusPlanEditor.tsx (+ DoorStatusPlanEditor.test.tsx)
Kapsam dışı: DoorPlansTab.tsx, CopyDoorPlansDialog.tsx, bulk.ts (C2), unified/ (A/B/D), convex/ (backend ve plan şekli değişmez; `convex/lib/doorStatusPlan.ts` yalnız okunur).

## İstenenler
1. **04-O1:** Plan anahtarı kapalıyken saat/mod alanları gizli ya da devre dışı; yerine "Plan etkin değil" + kısa özet. Anahtarın yanında metinsel "Açık"/"Kapalı". Açınca alanlar mevcut değerleriyle görünür (değerler kaybolmaz). Kaydet payload'u ve etki özeti davranışı değişmez.
2. **04-O4:** Plan düzenine "Hafta içi" seçeneği (Pzt–Cum aralık, Cmt–Paz normal/plan yok) ya da gün bazında hızlı "Hafta içi" toplu seçim; gün bazına geçişte varsayılan yedi güne yayılmasın veya hafta sonu açıkça görünsün. Etki özeti hafta sonu davranışını söylesin ("Cmt–Paz normal çalışır").
3. **04-O7 mobil:** Kapalı planlar daraltılmış; gün bazında günler açılır/kapanır bölümlerde (ya da kompakt), dialog alt eylem alanı (İptal / Kaydet ve cihaza gönder) mobilde yapışkan. 390px'te yatay taşma yok.

## Kabul
- Test: anahtar kapalıyken saat input'ları render edilmez ya da disabled; "Plan etkin değil" görünür; açınca eski değerler geri gelir.
- Test: "Hafta içi" seçimi kaydet payload'unda yalnız Pzt–Cum segmentleri üretir ve özet hafta sonunu belirtir.
- Mevcut DoorPlanDialog (04-H1*, R1-R4, GK-1, tatil önizleme) / DoorPlanImpactSummary / DoorVerifyPlanEditor / DoorStatusPlanEditor testleri yeşil.

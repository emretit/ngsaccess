# C2b W-09-api — 09 Vardiyalar backend: aralık-sınırlı atama sorgusu + toplu atama önizlemesi + silme etkisi
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) ve `convex/_generated/ai/guidelines.md` oku. Bağlam:
`docs/ui-scan/pages/09-vardiyalar/REPORT.md` ("Atama formu: tekli ve toplu", "Atama ayrıntısı ve düzenleme", "Backend gereksinimi" 1-2).
Açık soru varsayılanları (00_OZET §5): toplu atamada çakışanları atla + diğerlerini kaydet (kısmi sonuç kalıcı gösterilir, sessiz
tekrar yok) · tek gün istisnası KAPSAM DIŞI · tanım değişikliği geçmiş atamaları da etkiler (etki özeti gösterilir, sürümleme yok).

## Hedef (test edilebilir)
Takvim yalnız görünür aralığın (gece taşması için bir önceki gün dahil) atamalarını sınırlı okur; toplu atama öncesi read-only
önizleme kişi bazında ne olacağını söyler ve apply aynı mantıkla yeniden doğrular; silme etkisi doğru sayılır. Eski imzalar kırılmaz.

## İş
1. `convex/shifts.ts` (`listAssignments`, `assignShift`, `updateAssignment`, `bulkAssignShift`, `removeAssignment`, `bulkRemoveAssignment`)
   + `shiftAssignments` şeması + onaylı izin/tatil kaynaklarını oku. `calendarConfirmed` ve SHF-UI-20 fiili gün/izin mantığını bul.
2. **`listAssignments` aralık kapsamı:** opsiyonel `rangeStart`, `rangeEnd` (YYYY-MM-DD, TR) ve `employeeIds?` arg'ları; verilirse
   yalnız aralıkla kesişen atamalar (+ bir önceki gün başlayan gece vardiyaları). Index planı: mevcut index'lerle mümkün değilse
   (ör. `by_project_start` / `by_project_end`) `ask` ile tam tanım iste. Arg verilmezse ESKİ davranış (eski frontend).
3. **Ortak çakışma mantığı** saf `convex/lib/shiftAssign.ts` (+test): bir kişi + tarih aralığı + hafta deseni için sonuç
   `will_assign | conflict (mevcut atama bilgisi) | on_leave | holiday | skipped (sebep)`; gece vardiyası iki güne dağılımı; hafta
   deseni eşleşmesi. `bulkAssignShift` bu fonksiyonu kullanacak şekilde refactor (davranış: çakışanları atla, diğerlerini kaydet — aynı).
4. **`shifts.previewBulkAssign({ projectId, shiftId, employeeIds, startDate, endDate?, weekPattern? })`** read-only query: kişi bazlı
   sonuç listesi + özet sayılar. Bounded: employeeIds ≤ makul sınır (mevcut bulk sınırıyla aynı), aşılırsa ConvexError.
5. **`bulkAssignShift` sonucu:** apply anında aynı mantıkla yeniden doğrula; dönüşe kişi bazlı sonuç (`assigned | skipped_conflict |
   skipped_leave | failed`) ekle (mevcut dönüş alanlarını koru, yeni alan ekle) → frontend kalıcı kısmi sonuç gösterir.
6. **`shifts.assignmentDeleteImpact({ shiftId })`** (veya `assignmentIds`): tanım/atama silmenin etkileyeceği atama ve kişi sayısı —
   keyfi `take()` ile eksik sayma YOK; sınır aşılırsa `truncated: true` + "en az N" dürüst sayı.
7. Tanım güncellemesi (`shifts.update`) için etki: o tanımı kullanan aktif/gelecek atama sayısı (`shifts.definitionUsage({ shiftId })`).

## Ownership
convex/shifts.ts · yeni convex/lib/shiftAssign.ts (+test) · convex/_generated/api.d.ts (kendi satırların)

## Kapsam dışı
Frontend · tek gün istisnası/seri bölme · tarihsel sürümleme · PDKS vardiya hesabı (C2a lib'leri) · leaves.ts (yalnız oku) · schema.ts (ask).

## Rapor
`.claude/orca-specs/reports/c2b-09-api.md`: tüm yeni/değişen fonksiyon arg+dönüş tipleri, sonuç enum'ları + Türkçe etiketleri,
gece vardiyası ve izin kuralları, index durumu, bulk sınırı.

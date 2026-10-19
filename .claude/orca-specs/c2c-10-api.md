# C2c W-10-api — 10 İzinler backend: doğrulama, örtüşme kuralı, düzenleme, dönem/tür/kişi filtreli cursor liste
Önce `.claude/orca-specs/c2c-common.md` (→ c2-common.md) ve `convex/_generated/ai/guidelines.md` oku. Bağlam:
`docs/ui-scan/pages/10-izinler/REPORT.md` ("Filtre ve durum sözleşmesi", "Form ve detay", "PDKS etkisi", "Backend gereksinimi" 1-3).

## Hedef (test edilebilir)
İzin oluşturma ve yeni düzenleme sunucuda gerçek ISO tarih + aralık sırası + kişi/proje yetkisi + mükerrer/örtüşme kuralıyla doğrulanır;
liste proje kapsamlı, dönem kesişimi/tür/kişi filtreli ve cursor'la sayfalanır; eski `leaves.list`/`listForRange`/`create`/`approve`/`reject`
imzaları çalışmaya devam eder.

## İş
1. Saf `convex/lib/leaveValidation.ts` (+test): `YYYY-MM-DD` gerçek takvim tarihi (2026-02-30 red), start ≤ end, makul üst sınır
   (ör. tek kayıt ≤ 366 gün, gerekçeli), kapsayıcı takvim günü sayısı (`calendarDays`), aralık kesişimi (`overlaps`). Hata mesajları
   rapordaki Türkçe metinlerle; frontend aynı kodları gösterebilsin diye kararlı hata kodu (ör. `LEAVE_INVALID_DATE`,
   `LEAVE_RANGE_REVERSED`, `LEAVE_OVERLAP`, `LEAVE_TOO_LONG`) — `ConvexError({ code, message, conflictLeaveId? })` tercih et
   (mevcut projede ConvexError kullanımı varsa onu izle; yoksa raporda tek kalıbı yaz).
2. **Örtüşme kuralı:** aynı kişide `approved` (ve dikkate alınacaksa legacy `pending`) bir kayıtla tarih kesişimi varsa create/update
   reddedilir; çakışan kaydın id + aralığı hata verisinde döner. `rejected` engellemez. Sorgu `by_employee_start` ile sınırlı
   (startDate ≤ yeni end olanlar; endDate ≥ yeni start süzgeci). Kural create ve update'te AYNI fonksiyon.
3. `create`: imza korunur; yukarıdaki doğrulamayı ekle. İdempotent tekrar gönderim: aynı kişi+tür+aralık zaten approved ise ikinci kayıt
   açılmaz (örtüşme kuralı zaten yakalar — testle kanıtla).
4. **Yeni `leaves.update` (adminMutation):** `{ leaveId, leaveType?, startDate?, endDate?, notes?: string | null, expectedUpdatedAt: string }`.
   Kişi/proje SABİT; yalnız `approved` kayıt düzenlenir (pending/rejected → `LEAVE_READ_ONLY`). `notes: null` açıkça temizler,
   `undefined` dokunmaz (mevcut `nullablePatch/toPatch` yardımcılarını kullan). `expectedUpdatedAt` uyuşmazsa `LEAVE_STALE` (yarış).
   `updatedAt` yenilenir. Yetki: create ile aynı (kaydın projesi kullanıcı kapsamında). Mevcut audit altyapısı izinlere yazıyorsa
   (grep `auditLog` insert yardımcıları) update'i de aynı yolla kaydet; yoksa YENİ audit yazımı ekleme, raporda belirt.
5. **Yeni `leaves.listPage` (authedQuery):** `{ projectId, rangeStart, rangeEnd, leaveType?, employeeId?, status?, paginationOpts }`.
   Kesişim `startDate ≤ rangeEnd && endDate ≥ rangeStart`; sıra başlangıç azalan, eşitlikte kararlı. Index stratejisini sen seç
   (`by_project_start` desc + `endDate ≥ rangeStart` süzgeci; kesişim süzgecinin taradığı aralığı tek kayıt üst sınırıyla sınırla).
   Satır AÇIK alanlarla: `_id, employeeId, employeeName, departmentName?, employeeMissing: boolean, leaveType, startDate, endDate,
   calendarDays, status, notes?, createdAt, updatedAt`. Kişi/departman yüklemesi tekilleştirilmiş (sayfa başına bir kez).
   Yetki `resolveProjectScope`; kapsam dışı proje → boş değil hata/null (mevcut sayfa kalıbını izle, raporda yaz).
6. **Yeni `leaves.summary` (opsiyonel, bounded):** aynı filtre kümesinde kayıt sayısı + distinct kişi sayısı; üst sınır + `truncated`.
   Frontend "kesin toplam" yalnız `truncated=false` iken gösterir.
7. **Hafif kişi seçici:** mevcut employees sorgularından projeye bağlı aktif kişi listesi varsa onu raporda göster; yoksa
   `leaves.employeeOptions({ projectId, search? })` (≤50, ad/departman) ekle.
8. `listForRange`'in tam `.collect()` taramasını yeni index'le sınırla (imza + dönüş ŞEKLİ aynı kalmalı — Vardiyalar takvimi tüketiyor).

## Ownership
convex/leaves.ts · yeni convex/lib/leaveValidation.ts (+test) · convex/lib/leaveRules.ts (gerekirse) · convex/_generated/api.d.ts (kendi satırların)

## Kapsam dışı
Frontend · saatlik/yarım gün · bakiye/hak ediş · talep/onay iş akışı · PDKS hesap mantığı (`cardReadings.ts`, `pdksCalc.ts`) · schema.ts (ask).

## Rapor
`.claude/orca-specs/reports/c2c-10-api.md`: listPage/summary/update/employeeOptions arg+dönüş tipleri, hata kodları + Türkçe mesajlar,
örtüşme kuralının tam tanımı (pending dahil mi), notes temizleme sözleşmesi, tarama sınırları, PDKS'nin değişikliği reaktif görüp görmediği.

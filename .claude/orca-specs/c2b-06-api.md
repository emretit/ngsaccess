# C2b W-06-api — 06 Ziyaretçiler backend: asgari liste + ayrıntı + sayfalama + doğru özet
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) ve `convex/_generated/ai/guidelines.md` oku. Bağlam:
`docs/ui-scan/pages/06-ziyaretciler/REPORT.md` ("Durum sözleşmesi", "Kayıt, kart yakalama ve ayrıntı", "Backend gereksinimi" 1, 2, 4).

## Hedef (test edilebilir)
Ziyaretçi listesi açık ve asgari alanlarla, proje kapsamlı, cursor'la sayfalanır; özet sayaçlar listeden bağımsız ve doğru;
seçili ziyaretçinin ayrıntısı ayrı yetkili sorguyla gelir; pasif kayıt düzenleme kuralları sunucuda. Eski `visitors.list` çalışmaya devam eder.

## İş
1. `convex/visitors.ts` + mevcut yardımcıları oku (`visitorPresence`, durum sınıflaması, `employeeConsents` visitor_kvkk, `presetRules`).
   Ziyaretçiler `employees` tablosunda `isVisitor=true` (`by_project_visitor` index'i).
2. **Durum sözleşmesi tek yerde:** saf `convex/lib/visitorStatus.ts` (+test): rapordaki durumlar (ör. bekleniyor/içeride/ayrıldı/
   süresi doldu/pasif) — TR saatiyle, zamanla değişen expiry dahil. Liste, özet ve ayrıntı aynı fonksiyonu kullanır.
3. **`visitors.listPage({ projectId, status?, search?, paginationOpts })`**: Convex `paginate`; dönüş satırı AÇIK alan listesi
   (employee doc spread YOK): `_id, firstName, lastName, company?, cardNumber (maskeleme gerekiyorsa raporla), hostName?, presetRuleName?,
   visitStart?, visitEnd?, status, lastSeenAt?, lastDirection?, hasKvkkConsent`. Hassas alanlar (TC, telefon, e-posta, not) listede YOK.
   Arama: sunucuda Türkçe küçük harf ad/soyad/şirket/kart (search index yoksa sayfa içi süzme + dürüst `searchScope` bilgisi; index
   gerekiyorsa `ask` ile searchIndex tanımı iste). Status filtresi index'le yapılamıyorsa sayfa içi süzme ve raporda açıkça yaz.
4. **`visitors.summary({ projectId })`**: durum başına sayılar; bounded (makul üst sınır + `truncated` bayrağı). Geçici 0 yok — frontend
   `undefined` iken iskelet gösterir.
5. **`visitors.getDetail({ visitorId })`**: yetki (`resolveProjectScope`), yoksa `null`; hassas alanlar burada; ev sahibi, kural, rıza
   (sürüm/tarih), son okumalar (≤10, `by_employee_status_time`), kart geçmişi gerekiyorsa sınırlı.
6. **Pasif kayıt düzenleme (`update`):** değişmeyen geçmiş bitiş tarihi gönderilmezse hata verme; yeniden aktifleştirmede sunucu etkin
   bitişi yeniden doğrular (geçmiş tarihle aktifleşmez). TR saat doğrulaması ortak yardımcıyla. Mevcut imzayı KIRMA (opsiyonel arg olabilir).
7. Bölge değişimi (presetRuleId güncelleme) KAPSAM DIŞI — düzenlemede bölge kapalı kalır.

## Ownership
convex/visitors.ts · yeni convex/lib/visitorStatus.ts (+test) · gerekirse yeni convex/lib/visitorList.ts (+test) · convex/_generated/api.d.ts (kendi satırların)

## Kapsam dışı
Frontend · bölge değişimi mutation'ı · kişi bazlı cihaz sync korelasyonu · cardReadings.ts · employees.ts · schema.ts (ask).

## Rapor
`.claude/orca-specs/reports/c2b-06-api.md`: listPage/summary/getDetail arg+dönüş tipleri, durum enum'u + Türkçe etiketleri ve renk tonu
önerisi (success/info/warning/neutral), arama/süzme kapsamı (sunucu mu sayfa içi mi), update değişikliği.

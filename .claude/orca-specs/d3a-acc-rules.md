# Dalga 3a — ACC UX-1A: Erişim kuralı listesi arama, kapsam özeti ve hafif liste

**Hedef:** Erişim kuralları listesi "hangi kapıya/panelin tamamına yetkili?" sorusunu doğrudan cevaplar (tek kapı ↔ tüm panel ayrımı, `groupDoors` görünür), kural/kişi/kapı adıyla aranır ve durumla filtrelenir, liste özet verisiyle hızlı yüklenir ve ayrıntı yalnız kart açılınca gelir; departman seçimi alt departmanları doğru kapsar; tüm ikon/switch'ler erişilebilir adlıdır.

(Rapor: `docs/ux-audit/02_GECIS_IZLEME_ZIYARETCI.md` §3 ACC-05/06/07/08 + §5 UX-1 "1A". Ortak kurallar aşağıda.)

## Bulgular
1. **ACC-05** — Kural özeti ve ayrıntısı kapıları (`groupDoors`) gösterir; bir panelde tek kapı ile tüm kapılar farklı özetlenir ("Panel X — 1/4 kapı" vs "Panel X — tüm kapılar").
2. **ACC-06** — Departman seçimi: alt departmanları dahil etme açık seçenek/varsayılan rapordaki öneriye göre; kısmi seçim (indeterminate) doğru; bölge checkbox'ı cihaz üyeliği yerine kapı kapsamına göre tam/kısmi. Saf seçim mantığı `selectionHelpers.ts` + vitest. "Sonradan katılanlar otomatik kapsanmıyor" ürün kararı gerektiriyorsa (dinamik departman üyeliği = UX-2) yalnız UI'da açıkça belirt: "Seçim anındaki kişiler eklenir".
3. **ACC-07** — Kurallar sayfası için YENİ `accessRules.listSummaries` (hafif özet: ad, durum, sayılar, kapı/panel özeti; sunucu tarafı ad araması + durum filtresi + cursor sayfalama) ve `accessRules.getDetails({ ruleId })` (üye/cihaz/kapı ayrıntısı yalnız açılan kartta). Mevcut `accessRules.list` sözleşmesini DEĞİŞTİRME — personel formu (`EmployeeForm.tsx`, `useEmployeeFormData.ts`) kural seçici olarak kullanıyor. Kişi/kapı adıyla arama index'le yapılamıyorsa: kural adı için search index iste (`ask` → koordinatör `searchIndex` ekler) ve kişi/kapı araması için ters sorgu (groupMembers.by_employee / groupDoors) kullan. Dalga 2b ilişki doğrulamalarını koru.
4. **ACC-08** — Kural switch'i ve düzenle/sil/aç ikonları adlı; tek `Collapsible` kökü, `aria-controls` gerçek içerik; ağaç açma düğmeleri ≥32px ve adlı.
5. Sahip olduğun dosyalarda tasarım sistemi göçü.

## Ownership (yalnız bunlara yaz)
convex/accessRules.ts · convex/lib/accessRuleSummary*.ts (yeni + test) · src/components/access-control/unified/** (AccessRulesList, UnifiedAccessControl, UnifiedRuleTable, CreateRuleDialog, components/**, hooks/**) · src/components/access-control/unified/AccessRuleDetails.tsx (yeni) · src/hooks/access-rules/** · src/types/access-control.ts · src/components/access-control/{GroupDevicesManager,GroupMembersManager,UnifiedAccess,AccessControlSidebar}.tsx

## Kapsam dışı
Canlı izleme / kart okuma / ziyaretçi (Dalga 3b ACC-live) · ZoneDoorTree (DEV-tree worker) · schema.ts (koordinatör) · ortak bileşenler (SHL) · dinamik departman üyeliği (UX-2).

2026-10-27 kararları ve düzeltme dalgalarındaki 49 kimlikli bulgu, 2026-11-05 çalışma ağacında salt kod incelemesiyle doğrulandı; kod değişmedi, tarayıcı ve test çalıştırılmadı. Sonuç: **Yapıldı: 27 · Kısmen: 3 · Yapılmadı: 6 · Geçersiz: 13**; Belirsiz: 0 (01-D4/02-O6 aynı eksik işin iki kaynak kimliğidir).

Kanıt yolları depo köküne göredir: **U/** = `src/components/access-control/unified/`, **S/** = `src/components/access-control/unified/status/`, **D/** = `src/components/access-control/door-plans/`. Kaynaklar: `00_OZET.md` dalgaları ve dört sekmenin bulgu/karar bölümleri; `sadelestirme/*.md`, `.claude/plan-gk-sadelestirme.md`, `.claude/handoff-gk-sadelestirme.md` sonraki karar bağlamı için okundu. Yapıldı, ilgili davranışın kodda bulunduğunu belirtir; canlı cihazda çalıştığı iddiası değildir.

Şablon kaldırılması ayrıca `src/` ve `convex/` içinde `accessScheduleTemplates`, `scheduleTemplateId`, `hikDoorStatusTemplateId`, `TemplatePicker` adlarıyla tarandı; etkin tablo/bileşen yolu kalmaması Geçersiz değerlendirmesinin temelidir. Sadeleştirme belgelerindeki sonradan önerilen yeni işler 2026-10-27 eski karar listesine ek karar gibi sayılmadı.

| Karar ID | Karar | Durum | Kanıt (file:line) | Eksik/not |
|---|---|---|---|---|
| 01-H1 | Seçili zaman kaynağı belirgin olsun | Geçersiz | U/UnifiedAccessControl.tsx:61; U/components/TimeSchedule.tsx:32 | Şablon kaynağı silindi; artık tüm gün/saat aralığı seçiliyor. |
| 01-H2 | Çevrimdışı cihazda otomatik yeniden gönderim ve sonuçtan yeniden deneme | Kısmen | convex/lib/deviceConnection.ts:46; U/SyncRuns.tsx:82; U/SyncRuns.tsx:299; U/lib/presentation.ts:79 | Sıfır teslim Gönderilemedi; kayıt sonrası Cihazlara gönder var. Sonuç ekranında yeniden gönder yok; bağlantı dönüşü yalnız olay/alarm kaydediyor, kural senkronu tetiklemiyor. Hik kuyruğu retry mekanizması bu kapsamın tamamını karşılamaz. |
| 01-O1 | Departman üyeliği dinamik olsun | Yapılmadı | U/components/DepartmentTree.tsx:216 | Koordinatörün doğruladığı anlık kişi seçimi; talimat gereği yeniden araştırılmadı. |
| 01-O2 | Dar ekranda özel saat bilgisi görünsün | Yapıldı | U/rules-list/RuleRow.tsx:84 | Gün ve saat alt satırı var. |
| 01-O3 | Kişi/kapı arama seçimi keşfedilsin | Yapıldı | U/rules-list/RulesFilters.tsx:28; U/rules-list/RulesFilters.tsx:49 | Arama alanı etiketi ve alana göre placeholder var. |
| 01-O4 | Gönderim ve seçim metinleri sadeleşsin | Yapıldı | U/SyncRuns.tsx:111; U/CreateRuleDialog.tsx:55 | Cihaz bildirimi sade; tüm cihaz seçimi özeti var. |
| 01-O5 | Boş şablon seçicisine çıkış verilsin | Geçersiz | U/components/TimeSchedule.tsx:32 | Şablon seçici kaldırıldı. |
| 01-O6 | Ayrıntıdan düzenleme açılsın | Yapıldı | U/rules-list/RuleRow.tsx:156 | Düzenle düğmesi var. |
| 01-O7 | Son gönderim sıfır sayaç gürültüsü kalksın | Yapıldı | U/SyncRuns.tsx:130; U/lib/presentation.ts:79 | Son gönderim satırı ve sorunlu hedef ayrıntıları kullanılıyor. |
| 01-O8 | Arayüzde panel yerine cihaz kullanılsın | Yapıldı | U/AccessRuleDetails.tsx:25; U/CreateRuleDialog.tsx:55 | Geçiş kontrol TSX taramasında kalan panel sözcükleri değişken/yorum; görünür kapsam cihaz. |
| 01-D1 | Mobil sekmeler kaydırılabilir ve 44 px olsun | Yapıldı | U/UnifiedAccessControl.tsx:61 | flex-nowrap, overflow-x-auto, min-h-11. |
| 01-D2 | Sayfa içi kural sayacı kaldırılsın | Yapıldı | U/AccessRulesList.tsx:64 | Eski Bu sayfada N kural metni yok. |
| 01-D3 | Tekrarlanan adım başlıkları sadeleşsin | Yapıldı | U/CreateRuleDialog.tsx:152; U/CreateRuleDialog.tsx:202 | İki adımlı form; ağaçlar erişilebilir adla sunuluyor. |
| 01-D4 | Kuralda gece saatini otomatik böl | Yapılmadı | U/hooks/useAccessRuleSchema.ts:80; convex/lib/accessRuleUx.ts:10; convex/lib/ruleSchedule.ts:23 | 22:00–06:00 hem formda hem backend doğrulamasında reddediliyor. |
| 02-H1 | Etkilenen kural adları ve cihazlar daima görünsün | Geçersiz | U/UnifiedAccessControl.tsx:61; convex/schema.ts | Ortak zaman şablonu ve ilişkileri kaldırıldı. |
| 02-O1 | Hazır şablon taslakları sunulsun | Geçersiz | U/UnifiedAccessControl.tsx:61 | Şablonlar kaldırılınca hazır taslak kararı iptal edildi. |
| 02-O2 | Boş seçicide oluşturma ve geri dönüş olsun | Geçersiz | U/components/TimeSchedule.tsx:32 | Şablon seçici yok. |
| 02-O3 | Taslağı sakla ve Kurala dön sun | Geçersiz | U/CreateRuleDialog.tsx:148; U/UnifiedAccessControl.tsx:61 | Şablon düzenlemeye sekmeler arası geçiş yok. |
| 02-O4 | Şablon saat alanlarında etiket ve erişilebilir hata olsun | Geçersiz | U/components/TimeSchedule.tsx:65 | Şablon editörü silindi; mevcut kural saat alanlarında etiket/hata var. |
| 02-O5 | Şablon kapasitesi ve önizleme dili sadeleşsin | Geçersiz | U/UnifiedAccessControl.tsx:61 | İlgili editör kaldırıldı. |
| 02-O6 | Kuralda gece saatini otomatik böl | Yapılmadı | U/hooks/useAccessRuleSchema.ts:80; convex/lib/accessRuleUx.ts:10 | 01-D4 ile aynı iş; şablonun silinmesi bu kararı geçersiz kılmaz. |
| 02-O7 | Gönderim beklentisi değişiklik türüne göre gösterilsin | Geçersiz | convex/schema.ts; U/UnifiedAccessControl.tsx:61 | Şablon güncelleme/gönderim yolu kaldırıldı. |
| 02-O8 | Seçilmemiş şablon doğru özetlensin | Geçersiz | U/CreateRuleDialog.tsx:55 | Şablon seçimi yok. |
| 02-D1 | Şablon listesi/seçicisi ölçek ve hata dayanıklılığı | Geçersiz | convex/schema.ts; U/UnifiedAccessControl.tsx:61 | Tablo ve tüketicileri silindi; sayfalama işi gerekmiyor. |
| 03-H1 | Tüm kişiler aransın; kayıtsız kişi için açıklama ve bağlantı olsun | Kısmen | convex/accessGrantStatus.ts:135; convex/accessGrantStatus.ts:152; S/StatusCounters.tsx:23 | Bilinmiyor kural grafiğinden listelenebiliyor. Normal arama yalnız grant adaylarını tarıyor; kuralsız tüm proje kişileri için giriş ve Kural yok/Gönderim kaydı yok yönlendirmesi yok. |
| 03-H2 | Rozet, filtre ve sayaç aynı durum anlamını kullansın | Yapıldı | S/model.ts:65; convex/accessGrantStatus.ts:46; convex/accessGrantStatus.ts:152 | Temel rozet saklanan state; stale ve kapı eşleşmesi ayrı uyarı alanları. Güncellik hesabının kapsamı ayrı teknik borç. |
| 03-O1 | Kural, teslim, çevrimiçi ve şu anki saat ile teşhis | Kısmen | S/StatusViews.tsx:183; S/StatusViews.tsx:204; convex/accessGrantStatus.ts:46 | Kural ve dağıtım/güncelleme var; canlı bağlantı ve şu an saat aralığında mı hesabı dönmüyor, teşhis bağlantıları yok. |
| 03-O2 | Sabit proje özeti ve Filtre sonucu N göster | Yapıldı | S/StatusCounters.tsx:16; S/StatusResults.tsx:64; S/StatusPage.tsx:191 | Kişi–cihaz ve kişi sayısı; yüklenen sonuçların eksik olabileceği açıklanıyor. Departman seçimi özet kapsamını açıkça daraltıyor. |
| 03-O3 | Filtreleri temizle ve açık cihazı koru | Yapıldı | S/StatusFilters.tsx:65; S/StatusPage.tsx:155 | Ortak temizleme ve kapsam değişiminde cihaz seçimini koruyan filtre akışı. |
| 03-O4 | Gönderim onayında somut hedef adları olsun | Yapıldı | S/RedistributeControls.tsx:103 | Proje ve ilk beş kişi/cihaz listeleniyor. |
| 03-O5 | Proje gönderimi cihaz yönetimi iznine bağlansın | Yapıldı | S/RedistributeControls.tsx:61 | canManageDevices koşulu var. |
| 03-O6 | Çekmece kapanınca açan kişiye odak dönsün | Yapıldı | S/EmployeeGrantSheet.tsx:38; S/StatusPage.tsx:118 | Trigger ref ile odak geri veriliyor. |
| 03-O7 | Mobil seçim hedefi ve sayaç erişilebilirliği | Yapıldı | S/StatusViews.tsx:141; S/StatusCounters.tsx:29 | Etiketli seçim ve aria-pressed var. |
| 03-O8 | Arama öne, filtreler katlanır, işlemler seçimde | Yapıldı | S/StatusFilters.tsx:65; S/RedistributeControls.tsx:47 | Filtre paneli ve seçimde işlem çubuğu; bakım işlemleri menüde. |
| 03-O9 | Bölüm bazlı hata, yeniden deneme ve yükleme | Yapılmadı | S/StatusPage.tsx:105; S/StatusResults.tsx:127; S/EmployeeGrantSheet.tsx:49; S/useStatusData.ts:97 | Hata alert yanında sonuç bölümü koşulsuz; cihaz sayaçları Promise.all, başarısızlıkta yükleniyor kalabilir. Kişi ayrıntısında tekrar dene ve role=status yok. |
| 03-O10 | İndeksli kişi arama ve hafif/toplu filtre sorguları | Yapılmadı | S/useStatusData.ts:57; S/useStatusData.ts:97; convex/accessGrantStatus.ts:160 | Tüm kural sayfaları okunuyor; cihaz başına counts; isim araması 1000 aday taraması. Cihaz görünümü dışında counts atlanması sınırlı iyileştirme. |
| 03-D1 | Teknik kişi×cihaz dilini açıkla | Yapıldı | S/StatusCounters.tsx:16; S/RedistributeControls.tsx:103 | Kişi–cihaz kaydı ve somut hedefler kullanılıyor. |
| 04-H1 | Kalıcı gönderim durumu ve değişikliksiz yeniden deneme | Yapıldı | D/DoorPlanDialog.tsx:133; D/DoorPlanDialog.tsx:205 | Kalıcı bekleyen anahtarlar yeniden denemeye katılıyor; boş değişiklik teslim sayılmıyor. |
| 04-H2 | Tek Kaydet ve cihaza gönder ve etki özeti | Yapıldı | D/DoorPlanDialog.tsx:474; D/DoorPlanDialog.tsx:493; D/DoorPlanImpactSummary.tsx:120 | Değişen planlar için kapı/saat/fiziksel etki özeti var. |
| 04-O1 | Kapalı plan alanları gizlensin ve durum yazsın | Yapıldı | src/components/access-control/door-dialog/DoorStatusPlanSection.tsx:48; src/components/access-control/door-dialog/DoorVerifyPlanSection.tsx:69 | Etkin olmayan plan metni ve koşullu editör var. |
| 04-O2 | Plan etkinliği ve fiziksel kapı modu ayrışsın | Yapıldı | D/DoorPlansTab.tsx:44; D/DoorPlanImpactSummary.tsx:90 | Plan etkin değil ve mod açıklamaları kullanılıyor. |
| 04-O3 | Tüm tatiller aynı mod; tarih önizlemesi ve takvim bağlantısı | Yapıldı | D/DoorPlanDialog.tsx:383; D/DoorPlanDialog.tsx:400; convex/doors.ts:750 | Proje ve genel tatiller birleştiriliyor; tam gün/yarım gün etkisi :451 açıklanıyor. |
| 04-O4 | Hafta içi planı doğrudan kurulabilsin | Yapıldı | src/components/access-control/door-dialog/weeklyPlan.tsx:214 | Her gün/Hafta içi/Günlere göre seçimi. |
| 04-O5 | Kopyada plan türü, hedef adları ve kaynak özeti | Yapıldı | D/CopyDoorPlansDialog.tsx:184; D/CopyDoorPlansDialog.tsx:204; D/CopyDoorPlansDialog.tsx:215 | Tür seçimi; hedef listesi açılır; kaynakta olmayan tür korunur. |
| 04-O6 | Mobilde kapı ve gönderim birlikte görünsün | Yapıldı | D/DoorPlansTab.tsx:171; D/DoorPlansTab.tsx:263 | Mobil dikey kart satırı ve Gönderim etiketi. |
| 04-O7 | Uzun form katlansın ve alt eylem sabitlensin | Yapıldı | src/components/access-control/door-dialog/weeklyPlan.tsx:238; D/DoorPlanDialog.tsx:482 | Günler details, mobil footer sticky. |
| 04-O8 | Boş zaman şablonu kaynağına çıkış | Geçersiz | D/CopyDoorPlansDialog.tsx:67 | Şablon kaynağı tamamen kaldırıldı. |
| 04-D1 | Şablon kapı modu seçicisi 44 px olsun | Geçersiz | D/CopyDoorPlansDialog.tsx:67 | İlgili kaynak ve seçici kaldırıldı. |
| 04-D2 | Desteklenen kapılarda arama ve sayfalama | Yapılmadı | convex/doors.ts:654; D/DoorPlansTab.tsx:131 | İlk 1000 kapı sonra uyumluluk filtresi; liste arama/sayfalama/kesilme uyarısı sunmuyor. |

## Yapılmayanlar — tahmini iş

- **01-O1 — büyük:** dinamik departman üyeliği ve kapsam değişimlerinin cihazlara aktarılması.
- **01-H2 — büyük:** yeniden bağlanmada güvenilir otomatik gönderim ve sonuçtan yeniden deneme; yalnız düğme küçük (≤1 sa), bütün karar büyük.
- **01-D4 / 02-O6 — büyük:** tek kuralın gece saatlerini ertesi güne bölmesi; form, backend ve cihaz saat modelleri birlikte ele alınmalı.
- **03-H1 — büyük:** tüm proje kişilerinde indeksli arama, kuralsız/kayıtsız kişi teşhis yolu.
- **03-O1 — büyük:** çevrimiçi durumu, güncel saat değerlendirmesi ve teşhis bağlantıları.
- **03-O9 — orta (≤yarım gün):** bölüm bazlı hata/tekrar dene ve cihaz sayaçlarının ayrı hata durumları.
- **03-O10 — büyük:** hafif seçenek sorgusu, indeksli kişi araması ve toplu/görünür cihaz sayaçları.
- **04-D2 — orta (≤yarım gün):** desteklenen hedefleri sayfalama, arama ve kapsam uyarısı.

Tahminler uygulama ve ilgili anlamlı doğrulamayı kapsayan yaklaşık iş boyutlarıdır; aynı işi paylaşan 03-H1/03-O10 ve 01-D4/02-O6 ayrıca toplanmamalı.

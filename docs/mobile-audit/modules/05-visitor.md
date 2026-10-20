# 05 — Ziyaretçi yönetimi: mobil audit ve geliştirme paketi

Tarih: 19 Ekim 2026. Yöntem: mevcut çalışma ağacındaki kaynakların salt okunur analizi. Hedef dizindeki **tek dosyanın tamamı** (`mobile/lib/screens/visitor/visitor_screen.dart`, 57 satır) incelendi. Backend zinciri okunmadan önce `convex/_generated/ai/guidelines.md` dosyasının tamamı okundu. Bu worker uygulama, backend, platform ve test kodunu değiştirmedi; Flutter/test/analyze/pub get/build, deploy, commit, push veya veri mutasyonu çalıştırmadı. Yalnız bu rapor yazıldı. Satırlar inceleme anındaki, önceden değiştirilmiş çalışma ağacına aittir.

**Sonuç:** Mobil ziyaretçi yönetimi henüz uygulanmamış bir placeholder'dır. Gerçek Convex ziyaretçi altyapısı vardır; ancak bu altyapı web `users` kimliğiyle çalışır, mobil uygulama ise ayrı `employeeSessions` oturumu kullanır. Mobil çalışan oturumunu mevcut yönetici endpoint'lerine bağlamak için yalnız ekran geliştirmek yeterli değildir. Dört bulgu vardır: iki P1, bir P2, bir P3; P0 kanıtı yoktur. Üretimde istismar, veri sızıntısı veya cihazda gerçekleşmiş kesinti gözlemlenmedi.

## 1. Kapsam ve kanıt envanteri

| İncelenen dosya / bölüm | İnceleme amacı |
| --- | --- |
| `mobile/lib/screens/visitor/visitor_screen.dart:1–57` | Hedef modülün tamamı: görünüm, veri ve işlem varlığı |
| `mobile/lib/router/app_router.dart:1–128` | `/visitor`, oturum yönlendirmesi, shell bağlantısı |
| `mobile/lib/screens/main_navigation_shell.dart:1–154` | Ziyaretçi sekmesi ve gezinme |
| `mobile/lib/screens/home/home_screen.dart:172–210` | Ziyaretçi hızlı eyleminin gerçek hedefi |
| `mobile/lib/main.dart:1–101` | Repository/provider kaydı, auth-expiry bağlantısı, yerelleştirme |
| `mobile/lib/providers/auth_provider.dart:1–162` | Mobil oturum bootstrap, giriş, çıkış ve geçerlilik |
| `mobile/lib/repositories/auth_repository.dart:1–111` | `AuthUser` shape'i ve çalışan endpoint'leri |
| `mobile/lib/config/convex_config.dart:1–402` | HTTP taşıma, çalışan token argümanı, retry, hata ve null serileştirme |
| `mobile/lib/core/errors.dart:1–124`, `mobile/lib/core/error_localizer.dart:1–36` | Gelecek entegrasyonun hata sözleşmesi |
| `mobile/lib/l10n/app_tr.arb:282–319`, `app_en.arb:282–319`; `app_localizations.dart:64–98,1271–1407`; üretilmiş TR/EN ziyaretçi getter'ları | Kullanılan ve kullanılmayan ziyaretçi çevirileri; desteklenen diller |
| `convex/visitors.ts:1–564` | Tüm public ziyaretçi API'leri ve expiry cron handler'ı |
| `convex/lib/visitorStatus.ts:1–75`, `visitorPresence.ts:1–39` | Yaşam döngüsü, fiziksel konum, zaman, maskeleme ve doğrulama |
| `convex/lib/customFunctions.ts:1–134`, `auth.ts:1–202`, `projectScope.ts:1–21`, `accessScope.ts:1–16`, `accessScopeRelations.ts:1–67` | Web/çalışan auth ayrımı ve proje/ilişki denetimi |
| `convex/employeeAuth.ts:128–249`, `convex/lib/employeeAuth.ts:1–37` | Çalışan giriş/me yanıtı ve oturumdan kimlik türetme |
| `convex/schema.ts:50–128`, ziyaretçi rızası/aydınlatma alanlarına ilişkin arama; `convex/crons.ts:64–70` | Model, indeksler, optional proje, ziyaretçi cron sıklığı |
| `convex/employees.ts:18–85`, `convex/lib/nullablePatch.ts:1–12` | Tekillik, kural üyeliği, null ile alan temizleme |
| `convex/hikvisionSync.ts:35–85`, `convex/actions/hikvisionSync.ts:84–165`, `convex/actions/ideGatewayDevice.ts:60–145,228–255`, `convex/lib/accessGraph.ts:259–291` | Ziyaretçiden scheduler/cihaz kuyruğuna kadar çağrı sınırı ve kart gereksinimi |
| `convex/privacyRetention.ts:1–141` | Aydınlatma metni ayarı ve kart okuma saklama kapsamı |
| `convex/lib/visitorPresence.test.ts:1–62`, `visitorStatus.test.ts:1–236` | Mevcut testlerin gerçekten kanıtladığı sınır |
| `src/components/visitors/hooks/useVisitorFormData.ts:1–101`, `useVisitorFormSchema.ts:1–25`, `lib/formPayload.ts:1–33`, `VisitorFormFields.tsx:31–32` | Mevcut web formuyla backend kart doğrulaması zincirini karşılaştırma |

`rg` ile `mobile/lib` ve `mobile/test` genelinde ziyaretçi referansları tarandı: ziyaretçi repository/model/provider implementasyonu veya ziyaretçi testi bulunmadı. Bu yokluk, tek başına ek bir işlevsel bug olarak sayılmadı. Diğer mobil modüller ve cihaz pipeline'larının tamamı audit edilmedi; yukarıdaki yardımcı dosyalar belirtilen akışla sınırlı okundu. Çalışma ağacındaki diğer raporlara ve değişikliklere dokunulmadı.

### Mevcut gerçek akış / capability tablosu

“Çalışıyor” aşağıda kaynakta somut implementasyon bulunduğunu ifade eder; cihazda veya üretimde test edildiği anlamına gelmez.

| Yetkinlik | Mobil durum | Backend / somut kanıt |
| --- | --- | --- |
| Ziyaretçi sekmesine ulaşma | Çalışıyor — kaynak analizi | Shell index 3 (`main_navigation_shell.dart:66–73`) → `/visitor` (`app_router.dart:108–113`); ana sayfa hızlı eylemi de aynı hedefe gider (`home_screen.dart:193–197`). |
| Oturumsuz erişim engeli | Çalışıyor — kaynak analizi | Router oturumsuz korumalı rotayı login'e yollar (`app_router.dart:49–61`). Bu yalnız gezinme korumasıdır. |
| Ekran içeriği | Placeholder | Başlık, ikon ve “Çok yakında” metni; form/liste/eylem yok (`visitor_screen.dart:14–54`). Demo ziyaretçi satırı veya sahte başarı bildirimi de yoktur. |
| Liste, detay, arama, sayfalama, sayaç | Placeholder | Mobil çağrı yok. Web API: `visitors.listPage:157–201`, `summary:204–223`, `getDetail:225–258`; listede sayfa boyutu 1–100 ve proje kontrolü var. |
| Ekleme / davet | Placeholder | Mobil form yok. `visitors.create:261–355` gerçek `employees` kaydı, kural üyeliği ve scheduler işi oluşturur. Bu işlem e-posta/SMS daveti veya ziyaretçiye QR gönderimi değildir; incelenen ziyaretçi API'sinde böyle gönderim yoktur. |
| Düzenleme / ön kayıt aktivasyonu | Placeholder | `visitors.update:362–467` web admin mutation'ıdır. Ayrı public `checkIn` endpoint'i yok; aktivasyon `isActive: true` güncellemesiyle ifade edilir. |
| Manuel sonlandırma / kart iadesi | Placeholder | `checkOut:470–501` erişimi pasifleştirir; `releaseCard:504–524` pasif kaydın kartını serbest bırakır. Bunlar fiziksel çıkış kart okuması üretmez. |
| Fiziksel içeride/dışarıda takibi | Mobilde yok; backend kısmi kanıt | `latestVisitorPresence:119–129`, `visitorPresence.ts:9–25` izinli ve yönlü kart olaylarını kullanır; kanıt yoksa/çelişkide `unknown`. Cihaz teslimatı bu auditte doğrulanmadı. |
| Süre dolumu ve cihaz erişimini kaldırma | Mobilde yok; backend implementasyonu var | Beş dakikalık cron (`crons.ts:64–70`) → `expireVisitorAccess:527–564` → Hikvision/IDE işleri. Kuyruğa alınması fiziksel cihaz onayı değildir. |
| Mobil çalışan kimliğiyle ziyaretçi API erişimi | Uygulanmamış | Mobil `employeeQuery/employeeMutation` token'ı argümana koyar (`convex_config.dart:118–147`); ziyaretçi API'leri web `authedQuery/adminMutation` kullanır (`visitors.ts:14`, `customFunctions.ts:13–19,61–70`). |
| KVKK/aydınlatma ve kişisel veri | Mobilde yok; backend kısmi temel | Proje metni `kvkkNotice:76–82`; rıza URL/sürüm snapshot'ı ve audit `visitors.ts:25–74`. Kart/TC maskesi var; telefon, e-posta ve not detayda döner (`visitors.ts:239–255`). Yeni mobil yetki politikası gereklidir. |
| Hata, çevrimdışı, loading, tekrar deneme | Placeholder | Ekran ağ çağrısı yapmadığı için ziyaretçiye özel başarısızlık durumu da yok. Genel HTTP katmanı sorgu retry ve auth-expiry sağlar; bu modülde kullanılmıyor. |

### Backend sözleşmesi ve kullanıcı bağlamı

1. **Mevcut mobil kimlik:** `AuthRepository.signIn` → `employeeAuth:signIn` (`auth_repository.dart:59–81`) → `employeeSessions` kaydı (`employeeAuth.ts:176–205`). `getCurrentEmployee` token'ın süresini, çalışan varlığını ve aktifliğini denetler (`lib/employeeAuth.ts:7–22`). `AuthUser` içinde web rolü, proje listesi veya ziyaretçi yönetim yetkisi yoktur (`auth_repository.dart:6–38`).
2. **Mevcut ziyaretçi kimliği:** public sorgular `getCurrentUser`, yazmalar ayrıca `super_admin/project_admin` ister (`customFunctions.ts:13–19,61–70`). Web kullanıcı oturumu `getValidAuthUserId` üzerinden doğrulanır (`auth.ts:9–45`). Mobil taşıma Authorization başlığı göndermez; HTTP gövdesi ve sabit başlıklar `convex_config.dart:273–284` içindedir. Çalışan token'ı bir web yönetici yetkisi değildir. Mevcut engel doğru güvenlik sınırıdır; çözüm bu guard'ları gevşetmek olamaz.
3. **Model:** ziyaretçi ayrı mobil model değil, `employees.isVisitor=true` kaydıdır (`schema.ts:68–109`). Liste yaşam döngüsü `active / checkedOut / expired / preRegistered`; saklanan aktif durum etiketi `checkedIn` olabilir (`visitorStatus.ts:33–38`, `visitors.ts:328`). Mobil ARB'deki “beklenen/içeride/çıktı” üçlüsü doğrudan bu enum'a eşlenemez.
4. **Erişim ≠ fiziksel konum:** aktivasyon ve checkOut idari erişimi değiştirir; içeride/dışarıda yalnız izinli kart okumasından çıkar. Erişimi bitmiş ziyaretçi, son izinli girişe göre hâlâ içeride olabilir. `summary` fiziksel içeride sayacı sağlamaz (`visitors.ts:209–221`).
5. **Zaman:** `accessStartsAt` log/raporlama alanıdır ve cihaz erişimini zamanlamaz (`schema.ts:94–95`). `isActive=true` ile geleceğe başlangıç girmek gelecekte aktive olacak randevu anlamına gelmez. Bitiş karşılaştırmaları UTC/ofsetli ISO ve eski TR saatini normalize eder (`visitorStatus.ts:11–30`). Mobilde açık saat dilimiyle gönderim gerekir.
6. **Yazma ve donanım sınırı:** create ID döndürür ve scheduler'a işler bırakır (`visitors.ts:340–352`). checkOut DB'yi kapatıp kaldırma işlerini planlar (`483–498`). Fiziksel cihaz sonucu mutation yanıtında yoktur. UI “kayıt kaydedildi” ile “cihaza uygulandı” durumlarını ayrı göstermelidir.

## 2. İyi çalışan temeller

- Placeholder durumu açıkça belirtiliyor; gerçek ziyaretçi veya başarı varmış gibi demo veri sunulmuyor (`visitor_screen.dart:33–44`).
- Mevcut navigasyon ve genel auth-expiry kancası kullanılabilir (`app_router.dart:48–61`, `main.dart:51–55`).
- Backend listeleme projeye bağlı, cursor sayfalı ve kartı maskeli; detayda maaş gibi tüm employee alanları yayılmıyor (`visitors.ts:138–153,157–199,239–255`).
- Oluşturma/güncelleme kural, ev sahibi ve kapı/cihaz ilişkilerinde aynı proje denetimi yapıyor; proje taşıma ayrıca engelleniyor (`visitors.ts:281–285,382–385`; `accessScopeRelations.ts:32–49`).
- Kart/e-posta tekilliği, pasif kartın aynı projede geri alınması ve zorunlu ad/soyad/gelecek bitiş kontrolleri var (`visitors.ts:285–315`; `visitorPresence.ts:28–38`).
- İdari erişim ve fiziksel konum ayrı hesaplanıyor; ret veya çelişkili yön sahte “içeride” sonucu üretmiyor (`visitorPresence.ts:9–25`).
- Rıza kaydında yapılandırılmış metin URL/sürümü saklanıyor; sürüm değişmişse yeniden onay isteniyor (`visitors.ts:46–66`). `kvkkConsent` opsiyoneldir: metnin zorunlu toplanması ürün/politika kararıdır; bu rapor hukuki uyumluluk sonucu vermez.
- Mevcut visitor test kaynakları zaman, maskeler, arama/sayfalama, konum ve rıza sınırlarını ele alıyor. Bazı handler testlerinde kimlik/proje fonksiyonları mock'lanmış (`visitorStatus.test.ts:58–63`); bunlar gerçek kullanıcı auth entegrasyonunu veya fiziksel cihazı kanıtlamaz. Testler bu audit sırasında çalıştırılmadı.

Koordinatörün [baz doğrulama raporunda](../evidence/baseline.md) `flutter analyze --no-pub` için “No issues found!” ve `flutter test --no-pub --reporter expanded` için **44 test geçti** sonucu kayıtlıdır. Bunlar koordinatörün çalıştırdığı mobil baz kontrolleridir; bu worker yeniden çalıştırmadı ve Convex ziyaretçi testlerinin geçtiği veya ziyaretçi E2E akışının çalıştığı anlamına gelmez. Aynı kanıt dosyasında HTTP 560 işlev hatasının genel taşıma katmanında auth-expiry yerine `ServerError` olarak ayrıldığı ek yeniden üretim de bulunur; W01/W04 entegrasyonu bu ortak taşıma bulgusunun çözümüne bağlı olarak doğrulanmalıdır. Bu raporda ortak hata ikinci kez ziyaretçi bulgusu sayılmadı.

## 3. Kanıtlı bulgular

### VIS-F01 — Mobil ana ziyaretçi akışı tamamen placeholder; çalışan oturumu için API sözleşmesi yok

- **Öncelik / kesinlik:** P1 / kaynak analizi. Bu bir teslimat/ana akış eksikliğidir; var olmayan formun runtime arızası olarak sunulmaz.
- **Kod zinciri:** `main_navigation_shell.dart:66–73` ve `home_screen.dart:193–197` → `app_router.dart:108–113` → `visitor_screen.dart:1–57`. Ekran yalnız iki import içerir, repository/provider okumaz ve işlem sunmaz. `main.dart:44–47,69–85` yalnız auth/attendance/device bağımlılıklarını kaydeder. `auth_repository.dart:63–85` çalışan oturumunu kullanır; `customFunctions.ts:61–70,113–134` yönetici ve çalışan guard'larının ayrılığını gösterir.
- **Somut tetikleyici:** Giriş yapmış kullanıcı alt sekmeye veya ana sayfa ziyaretçi kartına basar, ziyaretçi görüntülemek ya da eklemek ister.
- **Beklenen / mevcut:** Ürün kapsamına uygun yetkili liste/davet/ziyaret takibi beklenir; yalnız “Çok yakında” görünür. Hiçbir ziyaretçi verisi okunmaz/yazılmaz. Backend'in varlığı mobil bağlantı anlamına gelmez.
- **Kullanıcı/iş etkisi:** Mobil ziyaretçi operasyonu yapılamaz; kullanıcı başka kanala geçmek zorundadır. İşlev, ana navigasyonda görünmesine rağmen kullanılamaz.
- **Kök neden:** Ekran, DTO, repository ve state yönetimi uygulanmamış; mobil çalışan için ev sahibi/saha görevlisi/yönetici ayrımı ve proje kapsamı sözleşmesi yoktur.
- **Çözüm:** Önce mobil ürün rolünü ve sunucuda türetilen kapsamı tanımlayın (VIS-W01); ardından gerçek liste/form/işlem paketlerini uygulayın (VIS-W04/W05). Web endpoint'lerini herkese açarak veya istemciden yönetici rolü alarak çözmeyin.

### VIS-F02 — Projesiz eski ziyaretçide checkOut/releaseCard proje yetkisi kontrolünü atlıyor

- **Öncelik / kesinlik:** P1 / kaynak analizi. Koşul doğrulanabilir kod yoludur; üretimde projesiz kayıt bulunması ve ID'nin saldırganca bilinmesi kanıtlanmadı. Mevcut mobil placeholder'dan tetiklenemez; public backend API yüzeyidir.
- **Kod zinciri:** `schema.ts:69` proje alanını opsiyonel tutar. `adminMutation` herhangi bir geçerli `project_admin` kimliğini kabul eder (`customFunctions.ts:61–70`). `checkOut`, yalnız `visitor.projectId` doluysa üyelik arar (`visitors.ts:473–479`), sonra `isActive=false` ve `checkedOut` patch'i yapar (`483–486`). `releaseCard` aynı koşullu kontrolü kullanır (`507–515`) ve kartı değiştirir (`517–520`). Buna karşılık merkezi çalışan guard'ı projesiz kayıtta yalnız super admin'e izin verir (`auth.ts:118–160`).
- **Somut tetikleyici:** A projesinin yöneticisi, `projectId` bulunmayan eski `isVisitor=true` kaydın ID'siyle public `checkOut` çağırır; aktif kayıt sonlandırılır. Aynı yönetici, pasif projesiz kayıtta `releaseCard` çağırır; kart serbest bırakılır. Sıfır proje üyeliği de koşulu değiştirmez.
- **Beklenen / mevcut:** Proje yöneticisi kapsamı kanıtlanamayan kaydı değiştirememelidir. Mevcut `if (visitor.projectId && ...)` koşulu projesiz kaydı reddetmeden geçer. Bu, normal B projesine ait kayıtlarda üyelik kontrolünün olmadığı iddiası değildir.
- **Kullanıcı/iş etkisi:** Kapsam dışı eski ziyaretçinin erişim durumu veya kart tahsisi değiştirilebilir; operasyonel kayıt bütünlüğü riski vardır. Donanımda etkilenme ayrıca pipeline ve kayıt ilişkilerine bağlıdır.
- **Kök neden:** İki mutation ortak orphan güvenlik politikasını kullanmıyor.
- **Çözüm:** Her iki işlemde de `requireEmployeeAccess` eşdeğeri, projesiz kaydı açıkça ele alan guard kullanın; `isVisitor` doğrulamasını koruyun. Projesiz kaydın admin tarafından yönetilip yönetilemeyeceği açıkça tanımlansın; korumayı yalnız arayüzde yapmayın (VIS-W02).

### VIS-F03 — IDE kart gereksinimi kayıt öncesi doğrulanmıyor; başarılı kayıt sonradan senkronize edilemeyebilir

- **Öncelik / kesinlik:** P2 / kaynak analizi. Fiziksel cihazda denenmedi; belirli hatalı girdiyle scheduler'ın erken dönüşü kaynakta açıktır.
- **Kod zinciri:** `visitors.create` string kart alır (`267`), doğrulama yalnız boş/`IADE:` kartı engeller (`visitorPresence.ts:34–38`; `visitors.ts:285–289`). Benzersiz `ABC` gibi bir değer kaydedilir (`319–338`), IDE işi planlanır ve ID döner (`347–352`). IDE action, bağlı IDE kuralı varsa `Number(cardNumber)` için pozitif safe integer ister ve aksi halde `{ok:false, queued:0, error:...}` döner (`ideGatewayDevice.ts:92–104`). Create bu asenkron dönüşü alamaz. Update'in yeni kart denetimi de trim/tekillikle sınırlıdır (`visitors.ts:397–403`). Web form şeması da sayısal zorunluluk koymaz (`useVisitorFormSchema.ts:7,20–22`).
- **Somut tetikleyici:** Aktif IDE paneline bağlı geçerli ziyaretçi kuralında, benzersiz ve boş olmayan alfabetik kartla kayıt oluşturma veya karta güncelleme.
- **Beklenen / mevcut:** Seçilen erişim bölgesinin cihazına uygulanamayacak kart, kayıttan önce açıklanabilir alan hatası almalıdır; mevcut durumda kayıt/aktivasyon başarılı görünür, IDE işi kartı kuyruğa yazmadan döner.
- **Kullanıcı/iş etkisi:** Kayıtta erişim aktif görünmesine karşın ziyaretçi IDE kapısından geçemez; saha görevlisi yanlış yönlendirilir. Hikvision-only kurulumlara aynı sayısal kuralın körlemesine uygulanması önerilmez.
- **Kök neden:** Cihaz kabiliyeti doğrulaması yalnız asenkron action içinde, iş kaydından sonra yapılıyor; sonuç create/update yanıtında yok.
- **Çözüm:** İlgili preset'in gerçek cihaz zincirinden kart gereksinimini sunucuda belirleyin; create/update öncesi ortak doğrulama ve UI alan açıklaması ekleyin. Ayrıca asenkron senkronizasyon sonucunu gözlemlenebilir kılın (VIS-W03/W06).

### VIS-F04 — İngilizce ekranda placeholder gövdesi Türkçe kalıyor

- **Öncelik / kesinlik:** P3 / kaynak analizi.
- **Kod zinciri:** Uygulama EN/TR locale destekler (`app_localizations.dart:95–98`, `main.dart:95–96`), başlık lokalizasyon getter'ını kullanır (`visitor_screen.dart:12,17`), ancak iki gövde metni sabit Türkçedir (`33`, `42–44`).
- **Somut tetikleyici:** Desteklenen İngilizce locale ile ziyaretçi ekranını açma.
- **Beklenen / mevcut:** Başlık ve açıklama seçili dilde olmalıdır; mevcutta İngilizce başlık altında Türkçe açıklama çıkar.
- **Kullanıcı/iş etkisi:** İngilizce kullanan kişi özelliğin durumunu anlayamayabilir. Veri veya güvenlik etkisi kanıtı yoktur.
- **Kök neden / çözüm:** Placeholder metinleri ARB'den alınmıyor. Geçici ekran ve yeni gerçek akışın metinlerini ARB'ye taşıyın; yeni yaşam döngüsü terimlerini de backend anlamlarıyla eşleştirin (VIS-W07).

## 4. Ayrıntılı geliştirme iş paketleri

S/M/L takvim taahhüdü değildir: S sınırlı tek katman, M birkaç bileşen ve sözleşme, L kimlik/backend/UI veya donanım koordinasyonu gerektirir. Önerilen sıra: W01 ve W02 → W03/W04 → W05 → W06; W07 mevcut placeholder üzerinde bağımsız başlayabilir. W06'nın gözlemlenebilirlik sözleşmesi W05 UI tasarımından önce kararlaştırılmalıdır.

### VIS-W01 — Mobil ürün rolü, yetki ve API sözleşmesi

- **Bağlantı / kapsam:** VIS-F01; backend çalışan oturumu, proje/ev sahibi kapsamı, DTO ve izin matrisi. **Bağımlılık:** Ürün sahibinin mobilde ev sahibinin yalnız kendi ziyaretçisini mi yoksa güvenlik görevlisinin proje listesini mi yöneteceği kararı.
- **Yapılacaklar:** Çalışan oturumundan kimliği ve projeyi türetin; operasyonları ayrı yetkilendirin. Ev sahibi atanmasını istemcinin sınırsız seçimine bırakmayın. Web admin API'sini koruyup dar mobil wrapper'lar/shared domain helper'lar tanımlayın. DTO'ları camelCase, maskeli liste ve role göre minimal detayla oluşturun; hatalara makinece okunur kodlar ekleyin. Projesiz çalışan/ziyaretçi için açık red politikası belirleyin.
- **Kabul:** İstemcideki `employeeId/projectId/hostEmployeeId` değişikliği ile kapsam genişletilemez; geçerli çalışan oturumu kendisine izin verilmeyen tam proje listesini veya kart/TC/telefonu okuyamaz. Süresi dolmuş, silinmiş ve pasif çalışan oturumu reddedilir. Web admin davranışı korunur.
- **Anlamlı testler:** Gerçek auth wrapper'ı üzerinden A/B proje verisi; yetkili/yetkisiz ev sahibi; aynı projedeki başka çalışanın ziyareti; token iptali; projesiz çalışan; gizli alanların response shape'inde bulunmaması. Auth helper'ını mock'layan test tek başına yeterli sayılmaz.
- **Tahmin:** L — yeni kullanıcı yetki modeli ve veri minimizasyonu birden fazla katmanı etkiliyor.

### VIS-W02 — Orphan ziyaretçi yazma guard'larını birleştirme

- **Bağlantı / kapsam:** VIS-F02; yalnız checkOut/releaseCard güvenlik politikası ve ortak guard. **Bağımlılık:** Mobil geliştirmeden bağımsız; mevcut orphan/super-admin politikası esas alınabilir.
- **Yapılacaklar:** Projesiz kaydı açıkça reddeden veya yalnız super admin'e açan ortak denetim kullanın; kontrolü her patch/scheduler öncesine taşıyın. Tipi ziyaretçi olmayan kaydı reddetmeye devam edin. Mevcut veri varlığını koordinatörün izinli, kişisel veri çıkarmayan sayım yöntemiyle değerlendirin; bu paket otomatik veri taşıma yetkisi vermez.
- **Kabul:** A proje yöneticisinin projesiz ya da B projesindeki ziyaretçi çağrısında DB ve scheduler değişmez; A projesindeki izinli işlem sürer. Pasif kayıt ve tekrar çağrı davranışı açık ve idempotent kalır; super-admin orphan davranışı kararla eşleşir.
- **Anlamlı testler:** Her iki endpoint × aktif/pasif × A/B/projesiz × project_admin/super_admin; gerçek customFunctions guard'ı dahil endpoint testi. Red halinde patch ve runAfter çağrısı sıfır olmalıdır.
- **Tahmin:** S — iki mutation'da mevcut güvenlik helper'ının tutarlı uygulanması.

### VIS-W03 — Cihaz kabiliyetine bağlı kart doğrulaması

- **Bağlantı / kapsam:** VIS-F03; create/update kart doğrulaması, preset kabiliyeti DTO'su. **Bağımlılık:** Mevcut cihaz/kural çözümleyicileri; mobil wrapper yazılırsa W01 ile ortak domain doğrulama.
- **Yapılacaklar:** IDE'ye bağlı preset için pozitif safe integer kuralını mutation öncesinde uygulayın. Karma cihaz ve Hikvision-only kurulumlarını ayırın; cihazın gerçek kart aralığı belirlendikten sonra daha dar sınır varsa sözleşmeye ekleyin. Kartı string olarak saklayın; formatı sessizce değiştirip hassasiyet kaybı yaratmayın. Formda kart gereksinimini görünür kılın.
- **Kabul:** IDE preset'inde alfabetik/sıfır/negatif/safe-integer dışı kartla kayıt veya güncelleme DB'yi değiştirmeden alan hatası döndürür. Geçerli sayısal kart ve donanımı uygun diğer preset çalışır; kural istemci atlanarak da uygulanır.
- **Anlamlı testler:** IDE-only/karma/Hikvision-only; create/update; aynı kartın tekilliği; boş ve `IADE:` kart; başında sıfır bulunan kartın uçtan uca kimlik anlamı. İzinli fixture'da mutation ve action aynı kartı kabul etmelidir.
- **Tahmin:** M — preset'ten donanım ihtiyacını güvenli ve tutarlı çözmek gerekiyor.

### VIS-W04 — Gerçek liste, detay, filtre ve durum sunumu

- **Bağlantı / kapsam:** VIS-F01; yeni Visitor DTO/repository/provider ve mevcut ekranın veriyle doldurulması. **Bağımlılık:** W01'in yetki/DTO sözleşmesi.
- **Yapılacaklar:** Liste/detail/summary query'lerini bağlayın; cursor, arama, dört yaşam döngüsü ve bağımsız presence alanını modelleyin. Loading/empty/forbidden/network/stale durumları ayrı gösterin. Proje/hesap değişiminde eski veri ve cursor'u temizleyin; gecikmiş yanıtı yeni hesaba uygulamayın. `active` sayısını “içeride” diye etiketlemeyin. Bitiş sınırında listeyi yenileyin; sunucu değerlendirme zamanını kullanın. Genel polling handle'ını ekran/state ömrüne göre iptal edin.
- **Kabul:** Aynı gerçek kayıttaki değişiklik yenilemede görünür; 25'ten fazla eşleşmede sayfalar yinelenmeden birleşir; filtre değişimi eski cursor'u kullanmaz. Ağ hatası “ziyaretçi yok” sayılmaz. `presence=unknown` açıkça gösterilir; erişimi sona eren son girişli kişi yanlışlıkla “çıktı” gösterilmez. Çıkış/hesap değişiminden sonra önceki veriler ekranda kalmaz.
- **Anlamlı testler:** Gecikmiş A hesabı yanıtı sonrası B girişi; 0/1/çok sayfa; Türkçe harfli arama; arama+durum filtre kombinasyonu; bitiş anı; izinli giriş/ret/çelişkili yön; bağlantı kesilmesi ve geri gelmesi.
- **Tahmin:** L — ilk gerçek mobil ziyaretçi veri ve state katmanı kurulacak.

### VIS-W05 — Kayıt/düzenleme, rıza ve erişim işlemleri

- **Bağlantı / kapsam:** VIS-F01/F03; create/update, ön kayıt aktivasyonu, ziyaret sonlandırma ve gerekiyorsa kart iadesi. **Bağımlılık:** W01, W03, W04; hangi rollerin hangi işlemi yapacağı kararı.
- **Yapılacaklar:** Alanları backend sözleşmesiyle hizalayın; tam ad yerine ayrı ad/soyad, preset, gelecek bitiş, opsiyonel ev sahibi/iletişim/not. Projeye ait aktif ve uygulanabilir bölgeleri sunun. Backend ID'sini alıp canonical detayla yenileyin; çift dokunmayı ve belirsiz timeout tekrarını tasarlayın. Başlangıç alanının yalnız kayıt bilgisi olduğunu açıklayın veya gerçekten randevulu aktivasyon gerekiyorsa ayrı backend kapsamı belirleyin. Yapılandırılmış aydınlatma metni ve sürümünü gösterin; checkbox'ı kendiliğinden işaretlemeyin.
- **Entegrasyon ayrıntısı:** Backend update, alan temizliği için `null` kabul ediyor (`visitors.ts:370–375`, `nullablePatch.ts:5–11`); mobil serializer map içindeki null'ları atıyor (`convex_config.dart:351–357`). Yeni repository bu farkı çözmeli; mevcut bağlı formda bug varmış gibi değerlendirilmedi. Genel taşıma değişecekse diğer endpoint sözleşmeleri korunmalı.
- **Kabul:** Boş ad/soyad, geçmiş bitiş, tekrar kart ve başka projeden host/preset sunucuda reddedilir; form değerleri hata sonrası korunur. Telefon/not temizleme kayıtta gerçekten silinir. Rıza URL/sürüm değişirse yeniden inceleme istenir. Başarı ancak backend onayıyla gösterilir; timeout sonrasında yinelenen ziyaretçi oluşturulmaz. Manuel sonlandırma fiziksel çıkış olarak etiketlenmez.
- **Anlamlı testler:** Pasif ön kayıt → aktivasyon; expired kayıt kişisel bilgi düzenleme ve geçmiş bitişle yeniden aktivasyon; aynı karta eşzamanlı kayıt; gönderim sonrası bağlantı kesilmesi; opsiyonel alanları temizleme; rıza metni yok/eski sürüm; kart iadesi sonrası yeni tahsis.
- **Tahmin:** L — yeni form, iş kuralları, rıza, yarış koşulları ve mutation durumları birlikte tasarlanacak.

### VIS-W06 — Cihaz sonucu, süre dolumu ve başarısızlık gözlemlenebilirliği

- **Bağlantı / kapsam:** VIS-F03 ve W05'in gerçek donanım kabulü; mutation sonucu ile cihaz uygulama sonucunun ayrılması. **Bağımlılık:** Backend cihaz pipeline sahibiyle sözleşme; W01 yetkisi, W03 doğrulaması.
- **Yapılacaklar:** Mobilde görülebilecek, kişisel veri içermeyen senkronizasyon durumunu tanımlayın: bekliyor/uygulandı/başarısız/bilinmiyor. Cihaz kapalıysa ve scheduler işi hata döndürüyorsa operatöre izlenebilir sonuç sağlayın. Manuel çıkış, kart değişimi ve cron iptalini ayrı sonuçlarla gösterin. Yeniden deneme sunucuda kapsamlı ve idempotent olmalı; kişisel kart/telefon/token hata metnine taşınmamalı. Toplu expiry işleminin sınırsız `collect`/loop yapısı (`visitors.ts:534–560`) için fixture ile ölçek doğrulaması planlayın; mevcut üretim limit aşımı kanıtlanmış değildir.
- **Kabul:** DB sonlandırılmış ama cihaz çevrimdışıyken ekran “cihazdan kaldırıldı” demez. Cihaz tekrar bağlandığında gerçek sonuç takip edilebilir. Bitişten sonraki beş dakikalık cron penceresi ve ek kuyruk gecikmesi ürün tarafından tanımlanmış toleransla ölçülür; kesin bitiş anı garantisi ancak donanımda doğrulanır. Hata/telemetri hassas veri içermez.
- **Anlamlı testler:** Hikvision ve IDE'de aktif kart; çevrimdışı panel; kapatma sırasında yeniden bağlanma; kart değişimi sırasında sıralama; sınır zamanı ve büyük expiry grubu. Fiziksel red/izin sonucu cihaz ve backend kaydıyla karşılaştırılır.
- **Tahmin:** L — backend kuyrukları ve fiziksel cihaz doğrulaması gerektiriyor; yalnız UI testi yeterli değil.

### VIS-W07 — Yerelleştirme ve erişilebilir cihaz görünümü

- **Bağlantı / kapsam:** VIS-F04; mevcut placeholder ve yeni ziyaretçi metinleri, duyarlı düzen. **Bağımlılık:** W04/W05 için final alan/enum sözleşmesi; placeholder çevirisi bağımsız yapılabilir.
- **Yapılacaklar:** Sabit Türkçe gövdeyi ARB'ye taşıyın; dört yaşam döngüsü, presence ve işlem sonucu için TR/EN metinlerini ayrı tutun. Küçük ekran, yatay yön, klavye ve büyük yazıda kaydırılabilir içerik sağlayın. Eylemlere anlamlı ekran okuyucu etiketleri ve yalnız renge dayanmayan durum metni ekleyin. Mevcut sabit Column'un taşması cihazda ölçülmedi; bu bir doğrulama gereksinimidir.
- **Kabul:** EN/TR'de ziyaretçi gövdesi karışık dil içermez; büyük yazı ve klavyede birincil işlem erişilebilir; durum ve hata ekran okuyucuyla anlaşılır. Hassas bilgi ekran okuyucuya maskelemeden önce aktarılmaz.
- **Anlamlı testler:** EN/TR widget görünümü; kompakt Android/iOS, yatay yön, %200 yazı; VoiceOver/TalkBack, form focus ve hata duyurusu.
- **Tahmin:** M — tek placeholder çevirisi S olur; tamamlanacak gerçek modülün bütün dil/erişilebilirlik durumlarını kapsayan paket M'dir.

## 5. Manuel cihaz / E2E doğrulama matrisi

**Bu matris planlanmıştır; hiçbir satır bu audit içinde çalıştırılmadı.** İzinli test tenant'ı ve sentetik kişiler kullanılmalı; gerçek kişisel veri rapora/ekran görüntülerine alınmamalı. Flutter/SDK ortak test çalıştırmasını koordinatör yönetir.

| Senaryo | Ortam / ön koşul | Gözlemlenebilir beklenen sonuç | Durum |
| --- | --- | --- | --- |
| Navigasyon ve oturum | Android + iOS; login/logout; `/visitor` | İki giriş noktası aynı ekrana gider; oturumsuz rota login'e döner | Çalıştırılmadı; mevcut kaynak zinciri var |
| Mevcut placeholder, dil ve küçük ekran | EN/TR; açık/koyu; kompakt/yatay, büyük yazı | Placeholder dürüstçe görünür; EN gövde hatası F04 yeniden üretilebilir; taşma ölçülür | Çalıştırılmadı |
| Tenant ve sahiplik | A/B proje, iki çalışan, yönetici; W01 sonrası | Başka proje/ev sahibi kaydı veya PII okunamaz/değiştirilemez | Çalıştırılmadı; gelecek API gerekir |
| Orphan guard | İzinli test verisinde projesiz ziyaretçi, proje admini | checkOut/releaseCard reddedilir; DB ve scheduler değişmez | Çalıştırılmadı; F02 kaynak kanıtlı |
| Liste/filter/cursor | 80 sentetik kayıt, 30 eşleşme; W04 sonrası | Sayfalama eksiksiz/tekrarsız; filtre sayacı doğru kapsamda | Çalıştırılmadı |
| Form ve rıza | Tekrarlı kart; yanlış host; sürümü değişen metin | Alan hatası; kayıp draft yok; onaysız başarı/rıza üretimi yok | Çalıştırılmadı; W05 gerekir |
| Hesap değişimi / auth-expiry | Yavaş ağ; sorgu devam ederken logout/B login | A verisi B ekranında görünmez; invalid token güvenli kapanır | Çalıştırılmadı |
| Veri ile fiziksel konum ayrımı | İzinli giriş → ret → manuel sonlandırma | Ret konumu değiştirmez; sonlandırma fiziksel çıkışa dönüşmez | Çalıştırılmadı |
| Aktivasyon ve kart uygunluğu | IDE/Hikvision/karma preset; geçerli/alfabetik kart | Geçersiz kart kayıttan önce reddedilir; geçerli kartın cihaz uygulama sonucu izlenir | Çalıştırılmadı; F03 kaynak kanıtlı |
| Süre dolumu | Gerçek IDE + Hikvision; yakın bitiş, ofset/UTC eşdeğeri | Yaşam döngüsü sınırda güncellenir; cihaz iptali gecikmesi ölçülür ve toleransla karşılaştırılır | Çalıştırılmadı |
| Çevrimdışı cihaz / ağ hatası | Panel kapalı; mutation yanıtı kayıp; sonra tekrar bağlanma | Sahte cihaz başarısı yok; kontrollü retry, çift kayıt yok | Çalıştırılmadı |
| Kart iadesi ve yeniden tahsis | Eski ziyaretçi sonlandırılmış; yeni ziyaretçi aynı kartı alır | Eski cihaz erişimi kalmaz; yeni kişinin izinleri doğru uygulanır | Çalıştırılmadı |
| Gizlilik ve erişilebilirlik | Debug/release log gözlemi; VoiceOver/TalkBack | Token/kart/telefon loglanmaz; maskeler ve işlem anlamları korunur | Çalıştırılmadı |

## 6. Açık sorular ve karar gerektiren sınırlar

1. Mobil kullanıcı ev sahibi çalışan mı, resepsiyon/güvenlik görevlisi mi, web yöneticisi mi? Her çalışan proje ziyaretçilerinin tümünü görebilecek mi? Yetkili operator rolü mevcut mobil kimlikte temsil edilmiyor.
2. “Davet” yalnız ön kayıt mı, SMS/e-posta/QR ve dış ziyaretçi onayı mı? İkinci kapsam için mevcut ziyaretçi endpoint'leri yeterli değildir; gönderim bu auditte denenmedi.
3. Fiziksel giriş/çıkış cihazdan mı gelecek, görevli elle mi işaretleyecek? Elle işaretleme istenirse idari aktivasyondan ayrı kanıt/olay modeli gerekecek.
4. Başlangıç tarihi yalnız bilgi mi, gelecekte otomatik erişim mi? Mevcut `accessStartsAt` erişim başlangıcını sınırlamaz. Bitiş için beş dakikalık cron ve kuyruk gecikmesinin kabul edilen toleransı nedir?
5. Mobilde kart tahsisi ve iade yetkisi olacak mı? IDE kart biçimi/aralığı, kartın baştaki sıfırları ve karma cihaz uyumu hangi cihaz sözleşmesiyle belirlenecek?
6. Rıza hangi operasyonlarda zorunlu olacak? Aktif eski rıza yeni metin sürümü çıktığında yenilenecek mi? Mevcut `activeKvkkConsentId` aktif rıza varsa yeniden kayıt oluşturmaz (`visitors.ts:25–49`). Bu davranışın hukuki uygunluğu bu audit kapsamında değerlendirilmedi.
7. Ziyaretçi kişisel bilgisi, notlar ve rıza kaydı için ayrı saklama/silme politikası var mı? İncelenen `privacyRetention.ts:73–105` yalnız kart okumalarını temizler; ziyaretçi PII'sinin üretimde silinme/saklanma davranışı kanıtlanmadı.
8. Projesiz legacy ziyaretçi sayısı nedir ve bu kayıtlara hangi rol erişebilmeli? F02'nin üretim etki alanı, kişisel veri dökmeden yetkili sayımla belirlenmeli.
9. Kayıt başarıyla kaydedilip cihaz senkronizasyonu başarısız olduğunda kim aksiyon alacak? Mobilde gösterilecek güvenli işlem/run kimliği ve yeniden deneme yetkisi hangi backend sahibi tarafından sağlanacak?

## 7. Teslim ve doğrulama sınırı

Hedef modülün tüm dosyaları tarandı ve mobilden backend kimlik/model/işlem sınırına kadar kaynak zinciri izlendi. Test kaynakları okundu; koordinatörün başarılı mobil analyze/44-test baz sonucu ayrıca referanslandı. Convex ziyaretçi testlerinin geçtiği, release build alındığı, gerçek cihazın çalıştığı veya üretim verisinin güvenli olduğu iddia edilmez. Yapılan tek yazma `docs/mobile-audit/modules/05-visitor.md` dosyasıdır; kalan uygulama/backend/test geliştirmeleri yukarıdaki kabul kriterli paketlerdir.

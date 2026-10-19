# 01 · Ana Sayfa ve ortak kabuk

## Özet

Ana Sayfa, seçili projenin personel ve cihaz sayıları, günlük kart okumaları, aktivite özeti ve son kayıtlarına hızlı bakış sağlar. En büyük üç sorun mobil sidebar'ın içeriği sıkıştırması, üye rolüne yönetim bağlantısı sunulması ve son okuma listesinin yanlış hedefe yönlendirmesidir. Öneri mevcut A2 ana sayfasını geliştirerek sakin sayaç satırını korur, rol ve veri durumlarını açıklaştırır ve diğer 12 sayfaya ortak proje seçici, hesap menüsü, komut paleti ve mobil menü sözleşmesi sağlar.

## Kapsam ve kaynak gerçeği

17.10.2026 çalışma ağacı incelendi; commit edilmemiş Dalga 3a değişiklikleri dahil edildi. `src/**` ve `convex/**` değiştirilmedi. `docs/ui-scan/current/01-ana-sayfa.png`, `01-ana-sayfa-2.png`, `01-ana-sayfa-mobil.png`, `01-ana-sayfa-mobil-2.png` açılıp incelendi; canlı uygulamaya giriş yapılmadı. Mobil görseller 780 fiziksel piksel genişliğindedir; CSS viewport varsayımından bağımsız olarak sidebar'ın içerikle yan yana kalması kaynakta da doğrulandı.

Tasarım kaynağı `docs/ui-scan/DESIGN_DIRECTION.md` ve `directions/A2-sade-bordo-sidebar/{home,people}.html`. `mockup.html`, mevcut **home.html'nin CSS, kabuk, SVG, sayaç, özet ve tablo yapısı korunarak geliştirilmiştir**; sıfırdan yeni yön çizilmemiştir. Ek CSS yalnız durum/katman davranışı, mobil düzen ve A2 token normalizasyonudur. Son bölümdeki “Önizleme senaryoları” üretim arayüzünün parçası değildir.

### Önceki denetimden kapananlar — yeniden bulgu açılmadı

| Önceki ID | Güncel kaynakta görülen düzeltme |
|---|---|
| SHL-01 | Üç home sorgusuna aynı `projectId` veriliyor: `src/hooks/useDashboard.ts:9`; sunucuda scope çözülüyor: `convex/dashboard.ts:36`, `:757`, `:804`. |
| SHL-02 | Sabit aktivite kaldırılmış; `getActivitySummary` gerçek okumalardan üretiliyor: `convex/dashboard.ts:799`, `src/components/dashboard/ActivitySummaryCard.tsx:14`. |
| SHL-03 | UI artık “Pasif erişim kuralları” diyor: `src/components/dashboard/StatsGrid.tsx:40`. Backend anahtarı `pendingRequests` geriye uyum için halen mevcut; görünürde talep uydurulmadı. |
| SHL-04 / 05 / 06 | Son kayıtlar proje+tarih index'inden alınıyor (`convex/dashboard.ts:772`); no-op yenileme kaldırılmış; üç bölüm ayrı loading durumuna sahip (`src/hooks/useDashboard.ts:21`). |
| SHL-07'nin tarih kısmı | İstanbul tarihi ve saati birlikte gösteriliyor: `src/components/dashboard/RecentReadingsTable.tsx:19`. Boş durumun eylem kısmı aşağıda açık. |
| SHL-09 / 10 / 11 | Doğru `photoUrl` kullanılıyor; sahte zil kaldırılmış; proje seçici üst çubukta (`src/components/layout/AppHeader.tsx:59`, `:68`). Saklanan seçim ancak proje listesi çözülünce doğrulanıyor (`src/contexts/ActiveProjectContext.tsx:88`). |
| SHL-12 / 13 / 14'ün temeli | Güvenli dönüş yolu, kalıcı kabuk ve Outlet sınırı mevcut (`src/components/Layout.tsx:23`, `:34`); rota meta ve projesiz durum mevcut (`src/lib/routeMeta.ts:4`, `src/pages/Index.tsx:14`). Rol ayrımı ve bölüm hataları aşağıda geliştirme olarak tanımlandı. |
| SHL-39'un dashboard kısmı | Eski CalendarCard, AttendanceChart ve StatusCard çalışma ağacında silinmiş; aktif sorun diye sayılmadı. |

## Mevcut durum taraması

### Ana Sayfa bulguları

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| HOME-UI-01 | Görsel hiyerarşi / mikro-metin | Sayfa amacı yerine “Hoş geldin, e-posta” başlığı var; `src/components/dashboard/DashboardHeader.tsx:9`, `src/hooks/useDashboard.ts:15`; masaüstü ilk ekran üst bölge. | Orta | Tek h1 “Ana Sayfa”; altına proje ve gün kapsamı. Hesap kimliğini hesap menüsünde tut. |
| HOME-UI-02 | AI arayüzü izi / bileşen tutarlılığı | Dört KPI kartı renkli ikon kutusu, gölge ve geniş yuvarlatma kullanıyor: `src/components/dashboard/StatsGrid.tsx:24`, `src/components/shared/StatCard.tsx:48`; ilk ekran sayaçlar. | Orta | A2 `StatInline`: 4 nötr sayaç, 1px ayırıcı, 30px değer; pasif kural sayısını hata rengiyle işaretleme. |
| HOME-UI-03 | Yerleşim | İki sütunluk grid içinde yalnız aktivite kartı var; sağ taraf boş: `src/pages/Index.tsx:19`; ilk ekran orta-sağ. Hızlı erişim tablonun altına itilmiş (`:23`). | Orta | A2'deki aktivite + hızlı erişim yan yana düzenini kullan; mobilde alt alta. |
| HOME-UI-04 | Mikro-metin / veri anlamı | “Bugünkü Geçişler” sayısı durum filtresiz tüm kart okumalarını sayıyor: `src/components/dashboard/StatsGrid.tsx:35`, `convex/dashboard.ts:83`, `:113`. | Yüksek | Yeni alan eklemeden “Bugünkü kart okumaları”; alt açıklama “İzin verilen + reddedilen”. Gerçek geçiş sayısı istenirse ayrı ürün/veri tanımı gerekir. |
| HOME-UI-05 | Bileşen tutarlılığı / rol | Hızlı erişimde Ayarlar tüm rollere açık ve “kuralları düzenle” deniyor: `src/components/dashboard/QuickLinksGrid.tsx:40`. Kabuk aynı hedefi üyeden saklıyor: `src/components/layout/AppHeader.tsx:84`, `AppSidebarNav.tsx:20`. | Yüksek | Aynı capabilities filtresini hızlı erişime uygula; üyede Kişiler + PDKS, yöneticilerde ayrıca Ayarlar. Üyenin tüm modülleri salt okunur olduğu varsayılmasın. |
| HOME-UI-06 | Mikro-metin / gezinme | Son kart okumalarındaki “Tümünü Görüntüle” `/access-control` açıyor: `src/components/dashboard/RecentReadingsTable.tsx:53`; bu rota yalnız kural listesi render ediyor (`src/components/access-control/unified/UnifiedAccessControl.tsx:28`). | Yüksek | `/live-monitoring` hedefiyle “Canlı izlemeyi aç”; orası `CardReadings` render ediyor (`src/pages/LiveMonitoring.tsx:4`). Tüm geçmiş kayıtlar vaat edilmesin. |
| HOME-UI-07 | Durumlar: boş / mikro-metin | Aktivite boşluğu yalnız “Bugün henüz okuma yok”; gerçekte yalnız aktif personelle eşleşen izinli okumalar hesaba giriyor: `ActivitySummaryCard.tsx:35`, `convex/dashboard.ts:805`. Reddedilen okumalar varken de bu mesaj çıkabilir. | Orta | “Bugün özetlenecek okuma yok” + “Aktif personele ait izin verilen bir okuma geldiğinde özet burada görünür.” |
| HOME-UI-08 | Durumlar: boş / eylem | Boş kart tablosu cihaz/personel kurulumunu aşağıdaki bağlantılara yönlendiriyor, fakat hızlı erişimde Cihazlar yok: `RecentReadingsTable.tsx:79`, `QuickLinksGrid.tsx:9`. | Orta | Boş bölüm içinde doğrudan “Cihazları görüntüle” ve “Kişileri görüntüle”; üyeye yöneticisiyle kontrol etme metni. |
| HOME-UI-09 | Durumlar: hata | Üç query tek hook içinde; herhangi birinin render hatası bütün home içeriğini Outlet fallback'ine götürür: `src/hooks/useDashboard.ts:11`, `src/pages/Index.tsx:10`, `src/components/Layout.tsx:34`. Kabuk kaybı çözülmüş, bölüm izolasyonu yok. | Orta | Query'leri bölüm sınırlarının altında tüket; aktivite hatasında sayaç ve son kayıtlar kalır. Bölüm bazlı gerçek retry. |
| HOME-UI-10 | Durumlar: boş / rol | Projesiz durumda süper admin'e de “yöneticinizle iletişime geçin” deniyor: `src/pages/Index.tsx:15`. | Orta | Üye/proje yöneticisi için atama bekleme; süper admin için “Henüz aktif proje yok” + Admin'e geçiş. Proje var ama seçilmemiş durumunu ayrı tut. |
| HOME-UI-11 | Mikro-metin / veri yok | Personel hücresi `employeeName`'i doğrudan basıyor, boş isimlerde hücre kayboluyor: `src/components/dashboard/RecentReadingsTable.tsx:92`; masaüstü 1 ve 2. görsellerde çok sayıda boş hücre. | Orta | Boş/whitespace isimde “Kişi bilgisi yok”; cihaz yoksa “Cihaz bilgisi yok”; yanlış eşleşme yapma. |
| HOME-UI-12 | Durumlar: yükleniyor / ölçek | SHL-08 halen açık: KPI sayımı koleksiyonları tam okuyor; tarih koşulu proje index'i sonrası filter: `convex/dashboard.ts:64`, `:83`, `:110`. Büyük projede bekleme riski; süre ölçülmedi. | Orta | Tarih aralığını compound index'e taşı; doğru toplam için sayaç/aggregate tasarla. UI'da sınırlandırılmış sonucu toplam diye gösterme. |

## Kabuk

Bu bölüm diğer 12 sayfa için ortak sözleşmedir. Sayfa çalışanları sidebar veya üst çubuğu yeniden tasarlamamalı; A2 referansını ve aşağıdaki davranışları kullanmalıdır.

### Kabuk bulguları

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| SHELL-UI-01 | Responsive | Sidebar tüm genişliklerde normal flex sütunu; mobil Sheet/katman dalı yok: `src/components/ui/sidebar.tsx:165`, `:191`; `src/components/layout/AppSidebar.tsx:15`; iki mobil görselde içerik dar ve kesik. | Yüksek | 760px ve altında sidebar gizli, menü düğmesiyle 248px modal Sheet; içerik tam genişlik. |
| SHELL-UI-02 | Tipografi / renk | Poppins ve mavi-gri yüzeyler A2'nin sistem fontu/nötr tonlarından farklı: `src/index.css:18`, `:104`, `src/components/Layout.tsx:30`; masaüstü ana yüzey. | Orta | A2 token'larını ortak temaya taşı; bu görevde yalnız mockup token'ları kullanıldı. Kontrast ihlali iddia edilmiyor; tasarım dili farkı. |
| SHELL-UI-03 | Görsel hiyerarşi / erişilebilirlik | Üst çubuk başlığı h1, sayfa da h1: `src/components/layout/AppHeader.tsx:56`, `src/components/dashboard/DashboardHeader.tsx:9`. | Orta | Üst çubukta etiket/breadcrumb; yalnız sayfa gövdesinde h1. |
| SHELL-UI-04 | Bileşen tutarlılığı | Sidebar'da sıra doğru fakat grup ayrımı yok; aktif durum beyaz opaklık sınıfıyla: `src/components/layout/AppSidebarNav.tsx:19`, `:33`. | Orta | 13 öğenin rolce izin verilen alt kümesi; PDKS ve yönetim öncesi 16px grup boşluğu; A2 aktif zemin ve 3px gösterge. |
| SHELL-UI-05 | Gezinme / bileşen tutarlılığı | A2'nin ⌘K paleti uygulama üst çubuğunda yok: `src/components/layout/AppHeader.tsx:52`–`:64`; üst bar tamamı. | Orta | Aynı routeMeta/capabilities kaynağından sayfa araması; ⌘K/Ctrl+K, klavye seçimi, boş sonuç. Kişi/cihaz araması gibi backend ihtiyacı yaratma. |
| SHELL-UI-06 | Form-diyalog / ölçek | Proje açılır listesi sabit 224px ve aramasız; uzun adlar truncate: `src/components/layout/ProjectSwitcher.tsx:69`, `:74`, `:83`. | Orta | 320px popover, görünür “Proje ara”, seçili işareti, eşleşme yok metni; mobilden 16px kenar. Tam proje adı seçenek içinde sarılabilsin. |
| SHELL-UI-07 | Mikro-metin / erişilebilirlik | Menü düğmesinin erişilebilir adı İngilizce ve hedefi 28px: `src/components/ui/sidebar.tsx:221`, `:229`. Hesap düğmesi 32px: `src/components/layout/AppHeader.tsx:66`. | Orta | “Menüyü aç/kapat”, expanded/controls; A2 kontrol minimumu mobilde 36px ve aralıklı hedefler. Sheet odak sınırı ve dönüş odağı. |
| SHELL-UI-08 | Bileşen tutarlılığı / breadcrumb | Header sadece tam rota eşleşmesinden ad alıyor (`src/components/Layout.tsx:20`); breadcrumb sayfa içinde tekrar kuruluyor (`src/pages/AccessControl.tsx:20`); ortak hiyerarşi sözleşmesi yok. | Düşük | Üst çubukta ortak breadcrumb: home'da yalnız Ana Sayfa, diğer üst düzey sayfalarda Ana Sayfa / sayfa. Detay rotasında ad/geri yol metadata ile tanımlanmalı. |
| SHELL-UI-09 | Erişilebilirlik | Layout'ta içerik atlama bağlantısı ve hedef id yok: `src/components/Layout.tsx:27`, `:33`. Global `.skip-to-content` CSS'i mevcut (`src/index.css:149`) fakat bu kabukta tüketilmiyor. | Orta | İlk odak “İçeriğe geç”; `main#main` ve `tabIndex=-1`; rotada başlık odağı/duyurusu. |

### Ortak ölçü ve yerleşim

- Masaüstünde 216px bordo sidebar, 64px üst çubuk; ana içerik 32px kenar; iki ana sütun arası 48px. Bordo içerikte yalnız birincil eylem, seçim ve odak için.
- Menü sırası: Ana Sayfa, Kişiler, Cihazlar, Sanal Okuyucular, Geçiş Kontrol, Ziyaretçiler, Canlı İzleme; 16px ara; PDKS Kayıtları, Vardiyalar, İzinler; 16px ara; Denetim Kaydı, Admin, Ayarlar. Yetkisiz öğe saklanır; kalanların sırası korunur.
- Üst çubuk soldan proje seçici, ayırıcı, breadcrumb, arama, hesap menüsü. 390px'te menü düğmesi, proje seçici, arama ikonu, avatar aynı 64px satırda. Breadcrumb üst satırda gizlenir; sayfanın h1'i ve proje kapsamı görünür kalır.
- Sistem fontu; 11/12/13/16/26/30 ölçeği; mobil başlık 24px. Yalnız açılır katmanlarda hafif gölge; tablo/alan radius 6, rozet 4, dialog 8.
- Proje adı uzun olduğunda üst çubukta ellipsis, erişilebilir adı ve açılır seçenekte tam ad. Proje değişince rota korunur, ilgili query anahtarları değişir; yeni kapsam yüklenirken eski projenin değerleri yeni isim altında gösterilmez.

### Rol matrisi — mevcut yetki modeli korunur

Kaynak: `src/lib/capabilities.ts:4`, `src/lib/routeMeta.ts:4`, `src/contexts/ActiveProjectContext.tsx:63`. Bu matris kullanıcı rolüdür; projeye özgü rol uydurulmaz. Dashboard sorguları project_user için de seçili yetkili projenin verilerini döndürür; “yalnız kendi kayıtları” görünümü mevcut sözleşme değildir.

| Alan | Süper admin | Proje yöneticisi | Üye (`project_user`) |
|---|---|---|---|
| Proje seçici | Tüm aktif projeler | Atandığı projeler | Atandığı projeler |
| Dashboard sayıları/aktivite/son kayıt | Seçili proje | Seçili proje | Seçili proje; kişisel KPI icat edilmez |
| Menü | 13 öğe | Admin hariç 12 | Denetim Kaydı, Admin, Ayarlar hariç 10 |
| Hızlı erişim | Kişiler, PDKS, Ayarlar | Kişiler, PDKS, Ayarlar | Kişiler, PDKS |
| Hesap menüsü | Profil, Ayarlar, Çıkış yap | Profil, Ayarlar, Çıkış yap | Profil, Çıkış yap |
| Komut paleti | İzinli menü hedefleri + Profil | Aynı filtre | Aynı filtre |
| Proje yok | “Henüz aktif proje yok” / Admin sayfasını aç | “Proje ataması bekleniyor” / Profilimi aç | Aynı atama metni |

Bir üyenin belirli modülde yazma yetkisi bu taramada daraltılmadı; sayfa ve sunucu yetki kontrolleri korunmalıdır. Frontend görünürlük filtresi backend yetkilendirmenin yerine geçmez.

### Katmanların davranışı

**Proje seçici:** Açılışta “Proje seç”, erişim kapsamı, arama, seçilebilir proje listesi; işaret ve `aria-pressed` seçili projeyi belirtir. Filtre sonucu yoksa “Bu adla eşleşen proje yok”; erişilen proje yoksa “Henüz erişebileceğiniz bir proje yok”. Tek projede mevcut statik etiket kullanılabilir; çok projede açılır seçici. Mockup tüm rollere örnek çoklu proje gösterir, gerçek proje sayısı varsayılmaz. Üretimde keyboard menu/combobox semantiği ortak Radix bileşeniyle kurulmalı; mockup native modal dialog içindeki butonları kullanır. Sıralama/üyelik verisi mevcut kaynaklardan gelir, yeni backend araması gerekmez.

**Hesap menüsü:** Ad, e-posta, rol; Profil; yönetici için Ayarlar; ayırıcı; Çıkış yap. Çıkış gerçek signOut pending/hatasını yansıtmalı; başarı taklidi toast yok. Mockup dosyası oturum kullanmadığından çıkış hedefini açıklayan bir önizleme açar.

**⌘K / Ctrl+K:** “Sayfaya git”, “Sayfa adı yazın…”, izinli routeMeta seçenekleri; Türkçe büyük/küçük harf eşleşmesi. Ok tuşları seçim, Enter açma, Esc kapama; sıfır sonuç “Sonuç bulunamadı. Başka bir sayfa adı deneyin.” Arama sadece navigasyondur; kişi araması, mutasyon ve toplu işlem değildir. Menüde görünmeyen yetkisiz sayfa paletten çıkmaz.

**Mobil menü:** 248px genişlik, ekran yüksekliğinde ve dikey kaydırılabilir modal panel; arka plan etkileşimsiz, Tab içeride kalır; kapat/Esc/dış alana tıklama ile kapanır, odak menü düğmesine döner. Sayfa seçimi menüyü kapatır. Desktop'a genişletilince katman kapanır. 390px'te kalıcı sidebar yer tutmaz.

**Breadcrumb:** Üst çubukta nav `aria-label="İçerik yolu"`, son öğede `aria-current="page"`; h1 kullanılmaz. Ana Sayfa kendi kendine link olmak zorunda değil. Diğer 12 sayfa kendi duplicate breadcrumb'ını kaldırmalı veya bu ortak bileşene geçirmeli; alt detaylarda gerekirse page header içinde geri bağlantısı korunabilir.

## Yeni tasarım — Ana Sayfa

### Bilgi mimarisi ve eylemler

1. **PageHeader:** “Ana Sayfa”; proje adı + “Proje özeti”; seçili kapsam/rol; İstanbul günü. Karşılama, e-posta veya yenileme düğmesi yok.
2. **StatInline:** toplam personel, aktif cihaz, bugünkü kart okumaları, pasif erişim kuralları. Sadece kesin sorgu sonucu 0 olabilir. Üretimde biçimlendirme `tr-TR` tabular-nums.
3. **İki sütun:** solda günlük aktivite, sağda rol filtresinden geçen hızlı erişim. Aktivitede çalışma saatleri, ortalama ilk giriş, ortalama son çıkış, bugünkü geç kalanlar, bugün mevcut personel; mevcut beş alan korunur.
4. **Son kart okutmaları:** en yeni en fazla 10 olay, tüm tarihler; bölüm eylemi “Canlı izlemeyi aç”. Sayfalama, filtre, satır seçim ve BulkBar eklenmez; bu bir kısa özet listesidir.
5. **Alt bilgi:** proje adı ve “İstanbul saati (UTC+3)”. Mockup ayrıca “Örnek veriler” notunu taşır; bu ürün metni değildir.

Normal dashboard'da zorunlu bir birincil mutasyon bulunmuyor; bu nedenle dolgu “Ekle” butonu üretilmedi. Proje seçilmemişte birincil “Proje seç”, sayfa hatasında “Tekrar dene”, süper admin'in sıfır proje durumunda “Admin sayfasını aç”; diğerleri ikincil navigasyon.

### Veri alanı sözleşmesi

| UI | Var olan alan | Anlam / null davranışı |
|---|---|---|
| Toplam personel | `getStats.employees` | Projedeki tüm personel; aktif personel diye yeniden adlandırılmaz. |
| Aktif cihazlar | `getStats.devices` | `isActive=true`; online/bağlı cihaz iddiası yok. |
| Bugünkü kart okumaları | `getStats.cardReadings` | İstanbul gün sınırındaki bütün durumlar. |
| Pasif erişim kuralları | `getStats.pendingRequests` | `isActive=false`; onay bekleyen iş değildir. |
| Çalışma saatleri | `getActivitySummary.workHours` | Null: “Tanımlanmamış”; boş aktivite durumunda alanlar gizlidir. |
| Ortalamalar | `averageFirstEntry`, `averageLastExit` | Null: “Henüz giriş yok” / “Henüz çıkış yok”. |
| Günlük kişiler | `lateArrivals`, `presentToday` | Null ile 0 ayrılır; presentToday null ise özetlenecek veri yok. |
| Son olay | `getRecentReadings` → `_id`, `accessTime`, `employeeName`, `devices.name`, `accessStatus` | `_id` satır anahtarı; boş isim/cihaz açık metin; tarih geçersizse “Tarih bilgisi yok”. |

`insideBuilding` backend'de olsa da mevcut A2/ana sayfa beşli özetine yeni metrik olarak eklenmedi. Çevrimiçi oranı, önceki güne kıyas, bekleyen talep sayısı ve kişisel devam oranı icat edilmedi. Mockup sayıları bu alanların temsili örnek değerleridir.

### Tablo, filtre ve rozetler

| Sıra | Kolon | Masaüstü önceliği | 390px |
|---|---|---|---|
| 1 | Tarih / Saat | %24; tarih ve saat birlikte; yıl dahil | %30; tarih ve saat iki satır |
| 2 | Personel | %28; temel kimlik | %37; ad altında cihaz bilgisi |
| 3 | Cihaz | %27; uzun ad gerektiğinde sarılır | Ayrı kolon gizli; içerik kişi hücresine taşınır |
| 4 | Durum | %21; kısa etiket, 42px satır | %33; etiket her zaman görünür |

Mobil satır yaklaşık 58px; başlık 36px. Masaüstü satır 42px, zebra yok, tablo yüzeyinde gölge yok. Bu bölümde arama/select/FilterBar yok; yalnız kabukta proje araması ve sayfa paleti bulunur. Rozet `izin_verildi` için success “İzin verildi”, reddedilmiş için danger “Reddedildi”; renk tek gösterge değildir. Beklenmeyen/eksik enum'u otomatik ret saymak yerine üretimde nötr “Durum bilinmiyor” fallback'i kullanılır; yeni bir iş durumu eklenmez.

### Durum metinleri ve ayrımlar

| Durum | Metin ve davranış |
|---|---|
| Proje listesi yükleniyor | Üst çubukta “Projeler yükleniyor”; kontrol alanı sabit genişlikte, status duyurusu. Home bölümleri iskelet; sıfır yok. |
| Proje var, seçilmemiş | “Bir proje seçin” / “Proje özetini görmek için erişebildiğiniz projelerden birini seçin.” / “Proje seç”. Mevcut provider otomatik ilk projeyi seçer (`ActiveProjectContext.tsx:100`); mockup bu **savunmacı/ürün kararı gerektiren** durumu ayrıca gösterir, mevcut kalıcı davranış diye iddia etmez. |
| Proje yok | Rol matrisindeki atama/aktif proje mesajları; sahte sıfır KPI yok. |
| Yeni proje / personel yok | Kesin 0 değerleri korunur; “Henüz personel eklenmemiş” + “Kişiler sayfasından proje personelini kontrol edin.” / “Kişileri aç”. `employees=0` güvenilir; `devices=0` yalnız aktif cihaz yoktur, proje tamamen boş iddiası yapılmaz. |
| Bölüm yükleniyor | Sayaç, aktivite ve son kayıtlar kendi iskeletlerini gösterir; status/aria-busy; hareket gerekmez. Diğer bölümler kullanılabilir kalır. Mockup ortak loading senaryosu üç bölümü birlikte gösterir. |
| Bugün veri yok, geçmiş var | Bugünkü okuma 0; “Bugün özetlenecek okuma yok”; eski tarihli kayıtlar tabloda kalır, “Son 10 kayıt · Tüm tarihler”. |
| Hiç kart kaydı yok | “Henüz kart okuma kaydı yok” + ilk okumanın burada görüneceği açıklaması; cihaz/personel bağlantıları. Üyede “Cihaz ve personel bağlantılarını yöneticinizle kontrol edin.” |
| Aktivite hatası | “Aktivite özeti alınamadı” / “Diğer proje bilgilerini görüntülemeye devam edebilirsiniz.” / “Tekrar dene”; diğer bölümler korunur. |
| Sayfa hatası | “Proje özeti yüklenemedi” / “Tekrar deneyin veya üst çubuktan başka bir proje seçin.” / “Tekrar dene”; kabuk kullanılabilir. |

Yükleniyor → boş → hata aynı ikonla tek karta indirgenmez. Proje değişiminde bölüm query'leri yeni scope altında yeniden yüklenir. Bağlantı durumu doğrulanmadan “Canlı bağlı”/“Senkronize” rozeti gösterilmez.

### Diyalog / form düzeni ve doğrulama

Home üzerinde kayıt ekleme/düzenleme formu yoktur; yeni bir form uydurulmadı. Proje/sayfa aramalarında görünür başlık, arama etiketi, sonuç listesi, sonuç yok metni ve kapatma sırası kullanılır. Arama boş olabilir, zorunluluk veya gereksiz hata üretmez. Erişimi kaldırılan proje artık listede değilse provider mevcut çözümleme davranışıyla geçerli seçime döner; frontend sahte başarı mesajı göstermez. Oturumdan çıkış mutation hatası hesap menüsünde okunabilir mesajla gösterilmeli; bu offline mockup gerçek oturumu sonlandırmaz.

## Bileşen eşlemesi ve Faz C değişiklik sınırı

| Ortak bileşen | Yer / değişecek dosya | İş |
|---|---|---|
| PageHeader | `DashboardHeader.tsx`, `Index.tsx` | Tek başlık, kapsam, tarih; userName bağımlılığı kaldırılır. |
| StatInline | `StatsGrid.tsx` | StatCard kullanımını home'dan çıkar; ortak StatCard başka tüketiciler için korunur. |
| Aktivite bölümü + QuerySectionBoundary | `ActivitySummaryCard.tsx`, `useDashboard.ts`, `Index.tsx` | Card çerçevesi kalkar, bölüm state'i ve query hata izolasyonu. Hook'un query'leri sınır altında ayrı tüketilmeli; yalnız dıştan JSX sarmalamak yeterli değil. |
| DataTable + StatusBadge | `RecentReadingsTable.tsx` | A2 yoğunluğu, null fallback, mobil cihaz satırı; doğru hedef linki. |
| EmptyState / ErrorState / SectionSkeleton | Yukarıdaki dört dashboard dosyası | Compact ve sayfa durumları, gerçek retry, yükleme/0/null ayrımı. |
| Hızlı bağlantı listesi | `QuickLinksGrid.tsx` | Kartlar yerine A2 `.quicklinks`; capabilities filtresi. |
| Ortak Shell / Sidebar / Sheet | `Layout.tsx`, `AppSidebar.tsx`, `AppSidebarNav.tsx`, `ui/sidebar.tsx` | 216px desktop, mobil modal, skip link ve ortak breadcrumb. |
| ProjectSwitcher / Popover | `ProjectSwitcher.tsx`, `ActiveProjectContext.tsx` | Arama, sonuç yok, rol kapsamı; mevcut saklama ve scope çözümleme korunur. |
| AccountMenu / Command dialog | `AppHeader.tsx`, gerekirse yeni `layout/CommandPalette.tsx` | Rolce filtreli hedefler, native/Radix odak davranışı. |
| routeMeta / capabilities | `src/lib/routeMeta.ts`, `src/lib/capabilities.ts` | Menü, palet, hızlı erişim ve breadcrumb için ortak görünürlük kaynağı; yeni yetki tanımlanmaz. |
| Tema | `src/index.css`, `tailwind.config.ts`, font yükü için `index.html` | A2 token ve sistem fontu geçişi ortak foundation işidir; bu taramada değiştirilmedi. |
| FilterBar / BulkBar / FormField | Home'da kullanılmaz | Kısa özet için filtre, seçim, toplu işlem ve form eklenmez. |

Aktif dashboard bileşeni dosyası silmek şart değil; Card importları ve userName prop'u kaldırılabilir. Ölü eski dashboard bileşenleri zaten silindiği için yeniden silme işi çıkarılmadı. Kabuk değişiklikleri diğer sayfaların aynı dosyaları eşzamanlı değiştirmemesi için önce tek ortak uygulama paketi olarak ele alınmalı.

## Backend gereksinimi

**Önerilen temel tasarım için yeni alan veya endpoint gerekmiyor.** Rol, proje isimleri, mevcut beş aktivite alanı ve son kayıt alanları yeterli; komut paleti yerel routeMeta ile çalışır.

Açık performans borcu HOME-UI-12 için `getStats` tarih okumasını mevcut `by_project_access_time` aralığına taşımak ve doğru sayımları aggregate/sayaçla ölçeklemek gerekir. Aktivite endpoint'i ortak PDKS dataset yükleyicisini kullanır; bu yükleyiciye müdahale PDKS regresyon riski taşır. Rastgele `take()` toplamların doğruluğunu bozacağı için önerilmez. Geçerli yetki kapsamı ve `projectId` doğrulaması aynen korunmalıdır.

Gerçek “tamamen boş proje” kararı istenirse aktif olmayan cihazlar ve diğer nesneleri de kapsayan kurulum durumu gerekir; mevcut mockup yalnız “personel yok / kayıt yok” der. “Sadece kendi personel kayıtlarım” gibi bir üye dashboard'u ayrıca kimlik eşleştirmesi ve sunucu filtresi gerektirir; bu tasarımda uygulanmadı.

## Açık sorular (3)

1. Mevcut otomatik ilk proje seçimi korunsun mu, yoksa ilk oturumda kullanıcıdan açık seçim mi istensin? Öneri: otomatik seçim korunsun; seçilmemiş ekran savunmacı fallback olsun.
2. Üye için proje genelindeki mevcut dashboard görünürlüğü ürünün istediği kapsam mı? Öneri: Faz C'de mevcut yetkiyi koru; kişisel görünümü ayrı yetki/veri işi olarak ele al.
3. “Bugünkü kart okumaları” adı onaylanıyor mu, yoksa yalnız izinli/geçerli fiziksel geçiş sayısı mı isteniyor? Öneri: mevcut verinin dürüst adı kullanılsın; farklı metrik ayrı kararla gelsin.

## Uygulama tahmini

**L · 24–32 saat**: ortak kabuk, mobil Sheet ve palet 10–14 saat; home hiyerarşi/rol/durum entegrasyonu 8–10 saat; 3 rol × proje/durum ve responsive/klavye doğrulaması 6–8 saat. Aggregate/sayaç ölçekleme ayrı **L · 8–16 saat** tahminidir ve temel görsel geçişi bloklamaz. Başlıca riskler ortak sidebar'ın 13 sayfaya etkisi, query hata sınırlarının doğru seviyede kurulması, proje değişiminde eski verinin yeni başlık altında görünmesi ve PDKS ile paylaşılan aktivite yükleyicisidir.

## Teslim ve doğrulama

- `mockup.html`: ağ bağımsız, tek dosya; üç rol, dokuz ana durum, proje arama/değiştirme, hesap menüsü, sayfa paleti ve mobil menü.
- `desktop.png`, `mobile.png`: üretilen ana görünüm; 1440px ve 390px görsel inceleme.
- Tarayıcı kontrolü yerel kurulu Playwright + Chrome ile **file://** üzerinden yapıldı; paket kurulmadı. CLI'nin file protokolü kısıtı nedeniyle aynı kurulu Playwright'ın doğrudan Node API'si kullanıldı.
- Kaynak kod değiştirilmediği için uygulama tsc/eslint çalıştırılmadı; bu teslimin kapısı HTML, etkileşim ve responsive kontroldür.
- Sonuç: **3 rol × 9 durum × 2 genişlik = 54 kombinasyon** yatay taşma olmadan geçti; 1440px belge genişliği 1440, 390px belge genişliği 390. Konsol/pageerror **0**, harici HTTP isteği **0**.
- Proje araması/boş sonuç/değişim, role göre menü-hızlı erişim, hesap menüsü Escape ve dönüş odağı, Ctrl+K/Türkçe filtre/ok tuşları, mobil Tab döngüsü/Escape ve bölüm retry doğrulandı. HTMLParser ile etiket dengesi ve benzersiz id kontrolü geçti.
- Ayrıntılı kontrol özeti `VERIFY.json`; açık katman görselleri `project-menu.png` ve `mobile-menu.png`. Üretim ağ/Convex davranışı ve gerçek screen reader turu bu statik mockup kontrolünün kapsamı dışındadır.

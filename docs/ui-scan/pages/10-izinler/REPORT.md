# 10 · İzinler

## Özet

İzinler, seçili projedeki kişilerin tarih aralığına bağlı izinlerini görüntülemek ve yetkili yöneticinin doğrudan onaylı kayıt açmasını sağlamak içindir. En büyük üç sorun kişi/tür/dönem filtresinin bulunmaması, tarih ve çakışma doğrulamasının yetersizliği, mevcut izni düzeltme yolunun olmamasıdır. Öneri A2 kabuğu içinde tek yoğun liste, açık takvim günü tanımı ve ekleme/düzenleme diyaloğuyla PDKS etkisini anlaşılır kılar.

## Kapsam ve kaynak gerçeği

17.10.2026 çalışma ağacı, commit edilmemiş Dalga 3a değişiklikleri dahil incelendi. `src/pages/Leaves.tsx`, `convex/leaves.ts`, `convex/lib/leaveRules.ts`, proje kapsamı, DatePicker, EmptyState, şema ve PDKS hesap yardımcıları okundu. `docs/ui-scan/current/10-izinler.png` ve `10-izinler-mobil.png` açıldı; ikisi de sıfır kayıt gösteriyor, dolu liste/form bulguları kaynak incelemesine dayanıyor. `10-izinler-2.png` yok. Canlı uygulamaya giriş, DB yazımı, uygulama kodu değişikliği yapılmadı.

Görsel kaynak `docs/ui-scan/DESIGN_DIRECTION.md` ve A2 `home.html`/`people.html`; kabuk sözleşmesi `../01-ana-sayfa/REPORT.md` → **Kabuk**. Mockup ortak kabuğun mevcut CSS/HTML/katman davranışını yeniden kullanır; yalnız aktif sayfa, breadcrumb ve sayfa içeriği değişir. PDKS sözleşmesi `../08-pdks-kayitlari/REPORT.md` ile uyumludur. Örnek kişi/ad/tarih/notlar kurgusaldır; yeni veri alanı değildir.

### Önceki audit'ten kapananlar / kapsam dışına alınanlar

| Önceki bulgu | Güncel durum ve kanıt |
|---|---|
| PPL-31 kimlik eksikliği | Ad, departman, tür, yerelleştirilmiş tarih, gün ve not gösteriliyor: `src/pages/Leaves.tsx:84`. Bu eksiklik yeniden açılmadı. |
| PPL-32 not kaybı / koşulsuz karar | Not ancak parametre varsa patch ediliyor; yalnız pending geçişi kabul ediliyor: `convex/lib/leaveRules.ts:24`. |
| PPL-34 rol / karar veren | UI yalnız iki admin rolünü kabul ediyor (`src/pages/Leaves.tsx:46`); `adminMutation` rol kontrolü (`convex/lib/customFunctions.ts:61`), sunucudan approvedBy ve approved status (`convex/lib/leaveRules.ts:11`) mevcut. |
| PPL-33 pending kısmı | Submit kilidi var, hata halinde değerler korunuyor: `src/pages/Leaves.tsx:237`, `:248`, `:262`. Tarih ve mükerrer kısmı açık. |
| PPL-37 erken sıfır / projesiz durum | Query'ler çözülene kadar spinner var; projesiz EmptyState mevcut: `src/pages/Leaves.tsx:74`. Bölüm hatası ve daha iyi boş durum hâlâ açık. |
| PPL-36 tarih ve ikon kararlar | Türkçe tarih ve metinli kararlar eklendi: `src/pages/Leaves.tsx:99`, `:297`, `:303`. Liste/filtre/düzeltme kısmı açık. |
| PPL-35 bakiye; eski talep/onay önerisi | Bakiye defteri ve talep/onay akışı bu fazın kapsamı değildir. UI hak/kullanılan/kalan sayı uydurmaz. Mevcut getBalances olması güvenilir bakiye hesap akışı olduğu anlamına gelmez (`convex/leaves.ts:114`). |

## Mevcut durum taraması

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| LEV-UI-01 | Görsel hiyerarşi / AI arayüzü izi | Başlık küçük h2 ve renkli ikon kutusuyla kartta; ikinci kartın başlığı daha baskın: `src/pages/Leaves.tsx:139`, `:146`, `:312`; masaüstü üst iki blok. | Orta | Tek h1 “İzinler”, proje/dönem alt metni, kartsız sayaç. |
| LEV-UI-02 | Yerleşim | Tüm liste 256px iç scroll'a sıkışıyor; pending kayıtlar iki listede yineleniyor: `src/pages/Leaves.tsx:279`, `:289`, `:321`. | Yüksek | Tek tablo, normal sayfa scroll'u, sayfalama; pending için ayrı kolon/listeler kurma. |
| LEV-UI-03 | Bileşen tutarlılığı / filtre | Liste ve header arasında kişi, tür, dönem filtresi yok; query yalnız projectId alıyor: `src/pages/Leaves.tsx:50`, `:137`, `:279`. | Yüksek | Kişi arama/seçimi, tür select, kesişen tarih dönemi; URL'de koru. |
| LEV-UI-04 | Mikro-metin / iş akışı | Başlık hâlâ “bekleyen” sayısını öne çıkarıyor ve koşullu onay/red yüzeyi var, oysa yeni kayıtlar doğrudan approved: `src/pages/Leaves.tsx:148`, `:292`; `convex/leaves.ts:60`. | Orta | “Bu dönemde … izin kaydı”; yeni kayıtta “Doğrudan onaylı kaydedilir.” Eski durumları salt okunur koru; yeni talep/karar akışı ekleme. |
| LEV-UI-05 | Form-diyalog / doğrulama | UI yalnız boş alan kontrolü yapıyor; minDate, başlangıç sonradan ileri alınırsa eski bitişi düzeltmiyor; sunucu string kabul edip doğrudan insert ediyor: `src/pages/Leaves.tsx:212`, `:224`, `:240`; `convex/leaves.ts:42`, `:57`. | Yüksek | Gerçek takvim tarihi + başlangıç ≤ bitiş doğrulamasını Zod ve sunucuda uygula; bitiş altında açıklama ve odak. |
| LEV-UI-06 | Form-diyalog / durumlar | Aynı kişiye aynı/örtüşen aralık kontrolü yok; insert öncesi yalnız proje/kişi yetkisi kontrol ediliyor: `convex/leaves.ts:46`–`:63`. | Yüksek | Tam mükerreri engelle; örtüşen kaydı kişi/tür/tarih ile belirt. Örtüşme politikası ürün kararı; kontrol başarısızken “çakışma yok” yazma. |
| LEV-UI-07 | Mikro-metin / veri anlamı | Kapsayıcı takvim günleri yalnız “gün” yazıyor; hafta sonu/iş günü ayrımı yok: `src/pages/Leaves.tsx:88`, `:100`. | Yüksek | “3 takvim günü”; hak ediş, ücretli gün veya PDKS izin günü iddiası üretme. |
| LEV-UI-08 | Form-diyalog / yaşam döngüsü | Form yalnız create; listede detay/düzenle eylemi ve backend update yok: `src/pages/Leaves.tsx:47`–`:49`, `:251`, `:323`; `convex/leaves.ts:26`, `:67`, `:85`. | Yüksek | Satır menüsünden “Ayrıntılar” / admin için “Düzenle”; aynı form. Update backend gereksinimi olarak ayrı kapı. |
| LEV-UI-09 | Form-diyalog / yerleşim | Form başlık ile liste arasına büyük Card olarak giriyor; açıklama tek satır input: `src/pages/Leaves.tsx:165`, `:229`. | Orta | 560px dialog; mobil tam ekran Sheet; açıklama textarea; İptal/Kaydet sabit alt bölüm. |
| LEV-UI-10 | Erişilebilirlik | Label'lar kontrol id/htmlFor ile bağlı değil, alan hataları yok: `src/pages/Leaves.tsx:173`, `:191`, `:209`, `:218`, `:228`, `:240`. DatePicker props id/aria bağlantısını taşımıyor: `src/components/ui/date-picker.tsx:13`. | Yüksek | Bağlı label + required/invalid/describedby; DatePicker ortak wrapper'ına aktar; ilk hataya odak. |
| LEV-UI-11 | Form-diyalog / kişi seçimi | Kişi listesi yalnız ad-soyad gösteriyor, arama yok: `src/pages/Leaves.tsx:174`–`:188`. Aynı adları ayıran mevcut departman seçenekte yok. | Orta | Proje kapsamlı searchable combobox; ad, departman, gerekirse mevcut e-posta. Yeni sicil alanı uydurma. |
| LEV-UI-12 | Durumlar: boş-yükleniyor-hata | Boş liste yalnız bir cümle; tüm sayfa sorgu spinner'ına bağlı, yerel query error boundary yok: `src/pages/Leaves.tsx:76`, `:333`. Görselde boş kartta eylem yok. | Orta | Başlık/filtre yerinde kalır; içerik iskeleti, ilk kayıt/filtre sonucu ayrımı, gerçek retry sınırı. |
| LEV-UI-13 | Bileşen tutarlılığı / renk | Durumlar sabit sarı/yeşil/kırmızı sınıflarda; kaydetme ve kararlar iki toast API'si kullanıyor: `src/pages/Leaves.tsx:25`, `:26`, `:124`, `:259`. | Orta | A2 StatusBadge tokenları; tek bildirim sistemi, kaydetme hatasını form içinde de koru. |
| LEV-UI-14 | Form-diyalog / hata metni | Create catch gerçek hata ayrıntısını atıp yalnız “İzin kaydedilemedi” gösteriyor: `src/pages/Leaves.tsx:262`. | Orta | Güvenli iş kuralı mesajı alan yanında; bağlantı hatası form üstünde; taslak ve retry kalır. |
| LEV-UI-15 | Durumlar / ölçek | List/listForRange proje koleksiyonunu collect edip bellekte süzüyor: `convex/leaves.ts:17`, `:108`; form tam employees listesini bekliyor: `src/pages/Leaves.tsx:54`, `:76`. Ölçülmüş gecikme yok. | Orta | Proje+dönem/kişi/tür bounded sorgu, cursor ve hafif kişi seçici; sayfa boyutu ağdaki sınırsız okumayı gizlemesin. |
| LEV-UI-16 | Mikro-metin / PDKS etkisi | Form/listede PDKS etkisi açıklanmıyor (`src/pages/Leaves.tsx:165`, `:319`), fakat onaylı kayıtlar PDKS'ye doğrudan giriyor (`convex/cardReadings.ts:280`, `:524`); durum ile bordro kodu öncelikleri farklı (`convex/lib/pdksCalc.ts:114`, `convex/lib/pdksHelpers.ts:189`). | Yüksek | Detay ve formda kısa etki açıklaması; PDKS'yi açan bağlamlı bağlantı. “Tüm günler İZN olur” veya bakiye/ücret sonucu vaat etme. |

Mobil görselde sidebar'ın içeriği daraltması ortak **SHELL-UI-01** bulgusudur; burada yeni bir kabuk bulgusu açılmadı. A2 modal mobil menü aynen kullanılır.

## Yeni tasarım

### Bilgi mimarisi ve eylemler

1. Ortak 216px sidebar, 64px üst çubuk: proje seçici, “Ana Sayfa / İzinler”, komut paleti, hesap; aktif İzinler.
2. PageHeader: “İzinler”; alt satır “Merkez Ofis · Ekim 2026”. Yalnız super_admin/project_admin için tek primary “İzin ekle”. Üye salt okunur liste/detay kullanır; kişisel izin talebi sunulmaz.
3. StatInline: “Bu dönemde 6 izin kaydı · 6 kişi”. Sayılar **filtre sonucundan**, kişi sayısı employeeId distinct; süre toplamı/bakiye yok. Büyük veri sayımları ayrı API gerektirir.
4. FilterBar: kişi arama/seçimi, tür, dönem, Filtreleri temizle; sağda sayfa boyutu. Ardından tek tablo.
5. Nötr kısa açıklama: “İzinler yöneticiler tarafından doğrudan onaylı kaydedilir.” Satır detayı PDKS açıklamasına açılır. Normal sayfa scroll'u; 25/50 sayfa boyutu, önceki/sonraki.
6. Önizleme senaryoları mockup sonunda ayrı `<details>` içindedir; üretim ürünü değildir. Üye, boş, hata, yükleniyor, eski durumlar ve kaydetme hatası gözlenebilir.

Yeni talep, onay/red, onay kuyruğu, karar gerekçesi ve bakiye sekmesi bu uygulama kapsamına alınmaz. Gelecekte durum filtresi ve detay geçmiş bölümü eklenebilecek tek tablo/detay yapısı korunur; görünür “yakında” düğmeleri yok. Legacy pending/rejected saklanmaz; kaynak durum etiketiyle salt okunur detaydan erişilir ve yeni formda durum seçilemez. Eski kaydı approved'a çevirecek işlem ürün kararı gelmeden kurulmaz.

### Takvim / özet tercihi

Bu fazda ayrı takvim önerilmiyor: kişi/tür/dönem filtresi ve mevcut Vardiyalar izin katmanı aynı işi ikinci kez üretmeden karşılar. Kartsız kayıt/kişi sayacı yeterli; yıllık bakiye veya ücret özeti yok. Ekipte aynı gün kaç kişinin bulunmadığını planlama ihtiyacı doğrulanırsa ikinci aşamada aynı filtre kaynağından hafta ajandası eklenebilir; yeni takvim önce kişi+gün kesişimini, büyük ekipte sayfalama ve PDKS gün anlamını netleştirmelidir.

### Kolonlar ve 390px davranışı

| Sıra | Kolon / veri | Genişlik ve öncelik | 390px |
|---|---|---|---|
| 1 | Kişi; employees.firstName/lastName, departments.name | 24%, yüksek; detay açan ad | Ana satır, departman alt metin |
| 2 | İzin türü; leaveType sözlüğü | 17%, yüksek | Aynı satırın ikinci metni |
| 3 | Tarih aralığı; startDate/endDate | 23%, yüksek, tabular-nums | Tam tarih ikinci satır |
| 4 | Süre; kapsayıcı takvim günü | 13%, orta | Tarih altında |
| 5 | Durum; status | 13%, yüksek | Metinli rozet |
| 6 | İşlemler | 10%, 36px ⋯ hedef, sağ | Sağ üst; kişi adıyla erişilebilir ad |

Tablo 12px, 36px başlık ve 42px satır; kişi/departman iki kısa satır, uzun isimler taşmadan sarılır, gerekirse satır büyür. Açıklama uzunluğu liste ritmini bozmaz; detayda tam metin. Mobil tablo yerine aynı sorgu/sıra/eylemlerden üretilen semantik liste: hiçbir temel alan kaybolmaz, açıklama/createdAt/updatedAt detayda. 16px kenar, 24px h1; kişi araması tam satır, tür/dönem iki sütun; dialog 100dvh Sheet, alanlar tek sütun, iç dikey scroll, en az 36px aralıklı hedef. Belge yatay taşmaz.

### Filtre ve durum sözleşmesi

- Dönem varsayılanı İstanbul'daki geçerli ay. Mockup tarihi 17.10.2026 sabit. Ay seçimi ve “Özel aralık” diyaloğu; boş/ters aralık uygulanmaz. Kesişim `startDate <= filterEnd && endDate >= filterStart`; önceki ay başlayıp bu ay biten izin de listelenir. Dönem filtresi kaydın süresini kısaltmaz.
- Kişi araması ad/departman; uygulamada kişi seçildiğinde ID ile filtre. Tür: mevcut 10 enum, “Tüm türler”. Formda evlilik/vefat/babalık etiketlerine doğrulanmamış süre kuralı eklenmez. Saatlik birim desteklenmediğinden tür seçimi saat hesabı doğurmaz.
- Filtre/sıra/pageSize URL'de; filtre ve proje değişince cursor sıfırlanır. Proje değişince eski veriler yeni başlık altında tutulmaz; açık taslak varsa önce koruma sorusu. Filtre temizleme kişi/türü sıfırlar, dönemi geçerli aya döndürür.
- Varsayılan sıra başlangıç azalan, eşitlikte ID ile kararlı. Kayıt sayısı yalnız tüm filtreli küme biliniyorsa kesin toplam; aksi halde “25 kayıt gösteriliyor”. Seçili örnekte tüm fixture yüklenmiştir.
- Approved → **Onaylı** success; legacy pending → **Beklemede** warning; rejected → **Reddedildi** danger. PDKS gün durumunda **İzinli** info; “Onaylı” ile “İzinli” ayrı anlamdadır. Renk tek bilgi taşıyıcı değildir.
- Toplu seçim/BulkBar yok: mevcut toplu izin işlemi yok, işlevsiz checkbox eklenmez.

### Form ve detay

“İzin ekle” 560px Dialog/Sheet: **Kişi → İzin türü → Başlangıç/Bitiş → hesaplanan takvim süresi → Açıklama (isteğe bağlı) → etki bilgisi → İptal/Kaydet**. Seçili proje metin olarak görünür, ayrıca proje alanı yok. Kişi seçimi projeye bağlı; eşleşen kişi yoksa “Bu projede seçilebilecek kişi yok” ve Kişiler bağlantısı. Kişi yükleme hatası formda ayrı retry, listeyi engellemez.

Zorunlu alan altında “Bir kişi seçin.”, “Başlangıç tarihini girin.”, “Bitiş tarihini girin.”; geçersiz tarih “Geçerli bir tarih girin.”; ters aralık “Bitiş tarihi başlangıçtan önce olamaz.” Çakışmada “Bu kişi için seçilen tarihlerle çakışan izin var.” ve mevcut aralığı gösteren bağlantı; tarih boşken süre çizgi olur. UI/server aynı kuralı uygular. Saat/yarım gün, iş günü ve hak ediş bu şemayla hesaplanmaz.

Düzenle aynı formu doldurur; kişi sabit, tür/tarih/not değişebilir. Approved korunur, editedBy gibi mevcut olmayan kimlik gösterilmez; yalnız `updatedAt` varsa “Son güncelleme”. Notes temizleme API sözleşmesi açık olmalı. Bekleyen/reddedilmiş eski kayıt detaydan okunur; yeni düzenleme yolu yalnız approved kayıtları hedefler. Gerçek update endpoint'i tamamlanmadan üretimde aktif Düzenle açılmaz; mockup bu önerinin etkileşimli tasarımını yerel bellekte gösterir.

Kaydet sırasında “Kaydediliyor…” ve form kilitli; başarısızlıkta açık kalır, değerler korunur, üstte “İzin kaydedilemedi. Bilgileriniz korunuyor; tekrar deneyin.”; gerçek mutation başarısından sonra kapanır. Değişmiş form İptal/Escape/arka plan ile kapatılırken “Değişiklikler kaydedilmedi” + “Düzenlemeye dön” / “Vazgeç”. Proje değişiminde de aynı koruma. Detay kişi/departman, tür/durum, tarih/süre, açıklama ve PDKS açıklamasını içerir; admin Düzenle, herkes PDKS'yi aç eylemi.

### PDKS etkisi — 08 raporuyla ortak sözleşme

Onaylı izin tarih aralığı kişi+gün eşleşmesiyle PDKS hesaplarına girer (`convex/cardReadings.ts:280`, `:524`, `:1337`). **Takvim günü sayısı PDKS izin günü toplamı değildir.** Detay/gün durumu devam varsa Mevcut/Geç, devam yoksa İzinli olabilir (`convex/lib/pdksCalc.ts:114`); bordro kodunda resmî/yarım gün tatili RT, hafta tatili HT, diğer günlerde izin İZN önceliğindedir (`convex/lib/pdksHelpers.ts:189`). Bu farklı gösterimler tek bir kesin sonuç gibi birleştirilmez.

Form metni: “Bu kayıt doğrudan onaylı kaydedilir. İzin tarihleri PDKS hesaplarında kullanılır; devam ve tatil bilgileri gün sonucunu değiştirebilir.” Detay metni: “Takvim süresi, puantajdaki izin günü toplamı değildir. Gün durumunu ve bordro kodunu PDKS kayıtlarında inceleyin.” Ücretli/ücretsiz etiketinden ücret kesintisi, bakiye düşümü, kart erişimi kapatma veya çalışma hareketi silme sonucu çıkarılmaz. Yeni ücret/mesai hesabı ve biyometrik kaynak öğesi eklenmez.

“PDKS kayıtlarını aç” aynı projectId/employeeId/tarih aralığını hedef sayfanın filtre sözleşmesine taşır; mevcut rota parametre desteği doğrulanmadan çalışan bağlantı vaadi verilmez. Mockup linki gerçek uygulamaya açılmaz, hedef bağlamı gösterir. Kaydetme sonrası mevcut reaktif sorguların izin değişikliğini yeniden hesaplaması ve gün/dönem/export tutarlılığı Faz C'de doğrulanır; backend'e yazıldığı anda her bordro çıktısının güncellendiği iddia edilmez.

### Boş, yükleniyor, hata metinleri

| Durum | Metin / eylem |
|---|---|
| İlk kayıt yok | “Henüz izin kaydı yok.” / “Bu proje için ilk izin kaydını ekleyin.” / admin: İzin ekle; üye: “Yöneticiniz kayıt eklediğinde burada görünür.” |
| Filtre sonucu yok | “Bu filtrelerle eşleşen izin yok.” / “Kişi, tür veya dönemi değiştirin.” / Filtreleri temizle |
| Liste yükleniyor | Bölüm içi 5 satır iskelet; role=status “İzin kayıtları yükleniyor.”; sahte sıfır yok |
| Query hatası | “İzin kayıtları yüklenemedi.” / “Tekrar deneyin. Filtreleriniz korunur.” / Tekrar dene (error boundary reset + yeniden query) |
| Yetki yok | “Bu projedeki izinleri görüntüleme yetkiniz yok.” / Proje seç; yazma yetkisi yoksa eylem saklı |
| Proje seçilmemiş | “Bir proje seçin.” / “İzin kayıtlarını görmek için üst çubuktan proje seçin.” |
| Kişi artık bulunamıyor | “Personel bulunamadı” + kayıt tarih/türünü koru; admin'e kişi bağlantısını kontrol etme metni |

## Bileşen eşlemesi

| Ortak bileşen | Kullanım ve değişecek dosyalar |
|---|---|
| PageHeader / StatInline | `src/pages/Leaves.tsx` başlık kartı ve bekleyen sayacı yerini alır. |
| FilterBar / DataTable | Leaves içindeki iki ul/Card yerine yeni `src/components/leaves/LeaveFilters.tsx`, `LeaveList.tsx`; aynı veriyle mobil liste. |
| StatusBadge | `getStatusBadge` sabit sınıfları yerine approved/pending/rejected token eşlemesi. |
| EmptyState / ErrorState / Skeleton | Yerel p ve tam sayfa spinner yerine içerik bölümü; query hatasını yakalayan gerçek sınır. |
| Dialog/Sheet + Form alanları | Yeni `LeaveForm.tsx`, `leaveFormSchema.ts`, `LeaveDetails.tsx`; RHF z.infer; ortak kişi combobox ve DatePicker label sözleşmesi. |
| BulkBar | Kullanılmaz; backend'de toplu işlem olmadığı için yeni alan açılmaz. |
| Mevcut destekler | `useActiveProjectScope`, `useAuth`, `src/lib/date.ts` korunur; `convex/leaves.ts` endpoint ve doğrulama genişletmesi aşağıda. |

Üretimde `FunctionReturnType<typeof api.leaves.list>` / gerçek query tipi korunur; any, snake_case mapping veya non-null assertion eklenmez. Ortak tema, shell ve DatePicker değişiklikleri ortak bileşen sahibine devredilir; bu rapor yalnız kendi klasörünü değiştirir.

## Backend gereksinimi

1. **Gerekli:** create + yeni update için gerçek ISO tarih doğrulaması, aralık sırası, kişi/proje/rol kontrolü, mükerrer kontrolü ve ürünce seçilen örtüşme kuralı. UI kilidinden bağımsız idempotent tekrar gönderim; update yarışında sürüm/updatedAt denetimi. Approved yeni kaydın tek durumu kalır.
2. **Gerekli:** `leaves.update` (adı öneri) adminMutation; kişi/proje sabit, approved kaydı düzenler; notes açıkça temizlenebilir, updatedAt değişir. Denetim izi gerekiyorsa mevcut audit altyapısıyla bağlanır; actor adı ve önce/sonra geçmişi mevcut list API'sinde olmadığı için mockup'ta uydurulmaz.
3. **Ölçek kapısı:** list'in dönem/type/employee filtreleri + cursor; kesişen aralık sorgusu ve deterministik sıra için index stratejisi, hafif kişi seçici. Kesin kayıt/distinct kişi sayaçları için bounded sonuçtan ayrı aggregate sözleşmesi. Şema değişikliği tek sahibiyle yapılır.
4. **Entegrasyon:** PDKS kişi+dönem link parametreleri ve izin değişince gün/dönem/puantaj/export yeniden hesap doğrulaması. Mevcut PDKS tarih/tatil/devam önceliği ürün onayı olmadan değiştirilmez.
5. **Bu faz dışında:** saatlik/yarım gün birimi, bakiye defteri/hak ediş, iptal/geri alma yaşam döngüsü ve talep/onay iş akışı. `leaveBalances` tablosu bulunması bu hesapların hazır olduğu anlamına gelmez.

## Açık sorular

1. Eski pending/rejected kayıtlar salt okunur tutulacak mı, yoksa ayrı bir veri geçiş kararı mı alınacak? Tasarım varsayımı salt okunur korumadır; otomatik onay veya silme yok.
2. Aynı kişinin kısmen örtüşen iki onaylı izni tamamen engellensin mi? Tasarım varsayımı tam mükerrer engeli ve örtüşmede kaydetmeyi durdurmadır; tür bazlı istisna gerekiyorsa kural belirlenmeli.
3. Süt izni gibi türlerde yalnız tam gün kaydı bu faz için kabul ediliyor mu? Saatlik/yarım gün istenirse ayrı veri modeli ve PDKS hesabı gerekir; mockup saat sonucu üretmez.

## Uygulama tahmini ve riskler

**M · 20–28 saat** ortak A2 kabuk hazırken: filtre/tablo/mobil 6–8; form/detay/erişilebilirlik 6–8; durumlar ve entegrasyon kontrolleri 4–6; görsel/klavye kabul 4–6. Gerekli update/doğrulama/çakışma ve bounded sorgu işleri ayrı **12–20 saat**; yeni bakiye veya onay iş akışı dahil değildir. Riskler eski durumların yönetimi, takvim günü/PDKS sonucu ayrımı, iki yönetici eşzamanlı düzenlemesi, proje değişiminde taslak ve query kapsamı, büyük kişi seçenekleri.

Faz C kabulü: aynı adlı farklı kişiler; ay sınırını kesen izin; tek gün/ters/geçersiz tarih; tam/kısmi çakışma; yeniden submit; notu temizle; hata sonrası taslak; üyenin doğrudan API yazmasının reddi; proje değişiminde eski kişiyle submit engeli; izin+devam ve izin+tatil PDKS görünümü. Anlamlı backend testleri, proje tsc/eslint kapıları ve 1440/390px klavye kontrolü uygulanmalı. Bu tasarım tesliminde uygulama kodu değişmediğinden uygulama testleri çalıştırılmadı.

## Teslim doğrulaması

Mockup `file://` ile kurulu Playwright + Chrome headless üzerinden açıldı; ağdan paket kurulmadı. HTML tek dosyadır, bütün SVG/CSS/JS içeridedir; HTTP(S) kaynak isteği **0**, JS/console hatası **0**. `python3` standart `html.parser` yığın kontrolüyle eşleşmeyen/kapanmamış etiket **0**.

| Kontrol | Sonuç / kanıt |
|---|---|
| 1440×900 liste | `documentElement.scrollWidth = clientWidth = 1440`; [check-1440.png](check-1440.png) |
| 390×844 liste | `documentElement.scrollWidth = clientWidth = 390`; [check-390.png](check-390.png) |
| Ekleme formu | Masaüstü dialog ve mobil Sheet açılıp kapandı; [check-form-1440.png](check-form-1440.png), [check-form-390.png](check-form-390.png) |
| Mobil detay | İçerik yatay taşmadı; [check-detail-390.png](check-detail-390.png) |
| Filtreler | Kişi → 1, yıllık → 3, Kasım → boş; özel 01–03 Ekim aralığı → Eylül'de başlayan 1 izin; temizle → 6 kayıt |
| Form | Zorunlu kişi, ters tarih ve örtüşme hatası; Escape taslak koruma; yerel kayıt ekleme; düzenlemede sabit kişi; hata sonrası açıklama korundu |
| Rol / eski durum | Üyede ekle/düzenle gizli; eski pending kayıtta düzenle gizli; liste hata retry; proje değişiminde eski kayıtlar kayboldu, kişi seçenekleri yeni kapsamla sınırlı |
| Kabuk / erişilebilirlik | Mobil menü açıldı, Escape kapattı ve açan düğmeye odağı döndürdü; modal içinde klavye turu kontrol edildi |

Bu doğrulama statik tasarımı kapsar. Gerçek Convex update, query hata sınırı, API rol reddi, URL filtre aktarımı ve PDKS yeniden hesaplama Faz C entegrasyon kapılarıdır; mockup bunların üretimde tamamlandığını iddia etmez.

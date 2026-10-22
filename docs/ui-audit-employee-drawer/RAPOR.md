# Personel drawer’ı UI/UX denetimi

Yeni ve Düzenle aynı formu paylaşır; ücret, Aktif, fotoğraf ve erişim kuralı seçimi her ikisinde de vardır, asıl fark kayıtlı kişiye bağlı yönetim kartlarıdır. Öncelik, taslağı kaybettiren drawer içi gezinmeyi korumak, düzenlemenin ilk odağını düzeltmek ve dokunma hedeflerini büyütmektir: **1 Y / 11 O / 6 D, toplam 18 bulgu**.

## Kapsam ve kanıt

22.10.2026 tarihinde mevcut, commit edilmemiş çalışma ağacı incelendi; spec’teki tüm kaynak dosyalar okundu. Girişli localhost:8081’de yalnız denetim için açılan Orca sekmesinde Yeni ve yönetici Düzenle modları incelendi; 1161×876 ve 390×844 görünümü, alan etiketleri, ilk odak, Esc, dirty uyarısı ve Vazgeç kontrol edildi. Sekme kapatıldı. Kaydet/form gönderme, dosya yükleme, İşten çıkar, Sil, cihaz gönderimi, rıza veya parmak izi işlemi yapılmadı; kaynak değişikliği, commit/push/deploy/migration/DB yazımı yapılmadı.

Kaydetme, sunucu hatası, silinmiş kayıt, eşzamanlı güncelleme, project_user ve biyometri açık dalları **kaynak incelemesine** dayanır; canlıda bu durumlar üretilmedi. Aktif projede biyometri kapalıydı. Proje değiştirme koruması kaynakta doğrulandı; proje değiştirilmedi. Gerçek ekran okuyucu, mobil sanal klavye ve karanlık tema testi yapılmadı. Ekran görüntüleri geçici yerel kanıttır; müşteri verisi içerdiği için rapora gömülmedi:

- `/tmp/emp-audit-new-desktop.png`
- `/tmp/emp-audit-new-390.png` — yalnız yerel taslakta DENETIM yazısı, kaydedilmedi.
- `/tmp/emp-audit-edit-390.png`
- `/tmp/emp-audit-edit-dirty-390.png`

## İki mod fark tablosu

| Özellik | Yeni | Düzenle | Öneri / yeni kayıtta da olmalı mı? |
|---|---|---|---|
| Başlık ve açıklama | Personel ekle; zorunlu alan açıklaması | Personel düzenle; aynı zorunlu alan açıklaması | Başlıklar doğru; düzenlemede anında uygulanan kartlar ile Kaydet bekleyen alanların sınırını açıklayın. |
| Ad, soyad, e-posta | Boş, zorunlu; ilk odak Ad | Dolu, aynı zorunluluk; ilk odak İşten çıkar | Alan eşitliği korunsun; düzenleme odağı başlığa veya Ad’a gitsin. |
| E-posta yardım metni | Kurulum bağlantısı gönderileceğini söyler | Aynı metin; güncelleme akışı e-posta göndermiyor | Yeniye özel vaat; düzenlemede bağlantı gönderiminin ayrı işlem olduğunu söyleyin. |
| Şirket/departman/pozisyon | Atanmamış seçilebilir | Dolu veya Atanmamış | Her iki modda da olmalı; boş katalog ile atama yapılmamasını ayırın. |
| Aktif kutusu | Var, varsayılan işaretli | Var, kayıt değerinde | Yeni kayıtta da olmalı; Pasif’in erişim etkisini açıklayın. Ayrılma rozetiyle aynı kavram olmadığı anlaşılmalı. |
| Kart/TC/bordro | Kart zorunlu, diğerleri isteğe bağlı | Aynı alanlar | Her iki modda da olmalı; biçim örnekleri ekleyin. |
| Ücret, eski vardiya notu, notlar | İsteğe bağlı diğer alanlarda kapalı | Aynı yerde kapalı; kayıtlı değerler de gizlenir | Her iki modda da olmalı; düzenlemede dolu alanları işaretleyin veya açın. |
| Erişim kuralı ekle | Tek kural seçimi; kayıtla eklenir | Aynı eklemeli seçim; mevcut üyeliği seçili göstermez | Yeniye de gerekli. Ekleme ile mevcut erişim özetini aynı bölümde gösterin. |
| “Mevcut erişim üyelikleri” metni | Yok | Embedded koşulu nedeniyle bu drawer’da yok; aşağıda Erişim yetkileri var | Yeni kayıtta mevcut üyelik beklenmez. Düzenlemede mevcut üyelikler formun Erişim bölümüne taşınmalı. |
| Erişim yetkileri kartı | Yok | Mevcut kurallar, aktif/pasif rozetleri ve yönetim bağlantısı | Kayıt öncesi gerçek üyelik listesi gereksiz; seçilen kuralın uygulanacak kapsamı özetlenebilir. |
| Cihaz senkron durumu | Kart yok; Kaydet sonrası gönderim özeti | Kalıcı cihaz durum kartı + Kaydet sonrası gönderim özeti | Kalıcı kart kayıt sonrası olmalı; yeni akışından kaydın ayrıntısına geçiş verin. Gönderim ile cihaz teslim doğrulamasını ayıran mevcut metin korunsun. |
| Parmak izi | Yok | Yalnız yönetici ve biyometri modülü açıkken; rıza/aktiflik/cihaz önkoşullu | Bilinçli olarak kayıt sonrası işlem olmalı; yeni kayıtta yalnız sonraki adım bilgisi yeterli. |
| KVKK rızaları | Yok | Tür bazında rıza geçmişi/durumu ve ayrı işlemler | Yeni kayıtta bilgilendirme ve kayıt sonrası rıza adımına geçiş olmalı. İlk formda beyan kaydı gerekiyorsa açık ürün kararıyla ayrı aşama tasarlayın; tek bir genel onay kutusu eklemeyin. |
| Son geçişler | Yok | Son 5 kayıt ve Tüm geçişler bağlantısı | Bilinçli olarak yalnız kayıtlı kişide olmalı. |
| Fotoğraf seçimi | Var | Aynı yükleme alanı + altta kayıtlı fotoğraf/boş durum | Yeniye de gerekli; yönetici düzenlemesinde ikinci fotoğraf gösterimini kaldırın. |
| Ad/durum/bordro özeti | Yok | Üstte kayıtlı değerler | Kayıtlı kişiye özgü olmalı; taslak değişiklikle kayıtlı başlık ayrımını belirtin. |
| İşten çıkar / Geri al | Yok | Çalışma durumuna göre var; pasif ve ayrılışsız kişide yok | Bilinçli olarak yalnız kayıtlı kişide; formun kaydetme davranışından ayrılmalı. |
| Sil / Cihazlara gönder / Mobil bağlantı gönder | Drawer’da yok | Drawer’da yok; satır menüsünde var | Yeni kayıtta gerekmez. Düzenlemeden erişimi tutarlı bir İşlemler menüsünde toplamak değerlendirilebilir. |
| Kaydet/Vazgeç | Her zaman görünür; Vazgeç kapatma korumasına gider | Yalnız dirty/pending iken; Vazgeç doğrudan formu sıfırlar, drawer açık kalır | Davranış farkını “Değişiklikleri geri al” etiketiyle görünür yapın. |
| Kaydet sonrası | Kaydedildi → kurulum e-postası → cihaz gönderimi → Tamam; Tamam kapatır | Kaydedildi → cihaz gönderimi → Tamam; Tamam formu yeniden kurar, drawer açık kalır | E-posta farkı bilinçli. Yeniye “Ayrıntılara devam et” seçeneği; düzenlemede Tamam sonrası odağı belirgin başlangıca taşıma önerilir. |
| project_user | Ekleme eylemi yok | Personel ayrıntısı: genel bilgiler salt okunur, yönetici formu/işten çıkar/parmak izi yok | Yetki farkı korunmalı; ayrı rol oturumunda görsel doğrulama yapılmalı. |

## Bulgular — önem sırasıyla

### 1. Y — Drawer içindeki SPA bağlantısı kaydedilmemiş taslağı kaybettiriyor

**Yer:** `src/components/employees/EmployeeDetails.tsx:103`, `src/components/employees/EmployeeRecentReadings.tsx:36`, `src/components/employees/SlideOverPanel.tsx:34`, `src/components/shared/UnsavedChangesDialog.tsx:35`.

**Sorun:** Kapatma ve proje değişimi guard’dan geçer; ancak iç React Router bağlantıları için gezinme koruması kurulmamış. Ad alanına yalnız yerel DENETIM taslağı yazıldıktan sonra “Geçiş Kontrol · Üyelikleri yönet” bağlantısının DOM click’i `/access-control` adresine geçti; alertdialog açılmadı ve form unmount oldu. `beforeunload` SPA gezinmesini kapsamaz.

**Öneri:** İç bağlantıları da ortak requestClose/navigasyon korumasından geçirin; Tüm geçişler ve tarayıcı geri/ileri yollarını da kapsayın. Formdaki düz `<a href>` bağlantısının tam sayfa gezinmesini de aynı davranışa bağlayın. **Kanıt:** canlı URL/DOM gözlemi; Kaydet kullanılmadı.

### 2. O — Düzenlemede ilk klavye odağı İşten çıkar’a gidiyor

**Yer:** `src/components/employees/EmployeeDetails.tsx:63`, `src/components/employees/EmployeeEmploymentActions.tsx:14`, `src/components/employees/EmployeeForm.tsx:161`.

**Sorun:** Yeni form Ad’a odaklanıyor; düzenleme formu autofocus almıyor ve Radix ilk odaklanabilir kontrol olan İşten çıkar’ı seçiyor. Rutin bilgi düzenleme akışı riskli eylemden başlıyor.

**Öneri:** Drawer açılışında başlığa veya Ad alanına açıkça odak verin; kapanışta satır tetikleyicisine dönüşü de tanımlayın. **Kanıt:** canlı `document.activeElement` ve `/tmp/emp-audit-edit-390.png`.

### 3. O — 44 px dokunma hedefi birçok kontrolde sağlanmıyor

**Yer:** `src/components/employees/EmployeeFormFields.tsx:82`, `src/components/employees/EmployeeFormFields.tsx:168`, `src/components/employees/FormActions.tsx:14`, `src/components/ui/sheet.tsx:98`, `src/components/ui/button.tsx:23`.

**Sorun:** Canlı ölçümde input/select, Kaydet/Vazgeç, İşten çıkar, rıza butonları ve Kapat 36 px yüksekliğinde; kapalı “diğer alanlar” summary yaklaşık 19 px. Projenin 44 px kuralına uymaz. Aktif’in label’ı 44 px, fotoğraf butonunun pseudo-elementi genişletilmiş olduğundan bunları yalnız görünen ikon boyutuyla hatalı saymamak gerekir.

**Öneri:** Drawer kontrollerine en az 44 px etkileşim alanı verin; summary ve bağlantılara yeterli dikey padding ekleyin. **Kanıt:** canlı boundingClientRect ölçümü; yeni/düzenle 390 px ekranları.

### 4. O — Silinmiş kayıtta Listeye dön drawer’ı kapatmıyor

**Yer:** `src/components/employees/EmployeeForm.tsx:121`, `src/components/employees/SlideOverPanel.tsx:99`, `src/components/employees/EmployeeDetails.tsx:35`.

**Sorun:** Silinmiş kayıt için formdaki Listeye dön `onClose` çağırıyor; embedded yolda bu callback gerçek kapatma değil `resetForm`. Dolayısıyla yeniden aynı boş durum çizilebilir. Üst ayrıntı da liste kaydını bulamayınca eski employee prop’una döndüğü için silinmiş kişinin başlığı ve bazı kartları kalabilir.

**Öneri:** “Formu sıfırla” ile “drawer’ı kapat” callback’lerini ayırın; silinmiş kaydı drawer seviyesinde tek boş durum ve gerçek Listeye dön eylemiyle ele alın. **Kanıt:** kaynak akışı; canlı kayıt silinmedi.

### 5. O — Aynı Vazgeç etiketi iki farklı sonuç veriyor

**Yer:** `src/components/employees/SlideOverPanel.tsx:38`, `src/components/employees/SlideOverPanel.tsx:99`, `src/components/employees/SlideOverPanel.tsx:113`.

**Sorun:** Yeni modda Vazgeç dirty uyarısı üzerinden kapatır; düzenlemede onay istemeden tüm taslağı sıfırlar ve drawer açık kalır. Düzenlemede sıfırlama sonrasında odaklanılan buton da kaldırılıyor; canlıda odak dialog kabına döndü.

**Öneri:** Düzenlemede “Değişiklikleri geri al” kullanın, geri alma sonrasında Ad’a veya bölüm başlığına odak verin; kapsamlı taslakta onay gerekip gerekmediğini kararlaştırın. **Kanıt:** iki modda canlı Vazgeç denemesi; hiçbir değişiklik kaydedilmedi.

### 6. O — Düzenleme e-posta metni gerçekleşmeyen gönderimi vaat ediyor

**Yer:** `src/components/employees/EmployeeFormFields.tsx:115`, `src/components/employees/hooks/useEmployeeFormSubmit.ts:108`.

**Sorun:** “Mobil giriş kurulum bağlantısı bu adrese gönderilir” her modda var, gönderim yalnız yeni kişi dalında. E-postayı değiştiren yönetici yeni bağlantının gönderildiğini düşünebilir.

**Öneri:** Yeni modda mevcut yardım metnini koruyun; düzenlemede otomatik gönderim olmadığını ve satır menüsündeki Mobil giriş bağlantısı gönder işlemini açıklayın. **Kanıt:** canlı metin ve kaynak koşulu.

### 7. O — Mevcut erişim üyelikleri ekleme kontrolünden uzak

**Yer:** `src/components/employees/EmployeeForm.tsx:148`, `src/components/employees/EmployeeFormFields.tsx:152`, `src/components/employees/EmployeeDetails.tsx:80`.

**Sorun:** Üyelik özeti `employee && !embedded` nedeniyle kullanılan düzenleme drawer’ında hiç çıkmaz. “Kural eklenmesin” seçili görünürken kişinin mevcut kuralı formun daha aşağısındaki ayrı karttadır; özellikle telefonda mevcut erişimi anlamak için uzun kaydırma gerekir.

**Öneri:** Düzenleme formunun Erişim bölümünde mevcut üyelikleri özetleyin; ekleme seçimini “Ek kural ekle / Ek kural seçilmedi” olarak netleştirin. Yeni modda yalnız uygulanacak seçimi özetleyin. **Kanıt:** canlıda mevcut NGS üyeliğine rağmen formdaki boş seçim; kaynak koşulu.

### 8. O — Yeni kayıt akışı sonraki yönetim adımlarına bağlanmıyor

**Yer:** `src/components/employees/EmployeeForm.tsx:207`, `src/pages/Employees.tsx:228`, `src/components/employees/hooks/useEmployeeFormSubmit.ts:106`.

**Sorun:** Yeni kayıtta rıza ve biyometri adımları görünmüyor; başarı ekranındaki tek Tamam yeni drawer’ı kapatıyor. Kayıtlı kişinin id’si üst akışa sonuç olarak taşınmadığından yönetici kişiyi yeniden bulup açmak zorunda. Kaydet sonrası cihaz gönderimi doğrulanmış teslim anlamına gelmediği için kalıcı durum kartına devam etmek de yararlı.

**Öneri:** Başarı sonucunda kaydedilen id’yi döndürün, Tamam yanında “Ayrıntılara devam et” sunun; rızalar ve koşullu parmak izi işlemini kayıt sonrası aşama olarak tanıtın. **Kanıt:** kaynak incelemesi; canlı kaydetme yapılmadı.

### 9. O — Fotoğraf seçimi Kaydet’ten önce sunucuya yazıyor

**Yer:** `src/components/employees/hooks/usePhotoUpload.ts:32`, `src/components/employees/EmployeeForm.tsx:88`, `src/components/employees/PhotoUpload.tsx:30`.

**Sorun:** Fotoğraf seçimi anında upload URL, POST ve claimUpload çağırıyor; formdaki diğer alanlar ise Kaydet bekliyor. Kullanıcı Vazgeç’in fotoğrafı da yalnız yerel taslak gibi geri aldığını varsayabilir. Form kodunda iptal edilen yüklemeyi geri alma görünmüyor; saklama/temizlik davranışı bu denetimde doğrulanmadı.

**Öneri:** Yüklemeyi kayıt aşamasına erteleyin veya geçici yükleme olduğunu açıklayıp iptal temizliğini tanımlayın; rıza yönetimine devam yolunu fotoğraf alanıyla ilişkilendirin. **Kanıt:** yalnız kaynak; dosya seçilmedi/yüklenmedi.

### 10. O — Canlı kayıt güncellenirken form ve başlık farklı sürümlerde kalabilir

**Yer:** `src/components/employees/EmployeeDetails.tsx:35`, `src/components/employees/hooks/useEmployeeFormData.ts:143`.

**Sorun:** Başlık ve kartlar reaktif liste sonucunu kullanıyor; form yalnız employee id değişince başlangıç verisini alıyor. Başka yönetici aynı kişiyi değiştirdiğinde temiz form bile eski kalabilir; Kaydet tüm paylaşılan alanları gönderdiği için eski değerlerin yeniden yazılması riski var.

**Öneri:** Temiz formu güncel kayıtla yenileyin; dirty formda “Kayıt başka yerde değişti” uyarısı ve yeniden yükleme/birleştirme seçeneği verin. **Kanıt:** kaynak incelemesi; canlı eşzamanlı yazma yapılmadı.

### 11. O — Dolu ücret/not alanları düzenlemede de kapalı ve işaretsiz

**Yer:** `src/components/employees/EmployeeFormFields.tsx:34`, `src/components/employees/EmployeeFormFields.tsx:163`.

**Sorun:** Diğer alanlar her açılışta kapalı; yalnız ücret hatası varsa otomatik açılıyor. Kayıtlı maaş, saatlik ücret veya not bulunduğuna dair özet yok; “düzenlemede olup yeni kayıtta yok” hissini her iki yönde de güçlendiriyor.

**Öneri:** “Ücret ve diğer bilgiler” gibi daha açıklayıcı başlık ve dolu alan sayısı/özeti gösterin; düzenlemede mevcut değer varsa açılmasını değerlendirin. **Kanıt:** kaynak varsayılanı ve canlı kapalı bölüm.

### 12. O — Form/kural/parmak izi sorgu hataları için yerel kurtarma sınırı eksik

**Yer:** `src/components/employees/EmployeeDetails.tsx:29`, `src/components/employees/EmployeeDetails.tsx:115`, `src/components/employees/EmployeeForm.tsx:35`, `src/pages/Employees.tsx:30`.

**Sorun:** Senkron, rızalar ve geçişler EmployeeActivityBoundary içinde; kurallar, form seçenekleri ve parmak izi kartı aynı yerel korumayı paylaşmıyor. Bu sorgulardan atılan hata sayfa seviyesindeki boundary’ye yükselip açık formu/taslağı da kaldırabilir.

**Öneri:** Form taslağını koruyan yerel hata/yeniden dene durumu sağlayın; parmak izi kartını diğer etkinlik kartları gibi izole edin. **Kanıt:** kaynak bileşen ağacı; canlı bağlantı hatası üretilmedi.

### 13. D — Genel bilgiler başlığı form legend’larıyla çift hiyerarşi oluşturuyor

**Yer:** `src/components/employees/EmployeeDetails.tsx:68`, `src/components/employees/EmployeeFormFields.tsx:99`.

**Sorun:** Düzenlemede Genel bilgiler + hemen altında Kimlik ve iletişim ile iki üst üste ayraç/başlık var; yeni mod aynı formu doğrudan açıyor. Kartlarda pt-4/pt-5 farkı ve yeni formda tüm alanların üstünde tek ek katman görsel ritmi bozuyor.

**Öneri:** Embedded yönetici formunda Genel bilgiler üst başlığını kaldırın veya tek kapsayıcı başlık olarak sadeleştirin; bölüm boşluklarını eşitleyin. **Kanıt:** `/tmp/emp-audit-edit-390.png`, `/tmp/emp-audit-new-390.png`.

### 14. D — Fotoğraf düzenlemede iki yerde gösteriliyor

**Yer:** `src/components/employees/EmployeeFormFields.tsx:162`, `src/components/employees/EmployeeDetails.tsx:134`.

**Sorun:** Üstte fotoğraf düzenleme/önizleme, en altta Fotoğraf ve veri kayıtları var. Taslak fotoğrafla kayıtlı fotoğraf farklı görünebilir; alt başlık ayrıca fotoğraf dışında veri kaydı sunmuyor.

**Öneri:** Yönetici formunda tek fotoğraf alanı tutun; salt okunur ayrıntıda alt kartı koruyup başlığını Fotoğraf yapın. **Kanıt:** canlı DOM; mevcut kişide iki yerde fotoğraf alanı/boş durum görüldü, yükleme yapılmadı.

### 15. D — Biçim ve yardımcı açıklamalar alanlara yeterince bağlı değil

**Yer:** `src/components/employees/EmployeeFormFields.tsx:55`, `src/components/employees/EmployeeFormFields.tsx:115`, `src/components/employees/hooks/useEmployeeFormSchema.ts:3`.

**Sorun:** TC için 11 hane sınırı var fakat ilk hanenin sıfır olamayacağı ve sayısal klavye ipucu yok; kart için örnek/baştaki sıfırların korunacağına dair ipucu yok. Yardım metinleri `aria-describedby` ile bağlı değil; bu bağ yalnız hata varken kuruluyor. Drawer açıklaması DOM’da mevcut ama dialog’un `aria-describedby` değeri null.

**Öneri:** TC’ye inputMode=numeric ve format açıklaması; karta sistemin kabul ettiği biçim örneği ekleyin. Kartı sayıya çevirmeyin. Yardım metinlerine id verip hata ve yardım id’lerini birlikte bağlayın; SheetDescription bağlantısını onarın. **Kanıt:** kaynak ve canlı DOM ölçümü.

### 16. D — Boş katalog ile atanmamış seçim aynı görünüyor

**Yer:** `src/components/employees/EmployeeFormFields.tsx:88`, `src/components/employees/hooks/useEmployeeFormData.ts:76`.

**Sorun:** Şirket/departman/pozisyon seçenekleri boş olduğunda da tek Atanmamış seçeneği görünüyor; kullanıcı seçenek yüklenmedi mi yoksa katalog boş mu ayıramıyor. Erişimde Kural eklenmesin bir seçim açıklıyor fakat uygun kural bulunmaması ayrıca anlatılmıyor.

**Öneri:** Boş katalog için “Henüz departman tanımlı değil” gibi yardım verin; yükleniyor, boş ve seçilmedi durumlarını ayırın. Yeni kayıttaki “mevcut erişimleri kaldırmaz” açıklamasını moda göre sadeleştirin. **Kanıt:** canlı projede boş organizasyon seçenekleri ve kaynak.

### 17. D — Bekleme eylemi yanlış adlandırılıyor ve duyuru eksik

**Yer:** `src/components/employees/EmployeeForm.tsx:217`, `src/components/employees/FormActions.tsx:23`.

**Sorun:** Seçenek yükleme ve fotoğraf yükleme de FormActions’a isLoading diye gidiyor; buton her durumda Kaydediliyor diyor. Kaydetme başlangıcı için ayrı role=status/aria-busy yok; ilk aşama yazısı ancak kayıt tamamlandıktan sonra ekleniyor. Mevcut FieldError role=alert, fotoğraf yükleme role=status ve kaydetme aşamaları role=status olumlu.

**Öneri:** Seçenek yükleniyor / Fotoğraf yükleniyor / Kaydediliyor durumlarını ayrı metinlerle belirtin; forma aria-busy ve başlangıç duyurusu ekleyin. **Kanıt:** kaynak incelemesi; kaydetme çalıştırılmadı.

### 18. D — Kişi/personel ve başlık dili tutarsız

**Yer:** `src/pages/Employees.tsx:143`, `src/components/employees/SlideOverPanel.tsx:76`, `src/components/employees/EmployeeConsentsCard.tsx:117`, `src/components/employees/EmployeeFormFields.tsx:140`.

**Sorun:** Kişiler sayfası Personel ekle/düzenle açıyor; boş durumlar kişi diyor. KVKK Rızalar, Rıza Al, TC kimlik no ve Kart / kimlik yazımları farklı başlık kalıpları kullanıyor. Kart / kimlik bölümü bordro kodunu da içeriyor.

**Öneri:** Bu modül için tek kişi/personel sözlüğü belirleyin; “KVKK rızaları”, “Rıza al”, “T.C. kimlik numarası” gibi tutarlı cümle düzeni kullanın; kart/kimlik/bordro grubunu anlaşılır adlandırın. **Kanıt:** canlı metin ve kaynak.

## Doğrulanan olumlu noktalar ve sınırlar

- Zorunlu Ad, Soyad, E-posta, Kart alanlarında yıldız ve required birlikte var. Alanların label/id bağlantıları kurulmuş; hata metinleri role=alert ve aria-invalid/aria-describedby kullanıyor. Zod ilk hatalı alana odak planlıyor; ücret hatası kapalı bölümü açıyor. Gönderim yasak olduğu için bu dallar canlıda çalıştırılmadı.
- Yeni form ilk odağı Ad’a veriyor. Dirty durumda Esc uyarısı ve “Düzenlemeye dön” ilk odağı canlıda görüldü. Temiz kapatma ve dirty Vazgeç davranışları incelendi. Proje guard’ı dirty/pending olduğunda değişimi durduruyor; pending sırasında Esc/dış tıklama engeli kaynakta mevcut.
- 390 px’te kart/TC/bordro ve organizasyon grupları tek sütun; drawer genişliği 390 px, yatay içerik taşması ölçülmedi. Yeni ve dirty düzenleme alt çubukları görünür kaldı (düzenleme Kaydet düğmesi y=796–832, viewport 844). Gerçek mobil klavye açıkken ayrıca kontrol gerekli.
- Uzun adlar başlıkta satıra kırılabilir; salt okunur e-posta break-words kullanıyor, form e-postası tek satırlı input içinde kayar. Aşırı uzun bölünmez ad/kural/cihaz adı için canlı veri değiştirilmedi; ayrıca sentetik görsel test önerilir. Mevcut veride taşma görülmedi.
- Ölçülen normal metin rengi rgb(37,37,35), yardımcı metin rgb(100,100,97), yüzey yaklaşık rgb(252,252,252), ana buton rgb(122,31,31)/beyaz: normal metin için belirgin kontrast sorunu gözlenmedi. Bu, tüm tema/durumlar için kontrast sertifikası değildir; disabled kontroller ve gerçek ekran okuyucu davranışı ayrıca doğrulanmalı.
- Cihazlarda “Bilinmiyor / Cihaz teslim kanıtı yok” ile gönderim özeti teslimden ayrılmış. Senkron/geçişlerde loading, boş ve kayıt yok durumları, kart bazlı hata sınırları var. Rıza butonlarının tür belirten erişilebilir adları var; parmak izi rıza ve uygun cihaz önkoşulunu açıklıyor.
- Kaydet sonrası aşamalar iki modda da var; düzenlemede de Tamam gerekmesi bir davranış farkı değil, Tamam’ın kapanış/sıfırlama sonucunun farkıdır. Kısmi cihaz/e-posta başarısızlığı aşamalarda gösteriliyor; yeni başarı ekranında tekrar deneme/ayrıntıya geçiş geliştirmesi #8 kapsamındadır.

## Hızlı kazanımlar (her biri yaklaşık ≤30 dk)

- Düzenleme e-posta yardım metnini moda göre düzeltin (#6).
- Düzenleme Vazgeç etiketini “Değişiklikleri geri al” yapıp odağı Ad’a döndürün (#5).
- Düzenlemenin ilk odağını güvenli başlık/Ad alanına alın (#2).
- FormActions, Kapat ve diğer alanlar summary etkileşim alanlarını 44 px yapın (#3; tüm ortak Button’ı değiştirmek yerine drawer kapsamı).
- Embedded formdaki Genel bilgiler fazlalığını kaldırın; bölüm boşluklarını eşitleyin (#13).
- Yönetici görünümündeki ikinci fotoğraf bloğunu kaldırın (#14).
- TC biçim ipucu/inputMode ve yardım metni aria bağlantılarını ekleyin (#15).
- Dolu isteğe bağlı alan sayısını summary’de gösterin (#11); KVKK başlık yazımını düzeltin (#18).

## Karar gerektirenler (Emre’ye sorular)

- Yeni kişi sonrası varsayılan sonuç listeye dönmek mi, aynı kişinin ayrıntılarına devam etmek mi olmalı? Rıza/biyometri/cihaz doğrulamasına yönlendiren ikinci aşama kabul ediliyor mu?
- Rıza beyanı ilk kayıtla beraber mi alınmalı, yoksa kayıt sonrasında ayrı bir doğrulanmış adım mı kalmalı? Mevcut rıza türleri ve fotoğraf yükleme sırası ürün içinde nasıl açıklanmalı?
- “Aktif” anahtarının kullanıcıya gösterilecek erişim etkisi nedir; pasifleştirme ile işten ayrılma ayrımında hangi açıklama ve onay bekleniyor?
- Düzenlemede “Değişiklikleri geri al” doğrudan sıfırlasın mı, kapsamlı taslakta onay istensin mi?
- Mevcut erişim üyelikleri formun Erişim bölümünde birleşsin mi; yeni kayıtta tek kural eklemek yeterli mi?
- Ayrı yönetim işlemleri (rıza, parmak izi, işten çıkarma) ana form dirty veya pending iken kullanılabilsin mi; yoksa önce taslak çözümlensin mi?
- Modülün ortak adı Kişiler mi Personel mi olacak; kayıtlı ücret/not alanları düzenlemede varsayılan açık mı olmalı?

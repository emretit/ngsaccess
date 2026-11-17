# Ortak sayfa şablonu uygulama planı

12 Kasım 2026. Kullanıcı audit sonrasında planlama ve uygulamayı başlatmayı onayladı. Temel kararlar ve kanıtlar README.md ile üç audit raporunda.

## Tasarım kararı

Tek global Layout altında tek PageTemplate. Başlık/kapsam/eylemler, isteğe bağlı gezinme ve bildirim, kapsam paneli, filtreler, sonuç ve altlık ortak kompozisyonla sunulur. İçerik tablo/takvim/ajanda/form olabilir. Mevcut sistem sans, bordo marka, nötr yüzeyler, 16/24/32 px ritim, okunaklı ana kimlik ve dokunmatik kontroller temel alınır. Dış boşluk Layout sorumluluğunda kalır.

## Aşamalar

1. Ortak temel ve pilotlar. PageTemplate mevcut PageHeader ve MasterDetailListLayout üzerinden kurulacak. Kişiler/Cihazlar başlık, eylem, filtre, sonuç ve altlık düzenine taşınacak. Mobil filtre yoğunluğu, personel kimliği/kolon okunurluğu ve seçimsiz cihaz toplu işlem alanı düzeltilecek. Kapı Planları projesiz durumu ve yerel sorgu hata sınırları ele alınacak.
2. Kabuk doğruluğu. Gerçek main kaydırıcısı rota geçişlerinde doğru yönetilecek. Geri/ileri ve query değişimi davranışları korunarak doğrulanacak. Alt rotaların başlık/breadcrumb bağlamı değerlendirilecek.
3. Yaygınlaştırma. Vardiya ve Ayarlar ile takvim/form varyantları doğrulanacak. Ardından PDKS, Ziyaretçiler, Alarmlar, Geçiş Kontrol, Raporlar ve kalan yönetim sayfalarının dış kompozisyonu ortaklaştırılacak. Sonuç altlıklarında mevcut imleç/biriktirme davranışı korunacak.
4. Doğrulama. TypeScript ve eslint, değişikliklere ilişkin mevcut testler, 390/1440 px canlı pilotlar ve breakpoint geçişleri. Uzun kimlik verisi, sayfa taşması, filtre açma/temizleme, başlık ve eylem erişimi, kaydırma ve klavye odağı kontrol edilecek. Kayıt oluşturma/silme gibi iş verisi değişiklikleri görsel kontrol için yapılmayacak.

## İlk paralel iş bölümü

- Temel worker yalnız PageTemplate/PageHeader ve Kişiler/Cihazlar sayfa kompozisyonunu üstlenir.
- Okunurluk worker yalnız personel tablosu, kişi/cihaz filtreleri ve cihaz sonuç/toplu işlem alanını üstlenir.
- Durum worker yalnız Alarmlar ve Geçiş Kontrol/Kapı Planları sorgu sınırlarını ve projesiz durumu üstlenir.
- Koordinatör planı, sonraki aşama geçişlerini ve birleşik doğrulamayı üstlenir. Worker kaynak düzeltmeleri ilgili workera iletilir.

Aynı checkout kullanılır, dosya sahiplikleri ayrıdır. Mevcut kullanıcı değişiklikleri üzerinde geri alma/temizleme yapılmaz. Ortak dosya gerekirse koordinatör üzerinden sıraya alınır. Backend bu frontend planının değişiklik hedefi değildir.

## İlerleme

- [x] Audit sentezi ve tasarım yönü
- [x] Uygulama planı
- [x] Ortak temel ve Kişiler/Cihazlar pilot geçişi
- [x] Tablo okunurluğu ve mobil filtreler
- [x] Projesiz durum ve yerel hata sınırları
- [x] Kabuk kaydırma ve alt rota bağlamı
- [x] Vardiya/Ayarlar ve kalan sayfalar
- [x] Birleşik test ve görsel doğrulama

İlk aşama raporları implementation-foundation.md, implementation-readability.md ve implementation-states.md içinde. Okunurluk çalışması kayıtlı kolon genişliklerinin minimumlarını ortak table-resize katmanında uygular, geçerli tercihleri silmez. Takvim/form sayfaları, kabuk/Alarmlar/Geçiş Kontrol ve kalan sayfalar ayrı dosya sahiplikleriyle tamamlandı.

Yaygınlaştırma tamamlandı. Ayrıntılar implementation-workspaces.md, implementation-shell.md ve implementation-remaining-pages.md içinde. İlk tam testte bulunan iki eski vardiya sunum beklentisi, tarih/etiket ve seçim hedefi davranışları incelenerek düzeltildi. Canlı QA’nın bulduğu mobil menü odağı, çıkış uyarısını iptal sonrası odak dönüşü ve Alarmlar klavye kaydırma alanı sorunları düzeltilip yeniden doğrulandı. Pilotların hata/projesiz ekranlarında ortak başlık da korundu.

Nihai birleşik sonuç 500 test dosyasında 5622/5622 test geçti. Uygulama TypeScript kontrolü, eslint ve üretim build’i geçti. Lint başlangıçtan kalan 2 backend unused uyarısını verdi. Build mevcut Vite yapılandırması, Radix wildcard CSS ve büyük chunk uyarılarını verdi. Canlı doğrulamanın ölçümleri ve kapsam sınırları verification-live.md içinde. Tamamlanmış teslim özeti TESLIM.md içinde.

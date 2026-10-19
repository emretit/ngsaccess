# UI Audit 2 — 04 Sanal Okuyucular (`/virtual-readers`)

Tarih: 2026-10-19 · Ortam: localhost:8081, masaüstü + 390px (iPhone 12) · Aktif proje: "emre"

**Özet.** Sayfa, A2'de bilerek bırakılmış tek bir "durum ekranı" (içinde gerçek veri olmayan bilgi sayfası): başlık + "Henüz kullanıma açılmadı" + "Cihazlara git" düğmesi. Görsel olarak A2 ile tutarlı, taşma yok, düğme çalışıyor; asıl sorun içerik/yönlendirme: sayfa ana menüde tam bir yer kaplıyor ama kullanıcıya yapabileceği hiçbir şey vermiyor, "Cihazlara git" ise tam olarak sanal okuyucu değil fiziksel okuyucu için çözüm sunuyor. Yüksek önemde bulgu yok.

| Yüksek | Orta | Düşük |
|---|---|---|
| 0 | 2 | 3 |

Eski tarama (`docs/ui-scan/pages/04-sanal-okuyucular/REPORT.md`) VRD-UI-01 → "çözüldü" (sabit örnek liste kaldırıldı, `VirtualReaders.tsx:6`); VRD-UI-10 (İngilizce örnek adlar) → "çözüldü". VRD-UI-02..09, 11, 13, 14 sayfa artık yok / B1 kapsamı olduğundan tekrar yazılmadı. **Hâlâ açık (eski VRD-UI-04/14):** sanal okuyucu oluşturma ve tür sözleşmesi yok — B1 işi, aşağıda ürün kararı.

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 04-O1 | Orta | içerik | Boş ekran "Fiziksel QR okuyucuları Cihazlar sayfasından ekleyip yönetebilirsiniz" der, tek düğme "Cihazlara git". Oysa sayfanın konusu telefonla QR okutmak; fiziksel cihaz eklemek bu ihtiyacı karşılamaz. Mobil uygulamada QR tarama (`selfCheckIn`) ve web'de `/check-in` zaten çalışıyor, ama sayfa bunlardan hiç söz etmiyor. | Kullanıcı "sanal okuyucu" için gelir, alakasız bir cihaz listesine yönlendirilir; mevcut çalışan QR/mobil giriş akışını (mobil uygulamada QR tara) öğrenemez. | Metne tek cümle ekle: "Çalışanlar şimdilik mobil uygulamadaki QR tarama ile giriş yapabilir." Düğme kalsın ama ikincil olsun. | `src/pages/VirtualReaders.tsx:22-25`; `mobile/lib/screens/qr_scan/qr_scan_screen.dart`; `convex/cardReadings.ts:1398` (selfCheckIn); `desktop.png` |
| 04-O2 | Orta | içerik | Başlık "Henüz kullanıma açılmadı", açıklama "hazırlanıyor" der; tarih/sürüm yok, "bana haber ver" yok. Menüde 4. sırada (Cihazlar'ın hemen altı, Geçiş Kontrol'ün üstünde) yer alıyor. | Her gün gezilen ana menüde 1/13 yer, hiçbir işlevi olmayan sayfaya gidiyor; kullanıcı tıklayıp boş sayfa görüyor. Gelecek özelliği vaat ediyor ama belirsiz. | Menüden çıkar ya da "Yakında" rozeti ver (ürün kararı 1). Sayfa durum ekranı kalacaksa "Yakında" dili ve kısa kapsam cümlesi ekle. | `src/lib/routeMeta.ts:9`; `src/components/layout/routeMeta.test.ts:9` (menüde olmasını zorunlu kılıyor); `desktop.png` |
| 04-D1 | Düşük | içerik | Üst başlık altı "emre · Telefonla QR okutulan giriş noktaları" gösterir; sayfa boşken bile proje adı ve açıklama sanki liste varmış gibi okunuyor. Proje seçili değilse "Proje seçilmedi · …" yazıyor. | Durum ekranında proje kapsamı bilgisi anlamsız; "Proje seçilmedi" metni boş sayfada da çıkar. | Kapsam satırında proje adını kaldır, yalnız açıklama bırak (ya da proje adı sadece liste gelince). | `src/pages/VirtualReaders.tsx:16`; `desktop.png`, `mobile.png` |
| 04-D2 | Düşük | erişilebilirlik | `EmptyState` `role="status"` taşıyor (canlı bölge); sayfa yüklenince statik içerik ekran okuyucuya "durum" olarak anons edilebilir. Boş-durum bileşeni tüm sayfalarda aynı. Odak halkası: `Button` sınıfında `focus-visible:ring-2` var, ama programatik odakta (eval) ekranda halka görünmedi — klavyeyle Tab ile **doğrulanmadı**. | Statik sayfada gereksiz anons; halka doğrulaması eksik. | `role="status"` yalnız dinamik boş-durumlarda kullan (ya da prop ile kapat); halkayı gerçek Tab ile elle kontrol et. | `src/components/shared/EmptyState.tsx:30`; `src/components/ui/button.tsx:8`; `desktop-focus.png` |
| 04-D3 | Düşük | görsel | Boş-durum kartı ekranın üst ~%35'ini kaplıyor, altı boş; kart içinde ikon 20px (kutu 32px), başlık 16px, açıklama 13px — A2'nin diğer boş durumlarıyla aynı; ancak masaüstünde (1639px geniş) içerik dar bir sütunda kalıp kart çok geniş görünüyor. `py-16` dikey boşluk da büyük. | Bilgi yoğunluğu düşük; "bitmemiş sayfa" hissi. Yalnız estetik. | `max-w-xl` kart ya da `compact` kullan; öneri ürün kararı 1'e bağlı. | `desktop.png`; `src/pages/VirtualReaders.tsx:17`; `EmptyState.tsx:30` |

## Kontrol sonuçları (sorun çıkmayanlar)

- Mobil 390px: yatay kaydırma yok (`scrollWidth` 390); düğme 36px yüksek (dokunma hedefi sınırında, diğer sayfalarla aynı); başlık ve açıklama taşmadan sığıyor (`mobile.png`; emülasyon ekran görüntüsü bilinen 3'lü tekrar sorunu nedeniyle yalnız üst parça gerçek).
- "Cihazlara git" `/devices`'a gidiyor (kod: `navigate("/devices")`), veri yazmıyor; basılmadı.
- Kontrast: açıklama metni `rgb(100,100,97)` açık zeminde ≈ 5.3:1 (hesap, araç ölçümü değil) — AA geçer.
- Yükleme/hata durumu yok; veri sorgusu olmadığı için gereksiz/ağır sorgu da yok. `useActiveProjectScope` yalnız ad için kullanılıyor.
- Menü, breadcrumb (`Ana Sayfa / Sanal Okuyucular`) ve sekme başlığı tutarlı; sekme başlığı sayfaya özgü değil ("Personel ve geçiş yönetimi · NGS Plus") — bu kabuk meselesi (01), buraya yazılmadı.

## Hızlı düzeltmeler (≤30 dk)

1. Açıklamaya "mobil uygulamada QR tarama ile giriş şimdilik kullanılabilir" cümlesi ekle (04-O1) — ~10 dk.
2. Kapsam satırından proje adını çıkar / "Proje seçilmedi" metnini kaldır (04-D1) — ~5 dk.
3. `EmptyState`'e `role` kapatma seçeneği ver (04-D2) — ~10 dk.
4. Kartı `max-w-xl` ile daralt veya `compact` kullan (04-D3) — ~5 dk.

## Ürün kararı gereken

1. **Menüde kalsın mı?** Özellik (B1) ne zaman çıkacak; çıkmayacaksa "Sanal Okuyucular" menüden kalksın mı, yoksa "Yakında" rozetiyle mi kalsın? (04-O2)
2. **Mevcut QR akışı nerede anlatılsın?** Çalışanın mobilde QR ile girişi bu sayfada mı, Cihazlar'da mı, yoksa yardım/Ayarlar'da mı belgelensin? (04-O1)
3. **Sanal okuyucu = ayrı varlık mı?** Eski taramadaki karar hâlâ açık: `readers` tablosuna "sanal" türü mü eklenecek, yoksa mevcut cihaz+kapı modeli üstünde mi kurulacak? (eski VRD-UI-14, hâlâ açık)

## Kanıt dosyaları

`docs/ui-audit-2/04-sanal-okuyucular/desktop.png`, `desktop-focus.png`, `mobile.png`

## Kararlar (Emre, 2026-10-19)
- 04-O2: menüde "Yakında" rozetiyle kalır.
- 04-O1: sayfaya mobil uygulamada QR ile giriş cümlesi eklenir; "Cihazlara git" ikincil olur.

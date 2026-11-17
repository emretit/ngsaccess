# Yetki Durumu — 2. tur denetimi

Sekme, ortak filtre/tablo/rozet dili ve 390px yerleşimi bakımından siteye büyük ölçüde uyuyor; önceki turdaki birçok tasarım sorunu giderilmiş. Ancak kabul edilen “tüm kişileri ara” ve “neden geçemedi?” kararları henüz tamamlanmamış; sabit proje özeti de departman seçilince değişiyor. Yeniden gönderim onayı anlaşılır, fakat kapandığında klavye odağı kayboluyor.

| Yüksek | Orta | Düşük |
|---|---|---|
| 2 | 3 | 0 |

**İnceleme:** 05.11.2026, NGS projesi, oturum açık; `/access-control?tab=status`. Masaüstü pencere 1639×939; mobil aynı kaynağı açan 390×844 iframe (sayfa içi pencere), cihaz emülasyonu kullanılmadı. Mobil PNG'lerin soldaki 390px bölümü uygulamadır; sağdaki boş alan Orca pencere alanıdır. Yalnız yerel filtre/seçim ve onay açma–Vazgeç işlemleri yapıldı; gönderim veya veri değişikliği yapılmadı. Bilinen sayfa başlığı sorunu kapsam dışıdır. `status/` kısaltması aşağıda `src/components/access-control/unified/status/` dizinidir.

## Bulgular

| ID | Önem | Tür | Ne görülüyor | Sitenin geri kalanında nasıl | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| GK2-A2-H1 | Yüksek | mantık | Arama kişi tablosundan başlamıyor; varsayılan yol yalnız mevcut cihaz gönderim kayıtlarını tarıyor. “Bilinmiyor” yolu da yalnız etkin kuralın cihaz eşleşmelerini kapsıyor. Kuralsız kişi bulunamaz; “Kural yok / Gönderim kaydı yok” ve ilgili bağlantılar yok. **03-H1 kararı uygulanmamış.** | Kişiler ekranı projedeki kişileri listeler; kabul edilen karar da aynı kişi kapsamını istiyor. Canlı projede yalnız iki kişi var ve ikisinin gönderim kaydı var; gerçek kayıtsız kişiyle uçtan uca doğrulama **yapılamadı**. | Aramayı proje kişilerinden başlat; kişi bulunduğunda kural/gönderim yokluğunu ayrı göster ve Kişiler/Kurallar bağlantısı ver. | `convex/accessGrantStatus.ts:151`, `:162`, `:169`; bilinmeyenler `:87`; `status/StatusResults.tsx:73`; karar `docs/ui-audit-gk/03-yetki-durumu.md:80`. [Arama boş durumu](yetki-durumu/search-empty.png), [Kişiler karşılaştırması](yetki-durumu/employees-reference.png). “Ahmet” canlı projede yoktur: bu çekim kayıtsız kişi hatasının tekrarı değil, mevcut boş durumun kanıtıdır; kapsam kusuru kodda doğrulandı. |
| GK2-A2-H2 | Yüksek | mantık | Kişi çekmecesi gönderim rozeti, son güncelleme, kapı ve kural adı gösteriyor; cihazın şu an çevrimiçi olup olmadığı ve mevcut saat aralığı değerlendirmesi yok. “Kuralın kendi saati” gerçek saatleri veya şu an geçiş uygunluğunu açıklamıyor. Kullanıcı “Etkin” gördüğü halde neden geçemediğini bu ekrandan çözemiyor. | Cihazlar bağlantı durumunu ayrı rozetle gösteriyor; 27 Ekim kararı bu sekmede kural, gönderim, bağlantı ve zaman teşhisini birlikte istiyor. | Çekmecede dört ayrı kontrol sonucu göster; gönderim başarısını güncel geçiş uygunluğundan ayır, saatleri Türkiye saatiyle açıkla ve bilinmeyen veriyi belirt. | `status/StatusViews.tsx:183`, `:194`, `:205`; `convex/accessGrantStatus.ts:42`, `:219` (çıktıda bağlantı/zaman değerlendirmesi yok); `src/components/devices/DeviceTable.tsx:68`; karar `docs/ui-audit-gk/03-yetki-durumu.md:79`. [Masaüstü çekmece](yetki-durumu/detail.png), [390px çekmece](yetki-durumu/mobile-detail.png). |
| GK2-A2-O1 | Orta | mantık | Başlangıçta “Proje özeti · 4 kayıt · 2 kişi”; Yönetim departmanı seçilince “Departman özeti · 2 kayıt · 1 kişi”. Ad araması proje özetini değiştirmezken departman değiştiriyor. Kapsam etiketi dürüst, ancak **sabit proje özeti** kararı tam uygulanmamış. | Karar, üstte sabit proje özeti ve altta ayrı filtre sonucu istiyor; ayrı filtre sonucu bu sekmede zaten mevcut. Sayaçların FilterBar dışında bulunması bulgu değildir. | Üst sayaçları mevcut `projectCounts` ile besle; departman seçimini yalnız listeye uygula. | `status/StatusPage.tsx:83`, `:191`, `:202`; `status/StatusCounters.tsx:16`; karar `docs/ui-audit-gk/03-yetki-durumu.md:81`. [Başlangıç](yetki-durumu/desktop.png), [Yönetim seçimi](yetki-durumu/department.png). |
| GK2-A2-O2 | Orta | erişilebilirlik | Seçili gönderim onayı açılınca odak doğru biçimde Vazgeç'te; Vazgeç ile kapanınca `document.activeElement` BODY oluyor. Gönderimi açan düğmeye dönülmüyor. | Ortak ConfirmAction açan öğeyi saklayıp kapanışta odağı geri verir; kişi çekmecesinde de bu düzeltme uygulanmış. | Özel Dialog yerine ConfirmAction kullan veya aynı açan öğeye odak dönüşünü ekle. | `status/RedistributeControls.tsx:83`, `:92`; `src/components/shared/ConfirmAction.tsx:59`, `:65`; [seçili onayı](yetki-durumu/selected-confirm.png). Canlı DOM ölçümü: açılış `BUTTON/Vazgeç`, kapanış `{tag: BODY, text: BODY}`. |
| GK2-A2-O3 | Orta | mantık | Liste sorgusu hata verirse üstte hata metni gösterilirken boş sonuç tablosu da çizilir; çekmece hatasında yeniden deneme yok. Cihaz sayımları tek toplu istekte tamamlanıyor: biri hata verirse sayımlar boş kalır ve “Sayaçlar yükleniyor…” yazısı sürer. Eski 03-O9 hâlâ açık. | Tasarım sistemi veri yokluğu ile okuma hatasını ayırır; ErrorState ve yeniden deneme öngörür. | Liste/çekmece/cihaz özeti için ayrı hata durumu tut; hata varken boş sonucu gizle ve ilgili bölümde yeniden deneme sun. | `status/StatusPage.tsx:105`, `:238`, `:257`; `status/StatusResults.tsx:66`, `:130`; `status/EmployeeGrantSheet.tsx:45`; `status/useStatusData.ts:90`, `:108`; `docs/ux-audit/DESIGN_SYSTEM.md` “Yeni/değiştirilen ekran kuralları”. [Normal boş durum](yetki-durumu/search-empty.png), [cihaz bölümü](yetki-durumu/device-view.png), [çekmece](yetki-durumu/detail.png) etkilenen yüzeyleri gösterir; hata ekranı değildir. **Ağ hatası canlıda üretilmedi; görsel sonuç doğrulanmadı, hata dalları koddan doğrulandı.** |

## Uyumlu olanlar

- FilterBar + FilterField kullanılıyor; arama ilk, “Tüm departmanlar / Tüm cihazlar / Tüm kurallar” seçenekleri ve sonda çalışan “Filtreleri temizle” var. Masaüstünde filtreler gizlenmiyor; 390px'te ikincil filtreler daraltılabiliyor (`status/StatusFilters.tsx:74`). [Masaüstü](yetki-durumu/desktop.png), [mobil](yetki-durumu/mobile.png).
- Satırın durum hücresine tıklamak kişi çekmecesini açtı; isim altı çizili değil, ortak satır imleci ve olay yardımcısı kullanılıyor. Tablo `resizeKey` ve sütun `columnId` değerleri mevcut (`status/StatusViews.tsx:92`, `:97`, `:109`). Kişiler de aynı satır/tablo kalıbında.
- Boş sonuçta tablo başlıkları kalıyor; yükleme dalında TableStateRow, mobil boş durumda EmptyState var (`status/StatusViews.tsx:104`, `:130`). Yükleme çok kısa olduğundan ekran görüntüsü alınmadı. Çekmece yükleme metninde `role=status` yok (`status/EmployeeGrantSheet.tsx:50`); küçük iyileştirme olarak aşağıda yer alıyor.
- Gönderim rozeti doğrudan saklanan durumu kullanıyor; eski “stale → Bekliyor” çelişkisi düzeltilmiş. Kural değişikliği ve çözümlenemeyen kapı ayrı uyarı rozetleri (`status/model.ts:68`, `status/StatusViews.tsx:24`). Canlı veri 4 Etkin; Hata: 0 seçildiğinde 0 sonuç; NGS0001 cihaz görünümünde Etkin: 2 ve 2 satır görüldü. Bekleyen/hatalı/bilinmeyen örnek olmadığı için bunların canlı rozetleri sınanmadı.
- Sayaçlarda `aria-pressed` var; Hata seçilince yalnız Hata sayacı true oldu. Mobil seçim etiketi kutuya bağlı ve en az 44px yüksekliğinde (`status/StatusViews.tsx:138`). Önceki 03-O7 tekrar bulgu yapılmadı.
- Mobil belge genişliği ve kaydırma genişliği 390px; açık çekmece de 390px. Yatay taşma görülmedi. Arama yukarı taşınmış; ilk kişi kartı ilk ekranda başlıyor. [Mobil](yetki-durumu/mobile.png), [çekmece](yetki-durumu/mobile-detail.png).
- Kişi çekmecesi kapanınca odak Emre Aydın düğmesine döndü (`status/EmployeeGrantSheet.tsx:32`); önceki çekmece odak bulgusu giderilmiş. O2 yalnız gönderim onayını ilgilendiriyor.
- Seçim yapılınca “Seçili 1 kaydı yeniden gönder” çıkıyor; onayda NGS, Emre Aydın ve NGS0001 görünüyor. Veri göndermeden Vazgeç ile çıkıldı. Tüm proje gönderimi için filtrelerin uygulanmayacağı metni ve `devices.manage` denetimi kodda mevcut (`status/RedistributeControls.tsx:61`, `:98`, `:103`). RunNotice sonucu izliyor ve tamamlanınca listeyi yeniliyor (`status/RunNotice.tsx:23`); gerçek gönderim, hata ve çift gönderim kilidi canlıda denenmedi.
- Tarihler `formatTrDateTime` ile `Europe/Istanbul` kullanıyor (`src/lib/date.ts:43`). Nötr yüzey, bordo seçim, semantik StatusBadge ve cümle düzeninde filtre etiketleri site diliyle uyumlu.

## Hızlı düzeltmeler

1. **O1 — 20 dk:** Üst sayaçlara `projectCounts` bağla ve sabit proje kapsam metnini kullan: `status/StatusPage.tsx:83`, `status/StatusCounters.tsx:16`.
2. **O2 — 25 dk:** Onayı açan düğmeyi saklayıp kapanışta odağı döndür veya ortak ConfirmAction'a taşı: `status/RedistributeControls.tsx:92`.
3. **O3'ün liste kısmı — 25 dk:** Liste hatasını StatusResults'a geçir; hata halinde boş sonuç yerine yeniden deneme göster: `status/StatusPage.tsx:112`, `status/StatusResults.tsx:66`. Cihaz sayımlarının ayrıştırılması ayrı iştir.
4. **Çekmece yükleme bildirimi — 5 dk:** Yükleniyor metnine `role="status"` ekle: `status/EmployeeGrantSheet.tsx:50`.

Teşhis ve tüm kişi araması 30 dakikalık iş olarak değerlendirilmedi.

## Ürün kararı gereken

Mevcut “teşhis / tüm kişiler / sabit proje özeti” kararlarının yeniden alınması gerekmiyor; bunlar uygulanmalı. Açık kalan ayrıntı:

1. **Teşhis hangi zamanı değerlendirsin?** A) Önerilen: önce “şu an” için bağlantı ve zaman kontrolü; son reddedilen geçişe ayrı bağlantı. B) Seçilen geçmiş geçiş anına göre teşhis; bunun için o andaki kural/cihaz verisinin geçmişi gerekir. İlk seçenek mevcut 27 Ekim kararını doğrudan tamamlar.

## Kanıt ve sınırlar

Dokuz PNG bu rapor klasöründe bulunuyor ve tek tek açılarak kontrol edildi. Kişiler canlı karşılaştırma ekranı; Cihazlar bağlantı rozeti ve ortak onay/hata kalıpları kaynak üzerinden kıyaslandı. Ziyaretçiler, Canlı İzleme ve Admin için ayrıca canlı tur yapılmadı; kapsam dışındaki iki sekme incelenmedi. Canlı veri yalnız iki kişi/dört etkin gönderim kaydı içeriyor; büyük veri sayfalaması, kayıtsız kişi, ağ hatası ve gerçek yeniden gönderim sonuçları uçtan uca doğrulanmadı. Kod veya canlı veri değiştirilmedi.

**Tarayıcı temizliği:** Açılan iki sayfa için `orca tab close --page <id> --json` çalıştırıldı; ikisi de `browser_tab_not_found` döndürdü. Bu nedenle kapanış CLI üzerinden doğrulanamadı; başka sekmelere dokunulmadı.

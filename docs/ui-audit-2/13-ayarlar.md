# UI Audit 2 — 13 Ayarlar (`/settings`)

**Özet:** Yeni (A2) Ayarlar sayfası düzenli: tek bölüm menüsü, mobilde "Ayar bölümü" seçicisi, her formda ortak kaydet çubuğu ve çalışan kirli taslak koruması (sekme değişimi ve tarayıcı geri/ileri tuşu uyarı çıkarıyor; "Çık" değişikliği atıyor). En ciddi sorun **Gece çarpanı + gece başlangıç/bitiş saatlerinin kaydedilip hesaplamada hiç kullanılmaması**; geri kalanlar görsel ve metin tutarlılığı. Sırlar maskesiz görünmüyor (Hikvision anahtarı varsayılan maskeli).

| Önem | Adet |
|---|---|
| Yüksek | 1 |
| Orta | 6 |
| Düşük | 10 |

Test notu: hiçbir şey kaydedilmedi/gönderilmedi; bildirim sekmesinde yapılan taslak değişikliği "Çık" ile atıldı. Davet formu açılıp "Vazgeç" ile kapatıldı. Mail ("E-posta gönderimi") sekmesi bu hesapta (Proje Yöneticisi) görünmediği için yalnız kodla incelendi. Mobil emülasyon ekran görüntüleri bilinen hata nedeniyle (parçalı/tekrarlı) kullanılamadı; mobil, 390px'te DOM ölçümüyle doğrulandı (yatay taşma yok, 7 sekmenin hepsi).

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 13-H1 | Yüksek | hata / içerik | Mesai ve tatil → "Gece çarpanı", "Gece başlangıcı", "Gece bitişi" kaydediliyor (`saveOvertime`). | Hesap motoru yalnız gün türüne göre çarpan seçiyor (hafta içi / hafta tatili / resmi tatil); gece alanları başka hiçbir yerde okunmuyor. Kullanıcı 1,5 yazınca gece mesaisi için ücret değişeceğini sanır, değişmez (ölü ayar). | Ya gece çarpanını hesaba kat ya da alanları kaldır/"yakında" olarak işaretle. Ürün kararı #1. | `convex/lib/pdksHelpers.ts:171-186` (`multiplierForClassification` gece dikkate almıyor); `nightShift*` yalnız `schema.ts`, `holidays.ts`, `settings.ts`, `pdksHelpers.ts` (okuma/varsayılan), form ve testlerde geçiyor (grep); `OvertimeSettingsForm.tsx:44,66`; `d02-work-payroll.png` |
| 13-O1 | Orta | görsel | Switch (anahtar) etiketin hemen yanına yapışık, boşluk yok, dikey hiza kaymış; her satırda anahtar farklı x konumunda duruyor. Gizlilik'teki "Çalışan isimlerini maskele" doğru hizalı (farklı yerleşim). | Genel, Raporlar, Bildirimler'de dağınık görünüm; tutarsız bileşen kullanımı. | Switch alanlarına ortak satır yerleşimi: etiket solda, anahtar sağda, `flex items-center justify-between gap-4`. | `FormFieldWrapper.tsx:39-41` (Label + kontrol alt alta/inline akıyor); `d01-genel.png`, `d03-notifications.png`, `d07-reports-bottom.png` |
| 13-O2 | Orta | içerik / etkileşim | "Vazgeç" iki anlamlı: kaydet çubuğunda "değişikliği at", uyarı penceresinde "çıkmaktan vazgeç = sayfada kal". | Aynı kelime ters sonuç; kullanıcı yanlışlıkla taslağı atabilir. **Hâlâ açık (05-O6).** | Çubukta "Değişiklikleri at", pencerede "Sayfada kal" / "Çık ve at". | `SettingsSaveBar.tsx:11`, `UnsavedChangesDialog.tsx:24`; `d04-dirty-notif.png`, `d05b-dialog-settled.png` |
| 13-O3 | Orta | içerik | Davet formunda rol ipucu "Bu rol tüm projelerde geçerlidir", ama proje seçimi zorunlu ve aktif proje (NGS) önceden seçili değil ("Bir proje seçin"). | Çelişkili: davet tek projeye mi veriliyor, rol global mi? Gereksiz tıklama. | İpucunu netleştir ("Rol hesabın tamamı için geçerlidir; proje erişimi aşağıda seçilir") ve aktif projeyi önseç. | `UserFormDialog.tsx:150`, `:279`; `d09-davet-dialog.png` |
| 13-O4 | Orta | içerik / görsel | Kullanıcı satırında ad yerine e-posta iki kez yazılıyor; "Projeler" sütunu proje yöneticisi için sabit "Yetkili proje kapsamı" gösteriyor. | Bilgi taşımıyor; hangi projelere erişildiği görünmüyor. | Ad yoksa e-postayı tek satır yaz; proje adlarını listele ya da sütunu gizle. | `UserTable.tsx:34`, `identity` (`:55-57`); `d02-users.png` |
| 13-O5 | Orta | içerik | Raporlar sekmesi, kendi uyarısına göre "bordro doğrulaması yerine kullanılmamalı" olan eski SGK özetini indiriyor; Raporlar modülünde 16 rapor var. "2 kayıt" biriminin ne olduğu (kişi mi satır mı) belli değil. | Aynı iş iki yerde; Ayarlar'da güvenilmez rapor indirmek yanıltıcı. | Raporlar modülüne yönlendir veya sekmeyi kaldır. Ürün kararı #2. Sayıya birim ekle ("2 personel"). | `ReportsSettings.tsx:126,153,176`; `d03-reports.png` |
| 13-O6 | Orta | içerik | Genel → "Genel sistem bildirimleri" ve Bildirimler → "Sistem bildirimleri" iki ayrı kayıt, neredeyse aynı ad. | Hangisinin ne yaptığı anlaşılmıyor; açıklama "ayrıdır" demekten öteye geçmiyor. **Hâlâ açık (SET-UI-13).** | Birini kaldır/birleştir veya farklı adlandır; hangi bildirimi kestiğini yaz. | `SystemSettingsForm.tsx:14`, `NotificationSettings.tsx:27`; `d01-genel.png`, `d03-notifications.png` |
| 13-O7 | Orta | içerik | Gizlilik → "Son değişiklik" tarihi `toLocaleString("tr-TR")` ile saat dilimi verilmeden basılıyor. | Tarayıcı saat dilimine bağlı; UTC+3 garantisi yok. **Hâlâ açık (08-O2).** | `timeZone: "Europe/Istanbul"` ekle veya mevcut `adminDate`'i kullan (`AdminListParts.tsx:113` doğru yapıyor). | `BiometricModuleCard.tsx:53` (karşılaştır `BridgeIntegrationCard.tsx:56`) |
| 13-D1 | Düşük | içerik | Üst başlık "NGS · Seçili projenin…" ile hemen altındaki bölüm açıklaması aynı cümle. | Her sekmede tekrar. | Üst satırda yalnız proje adı; açıklama bir yerde. | `Settings.tsx:83,87`; tüm ekran görüntüleri |
| 13-D2 | Düşük | görsel | Form kontrol yükseklikleri tutarsız: input/Para birimi/Rol 36px, Rapor/Hatırlatma/Saklama select'leri 40px. | Aynı sayfada iki ölçü. | Ortak Select bileşeni/aynı yükseklik. | `ReportsSettings.tsx:37`, `ReportReminderSettings.tsx:21` (`h-10`), `CompanyInfoForm.tsx` (`h-9`); DOM ölçümü |
| 13-D3 | Düşük | içerik | "Excel İndir", "PDF İndir" Title Case; sayfanın geri kalanı cümle düzeni ("Kullanıcı davet et", "Anahtar oluştur"). **Hâlâ açık (03-D4).** | Etiket tutarsızlığı. | "Excel indir", "PDF indir". | `ReportsSettings.tsx:201,209` |
| 13-D4 | Düşük | erişilebilirlik | Mobilde dokunma hedefleri küçük: switch 44×24, checkbox 16×16, "Vardiyaları aç / Profilimi aç" bağlantıları 19px yüksekliğinde. | 36–44px altı; yanlış dokunma. | Switch satırının tamamını tıklanır yap; bağlantılara dikey dolgu. | DOM ölçümü 390px (Genel, Raporlar, Gizlilik, Bildirimler); `Switch` `h-[24px]` |
| 13-D5 | Düşük | etkileşim | "Resmi tatilleri yükle" tek tıkla toplu kayıt ekliyor, onay yok (mevcutları atlıyor). | Yanlış yıl seçiliyken istemeden 10+ kayıt. | Kısa onay veya sonuçta "Geri al". | `HolidayCalendarManager.tsx:80` |
| 13-D6 | Düşük | erişilebilirlik / gizlilik | Hikvision anahtarının maskesinde ilk 8 karakter açık; aynı maske iptal onayında da yazılıyor. Tam anahtar `listBridges` ile istemciye iniyor (maske yalnız görsel). Değer rapora yazılmadı. | Düşük risk (yalnız yönetici görür) ama maske sır korumak için zayıf. | 4 karakter göster; mümkünse tam anahtar yalnız oluşturulurken gösterilsin. | `BridgeIntegrationCard.tsx:35,54` |
| 13-D7 | Düşük | içerik | Kişisel hatırlatma kapsamı kirliyken değiştirilince çıkan pencere "Çıkarsanız… / Çık" diyor; sayfadan çıkılmıyor, yalnız kapsam değişiyor. | Metin duruma uymuyor. | Bu kullanım için "Kapsamı değiştirirseniz taslak silinir / Değiştir". | `ReportReminderSettings.tsx:47`, `UnsavedChangesDialog.tsx:21-25` |
| 13-D8 | Düşük | hata (doğrulanmadı) | Kullanıcı listesi filtresinde rol/proje değişince `...queryFilters` (300ms gecikmeli arama) yazılıyor; arama kutusuna yeni yazılan metin 300ms içinde rol değiştirilirse eski değere dönebilir. | Küçük veri kaybı; davranış tarayıcıda denenmedi. | `...filters` kullan. | `AdminUsersPanel.tsx:182,202` |
| 13-D9 | Düşük | performans | Süper admin dışı kullanıcılar için `users.list` tüm kullanıcıları getirip istemcide filtreliyor, sayfalama yok. | Kullanıcı sayısı arttıkça yavaşlar (şu an 1 kayıt; doğrulanmadı). | `adminList` benzeri sunucu tarafı filtre/sayfa. | `AdminUsersPanel.tsx:130,135-143` |
| 13-D10 | Düşük | içerik | Mesai alanlarında açıklama yok: çarpanların neye uygulandığı, "Yıllık sınır" aşılınca ne olacağı, gece başlangıç = bitiş kabul ediliyor (doğrulama yok). | Yanlış değer girilince fark edilmez. | Alan altı ipuçları; başlangıç ≠ bitiş doğrulaması. | `OvertimeSettingsForm.tsx:11-16,62-67`; `d02-work-payroll.png` |

## Eski bulgulardan durum (13 öncesi tarama `SET-UI-*`)
Kapanmış görünenler: SET-UI-01/07 (kirli taslak koruması çalışıyor), 02 (mobil seçici), 03/04 (tek h1, `aria-current`, nav adı), 06 (ortak SaveBar, yalnız kirliyken), 08/10 (açıklama notu, saat Vardiyalar'a), 11 (etiket bağları DOM'da doğrulandı), 12 (indirme/hatırlatma ayrı), 14/15 (metinler), 16/17 (yıl atlama, 36px silme), 19 (Pafta "Geliştiriliyor"). Hâlâ açık: SET-UI-13 → 13-O6; 05-O6 → 13-O2; 08-O2 → 13-O7; 03-D4 → 13-D3. SET-UI-09 (karanlık mod proje alanına yazılıyor) kısmen azaltıldı ("Proje varsayılanı" etiketi + ipucu); tema anahtarı denenmedi (yasak).

## Hızlı düzeltmeler (≤30 dk)
1. 13-O2 — "Vazgeç" etiketlerini ayır (2 dosya).
2. 13-O7 — `timeZone: "Europe/Istanbul"` ekle (1 satır).
3. 13-D3 — "İndir" → "indir".
4. 13-O1 — Switch satırı yerleşimi (FormFieldWrapper'a `inline` varyantı).
5. 13-O3 — Rol ipucu metni + aktif projeyi önseç.
6. 13-D1 — Başlıktaki tekrar eden kapsam cümlesini kaldır.

## Ürün kararı gereken
1. **Gece çarpanı** (13-H1): hesaba katılacak mı, yoksa alanlar kaldırılacak mı?
2. **Raporlar sekmesi** (13-O5): Raporlar modülü varken Ayarlar'da eski SGK indirici kalsın mı?
3. **Sekme geçişi geçmişi**: sekmeler `replace` ile değişiyor (geri tuşu önceki sekmeye dönmez, doğrudan önceki sayfaya gider); bilerek mi?

Ekran görüntüleri: `docs/ui-audit-2/13-ayarlar/` (d01–d09).

## Kararlar (Emre, 2026-10-19)
- 13-H1: gece çarpanı hesaba katılacak (gece saatlerine düşen çalışma); 08-H2 gece vardiyası işiyle birlikte.
- 13-H1 ek karar (2026-10-19 gece): çarpan birleşimi ayarlanabilir (Büyük olan / Çarpım / Ek prim; varsayılan Büyük olan), yalnız gece penceresindeki fazla mesaiye uygulanır; normal gece çalışmasına prim yok, yalnız gece dakikası gösterilir.
- 13-O5: eski SGK/resmi raporlar Ayarlar'da kalır; Raporlar'daki satırlar derin bağlantıyla ilgili rapora gider (11-O7).

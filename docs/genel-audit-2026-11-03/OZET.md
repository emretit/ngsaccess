# Genel audit 2026-11-03 — özet ve plan

> 8 modül, 8 Codex worker (gpt-6-astra high), salt okuma, Hik-Connect kıyası dahil. Kod: `main` 1b1be4ee + commit'siz "hafta tatili vardiyadan" işi.
> Raporlar: [01 Kişi](01-kisi-organizasyon.md) · [02 Geçiş](02-gecis-kontrol.md) · [03 PDKS](03-pdks-vardiya-izin.md) · [04 Rapor/SGK](04-raporlar-sgk.md) · [05 Cihaz](05-cihaz-entegrasyon.md) · [06 Alarm/Denetim](06-alarm-denetim.md) · [07 Ziyaretçi](07-ziyaretci.md) · [08 Hesap/Yetki](08-hesap-yetki-ayarlar.md)

## Plan

> **Güncel uygulama planı:** `.claude/plan-genel-audit-fix.md` (Faz A–G, 2026-11-03). Aşağıdaki ilk taslaktır.

### İlk taslak

### Faz 0 — Küçük ve acil (S, toplam ~yarım gün)
- [ ] RAP-003 APHB'den ziyaretçileri çıkar (`convex/sgkExport.ts:75`)
- [ ] ZIY-01 ziyaretçi aramasında ham kart numarasını yetkisiz kullanıcıya kapat (`convex/lib/visitorStatus.ts:52`)
- [ ] CIH-02 `listForClaim` yanıtından `idePassword`/`ideUser` çıkar (`convex/adminDevices.ts:40`)
- [ ] ALM-001 alarm listesinden `cardNo`/`rawData` çıkar ya da izne bağla (`convex/alarms.ts:46`)
- [ ] HSP-02 davet iptalini proje + amaçla sınırla (`convex/invites.ts:114`)
- (aynı paket, P1/P2 küçükler) ALM-010 seçim sıfırlama · CIH-11 kart yakalama düğmesi yetkisi · KIS-001 toplu departmanda ziyaretçiyi reddet · GK-06 bitiş dakikası `<` / `<=` eşitleme

### Faz 1 — Güvenlik ve erişim (~3 gün)
- [ ] CIH-01 IDE UUID'yi `update`'te de `assertIdeRosterMovable` ile koru (`convex/devices.ts:252`)
- [ ] HSP-01 normal davet kabulünde davet edenin güncel `admin.manage` yetkisini kontrol et; üyelik kaldırılınca açık davetleri iptal et (`convex/invites.ts:296`)
- [ ] CIH-06 gateway hata loglarında EhomeKey/token maskeleme (`convex/lib/gateway/core.ts:78`)
- [ ] CIH-03 cihazdan kişi aktarımı mevcut tarih/kapı kısıtını korusun, genişletme açık onay + `accessRules.manage` istesin
- [ ] GK-01 kapının cihazı/kapı no'su değişince eski hakkı geri al + yeni kapsamı dağıt (`convex/doors.ts:315`)
- [ ] HSP-03 (= KIS-005) yüz rızası iptali yüz şablonunu ve cihaz kopyasını silsin

### Faz 2 — Puantaj / maaş doğruluğu (~4-5 gün)
- [ ] **PDK-001** departmana ikinci gün planı önceki iş günlerini tatil yapıyor — **commit'siz hafta tatili işinde; o iş commit'lenmeden önce düzeltilmeli**
- [ ] PDK-004 eski modda manuel giriş + tek ham çıkış = 0 dk (`convex/lib/pdksDay.ts:141`)
- [ ] RAP-001 mesai özeti/departman maliyeti tatil-gece katsayısını kaybediyor (`convex/reports.ts:205`)
- [ ] RAP-002 eski hesap dalı (mola, 45 sa) bordrodan farklı → tek ortak hesap
- [ ] PDK-002 vardiya saati değişince çoklu plan sırası · PDK-006 yarım gün tatil mesaisi · PDK-007 çift yönlü cihazda ertesi gün çıkışı
- [ ] PDK-003 okuyucu düzenlemesi geçmiş PDKS noktasını değiştiriyor (kural sürümüne okuyucu adresi yaz)

### Faz 3 — Cihaz verisi güvenilirliği (~2-3 gün)
- [ ] CIH-04 yarım AcsEvent taraması `hikLastBackfillAt`'i ileri taşıyor → kaçan geçişler
- [ ] CIH-05 HTTP 200 içindeki ISAPI hata kodunu başarı sayma (events, devices, gatewayCommand)
- [ ] CIH-08 Hik olay köprüsüne diskte kuyruk + 429 bekleme (`infra/hik-event-bridge/bridge.mjs`)
- [ ] CIH-09 kısmi cihaz taramasını "tam" sayma · ALM-009 IDE/localBridge çevrimdışı alarmı

### Faz 4 — Denetim kaydı ve alarm (~2-3 gün)
- [ ] ALM-002 "Kritik" eşiği gerçek alarmları susturuyor (üretimde `critical` yok)
- [ ] ALM-004/005 kapı açan kişi + kural/rol/sır değişiklikleri denetime yazılsın
- [ ] ALM-003 toplu PDKS düzeltmesi çalışan geçmişine girsin · ALM-007/008 tekrar mail

### Faz 5 — Tasarım isteyenler (karar sonrası)
- [ ] PDK-005 (= KIS-002, eski P-05) tarihli departman üyeliği — L
- [ ] PDK-008 çoklu vardiyada ara giriş/çıkış düzeltmesi — L
- [ ] PDK-012 onaylı izni iptal etme akışı — M

## Kararlar (Emre 2026-11-03: koordinatör önerileri kabul)
1. **CIH-07 IDE fazlalık söküm:** Hik'te kaldırdığımız "fazlalık sil" IDE'de duruyor; `seedPanelUsers` ile içeri alınan yerel kişiler de sonraki kural güncellemesinde panelden silinebiliyor. → **Kapatılır**, yalnız fark gösterilir.
2. **PDK-001:** → **Hafta tatili paketine girer.**
3. **PDK-005 tarihli departman üyeliği** (L, ~2 gün): → **Yapılır** (Faz D5).
4. **ALM-006:** ayrılma denetimi tüm kişi kopyasını (T.C., ücret, not) süresiz tutuyor; → **Veri minimizasyonu** (yalnız değişen alanlar) + kişi anonimleşince audit kopyası da maskelenir.

## Koordinatör yeniden sınıflaması (kodda doğrulandı)

Worker'lar toplam **87 bulgu** verdi: 26 P0 · 40 P1 · 21 P2. Kodu okuyarak düzelttiklerim:

| Bulgu | Worker | Son | Gerekçe |
|---|---|---|---|
| GK-02 kural kaldırınca cihazdan kişi silme | P0 | **bulgu değil** | ngsplus'ın yönettiği kişi için hedefli iptal beklenen davranış; 2026-10-28 kararı yalnız yerel kişiler/toplu temizlik. Tek açık: Hik'te kişi silinince parmak izi de gider; kural geri verilince FP-Central'dan geri yükleniyor mu cihazda test et. |
| KIS-001 toplu departmanda ziyaretçi | P0 | P2 | Aynı proje içi kayıt türü karışması; sızıntı/erişim yok. |
| KIS-003 21+ haneli sıfır dolgulu kart | P0 | P1 | Gerçek ama uç durum (`convex/lib/cardIdentity.ts:20` ≤20 hane). |
| HSP-02 başka projenin davetini iptal | P0 | P1 | Davet/reset bağlantısını bozuyor (hizmet engelleme), hesap devralma yok. |
| PDK-005 = KIS-002, HSP-03 = KIS-005 | — | birleştirildi | Aynı kök sorun iki raporda. |

**Sonuç: 21 benzersiz P0.** Kodda kendim doğruladıklarım: CIH-01, CIH-02, HSP-01, HSP-02, GK-01, ZIY-01, ALM-001, RAP-001, RAP-003, PDK-004, KIS-001, KIS-003. Diğerleri worker'ın satır kanıtı ve bellek içi senaryo testiyle [kesin].

## P0 listesi (21)

| Alan | ID | Tek cümle | Efor |
|---|---|---|---|
| Güvenlik | CIH-02 | Herhangi bir projenin cihaz yöneticisi ortak havuzdaki tüm IDE panel şifrelerini okuyor | S |
| Güvenlik | CIH-01 | Silinen IDE cihazının UUID'si başka projede `update` ile alınıp o fiziksel kapıya komut gönderilebiliyor | M |
| Güvenlik | HSP-01 | Yetkisi alınan yöneticinin önceden gönderdiği davet 7 gün boyunca admin erişimi açıyor | M |
| Güvenlik | CIH-06 | Gateway hata loglarında cihaz anahtarı ve olay token'ı açık | M |
| Erişim | CIH-03 | Cihazdan kişi aktarımı kapı/tarih kısıtını kaldırıp 7/24 tüm kapı yetkisi yazıyor | L |
| Erişim | GK-01 | Kapının cihazı/numarası değişince eski kapı hakkı cihazda kalıyor | L |
| Kişisel veri | ZIY-01 | Maskeli ziyaretçi kartı arama ile hane hane çıkarılabiliyor | S |
| Kişisel veri | ALM-001 | Alarm listesi kart no + ham olay verisini yetkiden bağımsız döndürüyor | M |
| KVKK | HSP-03 | Yüz rızası geri çekilince yüz şablonu silinmiyor | M |
| Maaş | RAP-001 | Mesai özeti tatil/gece katsayısını tek katsayıya düşürüyor (200 TL yerine 150 TL) | M |
| Maaş | RAP-002 | Eski hesap dalında mesai özeti ile bordro farklı (aynı gün 750 TL / 562,50 TL) | L |
| SGK | RAP-003 | Aktif ziyaretçi APHB'ye 30 prim günüyle giriyor | S |
| Puantaj | PDK-001 | Departmana ikinci gün planı önceki iş günlerini sessizce tatil yapıyor (commit'siz) | M |
| Puantaj | PDK-002 | Vardiya saati değişince çoklu planın sırası eski kalıyor, okutmalar yanlış vardiyaya | M |
| Puantaj | PDK-003 | Okuyucu numarası değişince geçmiş günlerin PDKS noktası eşleşmesi kayboluyor | L |
| Puantaj | PDK-004 | Eski modda manuel giriş + tek çıkış okutması 0 dk sayılıyor | M |
| Puantaj | PDK-005 | Departman transferi geçmiş ayların vardiya/puantajını yeniden yazıyor | L |
| Puantaj | PDK-006 | Yarım gün tatilde çalışılan süre tatil mesaisine ayrılmıyor | M |
| Puantaj | PDK-007 | Çift yönlü cihazda ertesi güne sarkan gündüz vardiyası çıkışı "giriş" oluyor | M |
| Cihaz verisi | CIH-04 | Yarım kalan geçmiş taraması zaman sınırını ileri taşıyor, eski geçişler kaçıyor | M |
| Cihaz verisi | CIH-05 | HTTP 200 içinde dönen ISAPI hatası "başarılı, boş" sayılıyor | M |

## Hik-Connect kıyası özeti

- **Belgeler iyimser kalmış:** `KIYAS.md` / `PDKS_KIYAS.md` / rapor kataloğunda **~42 satır** güncellenmeli (01: 4 · 02: 5 · 03: 7 · 04: 9 · 05: 4 · 06: 5 · 07: 0 · 08: 3 + 2 yeni satır).
- **✅ → 🟡/❌ (abartılmış):** Batch Control (toplu kapı aç/kilitle yok) · Access Overview · Access Schedule Template (sadeleştirmeyle bağımsız şablon kalktı → ❌) · AC Holiday (kişi kurallarına bağlı değil) · Alarm Center (ses/pop-up yok) · Operation Log (kapsam eksik) · departman ağacı (alt departman dahil et yok) · toplu kart · ayrılma (tarih/tip/neden yok).
- **❌ → ✅/🟡 (belge geride):** Remain Unlocked/Locked (Hik gateway kapısında var) · cihazdan geçmiş olay çekme var · Operation Log Excel dışa aktarma var · Alarm Search (arama kısmı var) · cihaz çevrimdışı geçmişi backend'de var (UI yok).
- **Raporlar (REA kataloğu):** 19 Hik raporunun hepsinin karşılığı var, hepsi 🟡: kolon farkları (ayrı ad/soyad, kişi ID, tam departman yolu, plan/gerçek tarih kolonları), ayrı ID filtresi yok, TXT/yazdır çıktısı yok (CSV bizde fazla). 3 export-only Hik raporu bizde ekranda da var (➕).

### Hik'te olup bizde eksik — modüller arası öneri sırası
1. **Cihaz/kapı işlem günlüğü + cihaz sağlık geçmişi ekranı** — M. Backend hazır (`getConnectivityHistory`, `deviceEvents`); önce ALM-004 (kapıyı kim açtı) kapanmalı.
2. **Proje yöneticisine kullanıcı dondurma / erişim bitişi ekranı** — M. Backend hazır (HSP-06).
3. **Kaynak + olay bazlı alarm kuralı ve alarm Excel'i** — M/L. ALM-002 sabit önem sorununu da çözer.
4. **İzin/düzeltme ek dosyası + çalışana karar bildirimi** — M. Mobil talep döngüsü zaten var.
5. **Ziyaretçiye süreli QR/PIN + geçiş sayısı** — L. Kart dağıtma/toplama yükünü kaldırır.

## Önceki audit'ler — ne kapandı
- **Genel akış (2026-10-22) Faz 1 tamamen kapandı:** 1.1 kural yazma yetkisi · 1.2 kapı/bölge/okuyucu · 1.3 tatil izolasyonu · 1.4 denetim geçmişi izolasyonu. 1.5 kart eşleştirme kısmi (KIS-003).
- **Faz 2:** 2.1 eski kart · 2.3 silme yeniden deneme · 2.4 ziyaretçi 2037 bitişi kapandı (kod); 2.2 kısmi (IDE yerel kişi ayrımı = CIH-07); 2.5 saha testi yapılmadı.
- **Faz 3:** 3.1 tek-45-saat kapandı (dar kapsam) · 3.3 hafta tatili vardiyadan (commit'siz) kapandı · 3.2 SGK ortak hesap kısmi (RAP-002) · 3.4 çift yön kısmi (PDK-007).
- **Faz 4:** 4.1 mobil talep ekranı kapandı · 4.2 çalışana karar bildirimi açık.
- **Faz 5:** 5.3 kurulum listesi kapandı · 5.1 Windows köprüsü roster kısmi · 5.2 çevrimdışı alarm kısmi (ALM-009).
- **Sistem audit kalanları:** P-04 katsayı (= RAP-001), P-05 departman geçmişi (= PDK-005), P-07 çoklu vardiya ara düzeltme (= PDK-008), P-08 sınırsız PDKS taraması (= PDK-014) hâlâ açık. M2 C-02 IDE panel devri açık (= CIH-01). Ziyaretçi 2026-10-27 audit'inin 13 bulgusunun hepsi kapandı.

## Yöntem
- Worker'lar yalnız kendi rapor dosyasını yazdı; HEAD `1b1be4ee` değişmedi, commit/stash yok, çalışma ağacında rapor klasörü dışında değişiklik yok (koordinatör `git status` + reflog kontrolü).
- Hedefli testler: 01: 78 · 02: 49 · 03: 59 · 04: 40 · 05: 19 · 06: 22 · 07: 72 · 08: 114 — hepsi geçti. Tam paket koşulmadı.
- Canlı DB, cihaz, tarayıcı, Hik portalı kullanılmadı. Cihaz davranışı gerektiren bulgular (GK-01, CIH-03/04/05, HSP-03, PDK-007) sahada doğrulanmalı.
- Kapsam dışı: mobil Flutter uygulaması, landing/public sayfalar, Windows köprüsü (C#) derin incelemesi.

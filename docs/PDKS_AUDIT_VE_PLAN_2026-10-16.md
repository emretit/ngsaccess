# PDKS Audit + Geliştirme Planı — 2026-10-16

> Kapsam: mevzuat (4857 İş Kanunu, SGK, KVKK) + pazar araştırması → ngsaccess PDKS kodunun
> bu gereksinimlere karşı denetimi → fazlı geliştirme planı.
> Hukuki notlar genel bilgidir; uygulama öncesi mali müşavir / hukukçu teyidi önerilir.

## 1. Özet

1. **KVKK 2026/921 ilke kararı ürün modelini değiştiriyor:** mesai takibi için yüz/parmak izi/iris
   açık rızayla bile hukuka aykırı (RG 02.06.2026, sayı 33268). ngsaccess şu an Hikvision yüz
   olaylarından PDKS kaydı üretiyor → yasal risk.
2. **SGK çıktısı yanlış:** eksik gün kodları SGK tablosuyla uyuşmuyor (devamsızlık "08" yazılıyor,
   08 = Grev) ve hafta tatili + resmi tatiller eksik gün sayılıyor.
3. **Sahte check-in açığı:** kimlik doğrulamasız iki public mutation ile herhangi bir çalışan
   adına "giriş" kaydı yazılabiliyor.
4. **Hesap motoru:** gün sınırı UTC'ye göre (TR 00:00–02:59 yanlış güne düşüyor), mola kademesi
   md. 68'den sapıyor, gece vardiyası modeli yok, 3 ekran 3 farklı mesai hesaplıyor (R8).

## 2. Gereksinimler (araştırma)

### 2.1 KVKK — 2026/921 İlke Kararı (29.04.2026, RG 02.06.2026/33268)
- Mesai takibi amacıyla parmak izi, yüz tanıma, iris, retina **açık rıza olsa bile** ölçülülüğe aykırı;
  matematiksel şablona çevirmek biyometrik niteliği değiştirmez.
- Önerilen alternatifler: RFID/NFC kart, PIN/şifre, şifreli kart, imza/çizelge, gözetimli manuel giriş
  (yorumlarda QR ve mobil de geçiyor).
- Yaptırım: KVKK md. 18 idari para cezası (2026 için ~427 bin – 17 milyon TL aralığı).
- Yorumcular: yüksek güvenlikli **kritik alan erişimi** ayrı değerlendirilebilir, ancak bu sistemler
  **mesai/puantaj kaydı üretmemeli**; mevcut biyometrik şablonların imhası + VERBİS güncellemesi öneriliyor.
- Ayrıca: KVKK md. 9 yurtdışı aktarım (2024 değişikliği) — standart sözleşme + Kurum'a bildirim.

### 2.2 4857 İş Kanunu (puantajı doğrudan etkileyenler)
| Konu | Kural |
|---|---|
| Haftalık süre | En çok 45 saat; aşan = fazla çalışma (%50 zam) |
| Fazla sürelerle çalışma | Sözleşme < 45 saat ise aradaki süre %25 zam |
| Denkleştirme | 2 ay (TİS ile 4 ay); günlük 11 saat tavanı |
| Yıllık fazla çalışma | En çok 270 saat; işçinin yazılı onayı; serbest zaman seçeneği (1 sa → 1,5 sa) |
| Ara dinlenme (md. 68) | ≤4 sa → 15 dk · 4–7,5 sa (dahil) → 30 dk · >7,5 sa → 1 sa; çalışmadan sayılmaz |
| Gece (md. 69) | Gece dönemi en geç 20:00'de başlar, en erken 06:00'da biter (≤11 sa); gece çalışması ≤7,5 sa |
| Hafta tatili | 7 günlük dilimde kesintisiz en az 24 saat (genelde Pazar) |
| UBGT | Genel tatilde çalışana ilave 1 günlük ücret |
| Yıllık izin | 1–5 yıl 14 gün · 5–15 yıl 20 gün · 15+ yıl 26 gün; 18 yaş altı / 50 yaş üstü en az 20 gün |

### 2.3 SGK eksik gün kodları (MUHSGK / APHB)
`01` İstirahat · `03` Disiplin cezası · `04` Gözaltı · `05` Tutukluluk · `06` Kısmi istihdam ·
`07` Puantaj kayıtları · `08` Grev · `09` Lokavt · `10` Genel hayatı etkileyen olaylar · `11` Doğal afet ·
`12` Birden fazla · `13` Diğer nedenler · `15` Devamsızlık · `16` Fesih tarihinde çalışmamış ·
`18` Kısa çalışma ödeneği · `19` Ücretsiz doğum izni · `20` Ücretsiz yol izni · `21` Diğer belgeli ·
`22–29` yarım çalışma / pandemi varyantları. **Ücretli izinler, hafta tatili ve UBGT eksik gün değildir.**
Aylık ücretlide tam ay = 30 gün. (Resmi kılavuzla teyit edilmeli.)

### 2.4 Pazar beklentileri
- Kolay İK: donanımsız/mobil PDKS, "biyometri toplamıyoruz" (KVKK argümanı), geç giriş/erken çıkış
  bildirimi, fazla mesai otomatik tespit + onaya düşme, puantaj → bordro otomatik aktarım.
- PDKS Bulut: karar sonrası kart/PIN/RFID/QR/mobil konumlandırması, audit log, saklama/imha.
- Barkodes: Logo, Netsis, SAP entegrasyonu.
- Ortak beklenti: vardiya planlama, eksik okutma uyarısı, fazla mesai onayı, dönem kapatma,
  bordro export (Logo/Mikro/Netsis), mobil + kiosk.

## 3. Kod denetimi — bulgular

### 🔴 Kritik
| # | Bulgu | Yer |
|---|---|---|
| P1 | Biyometrik olay (yüz `0x4b`, parmak `0x26`, yüz+kart …) doğrudan PDKS kaydı üretiyor; biyometri için "açık rıza" kaydı (`employeeConsents.biometric_*`) artık hukuki dayanak değil | `cardReadings.ts:886`, `schema.ts:930` |
| P2 | SGK kod tablosu yanlış: `02` yok, `08`=Grev (kodda devamsızlık), `09`=Lokavt (iş kazası), `10` (doğum izni), `11` (askerlik), `12` (iş akdi askıda); yıllık izin "21" ile eksik gün yazılıyor | `lib/sgkCodes.ts:7-38` |
| P3 | Eksik gün = ay günü − çalışılan − izin → hafta tatili + UBGT eksik gün sayılıyor (tam çalışan personele ~8-9 gün "devamsızlık"); super_admin'de tüm projeler tek işyeri; işten çıkan personel listede yok; `tcNo` boş geçebiliyor; fazla mesai `0` sabit | `sgkExport.ts:36-118` |
| P4 | `createCheckInToken` kimlik doğrulamasız public mutation + `checkInWithToken` public → employeeId bilen herkes o çalışan adına `izin_verildi` kaydı yazar. UI'da `createCheckInToken` hiç kullanılmıyor | `employeeCheckIn.ts:9,61` |
| P5 | Gün anahtarı UTC: 13 yerde `accessTime.split("T")[0]` + aralık `T00:00:00.000` (Z'siz) → TR 00:00–02:59 okumaları önceki güne düşüyor / aralık dışında kalıyor | `cardReadings.ts:266,670`, `lib/pdksTable.ts:219`, `sgkExport.ts:69`, `reports.ts`, `dashboard.ts` |

### 🟠 Yüksek
| # | Bulgu | Yer |
|---|---|---|
| P6 | Mola kademesi md. 68'den sapıyor: ≤4 sa → 0 (kanun 15 dk), tam 4 sa → 30 (15), tam 7,5 sa → 60 (30); yorum satırı da yanlış | `lib/breakDeduction.ts:5-15` |
| P7 | Gece yarısını geçen vardiya yok (`shifts`'te alan yok, gün = ilk/son okuma); gece oranları tanımlı ama hiçbir hesapta kullanılmıyor; gece varsayılanı 22:00 (kanun: en geç 20:00); 7,5 sa gece sınırı kontrolü yok | `schema.ts:733`, `lib/pdksHelpers.ts:39` |
| P8 | Giriş/çıkış yönü hesapta kullanılmıyor: süre = son − ilk okuma; aradaki dışarı çıkışlar çalışma sayılıyor; detay logu her okumayı "Giriş" yazıyor | `lib/pdksTable.ts:191-242,438` |
| P9 | R8: tablo (ham dk), bordro (net + haftalık), detay (net + sabit 8 sa) aynı gün için farklı mesai | `lib/pdksTable.ts`, `lib/pdksPayroll.ts`, `lib/pdksDetail.ts` |
| P10 | Çalışma günü olmayan her gün "hafta tatili" (`HT`) + %100 premium; Cumartesi çalışması haftalık 45 saate eklenmiyor | `lib/pdksHelpers.ts:155-191`, `lib/overtimeCalc.ts:58` |
| P11 | 270 saat yalnız gösteriliyor (birikim/uyarı yok); yıllık fazla mesai onayı ve serbest zaman yok | `lib/pdksTable.ts:428` |
| P12 | Mobil self check-in statik QR (cihaz kimliği sabit) → QR fotoğrafıyla uzaktan giriş; konum sunucuda doğrulanmıyor (web check-in'de lat/lng sadece `rawData`) | `cardReadings.ts:1313`, `employeeCheckIn.ts:98` |

### 🟡 Orta
| # | Bulgu | Yer |
|---|---|---|
| P13 | İşe giriş/çıkış ve doğum tarihi alanı yok → yıllık izin hakedişi, ay ortası giriş/çıkış, SGK `16` hesaplanamıyor; 10 sorgu `isActive=true` filtreli → çıkan personel geçmiş raporlardan düşüyor | `schema.ts:67-112` |
| P14 | Dönem kapatma/kilit yok; bordrodan sonra geçmiş ay manuel düzeltilebiliyor (audit var, onay yok) | `pdksRecords.ts` |
| P15 | `getPdksTableData` super_admin dalı `by_access_time` + `.filter` = tam tablo taraması; proje dalı projenin tüm okumalarını tarar → Convex kota riski | `cardReadings.ts:274-299` |
| P16 | PDKS asistanı çalışan adı + giriş saatlerini OpenAI'ya gönderiyor (yurtdışı aktarım, md. 9) | `actions/getChatData.ts:64,87` |
| P17 | Bordro entegrasyonu yok (Logo/Mikro/Netsis "yakında"); yalnız genel Excel/CSV | `IntegrationsSettings.tsx:6` |

### ✅ Sağlam olanlar
- Haftalık 45 saat bucket'ı + günlük 11 saat tespiti (bordro ekranı).
- 2024–2030 TR resmi + dini tatil takvimi (arife yarım gün dahil, Diyanet tarihleriyle uyumlu).
- Vardiya ataması tarih aralığı + hafta deseni; vardiya bazlı tolerans.
- Manuel düzeltmeler audit log'a yazılıyor; 10 izin türü; saf hesap çekirdeği + golden testler.

## 4. Geliştirme planı

### Faz 0 — Acil düzeltmeler (~1,5 gün)
1. P4: `createCheckInToken` → admin-authed (veya sil) + `checkInWithToken`'a proje/cihaz bağlamı (~1 sa)
2. P2: SGK kod tablosunu resmi listeye çek + test (~1 sa)
3. P3: eksik gün = yalnız ücretsiz/raporlu/devamsız iş günleri; hafta tatili/UBGT/ücretli izin hariç; 30 gün kuralı; proje (işyeri) bazlı; dönemde çalışmış pasifler dahil; boş TC uyarısı (~5 sa)
4. P5: tek `trDateKey()` + `trDayRangeISO()` helper, 13 noktaya uygula + test (~4 sa)
5. P6: md. 68 kademeleri + test (~30 dk)

### Faz 1 — KVKK uyumu (~4 gün) ⚠ hukuki risk
1. Kapı/cihaz "amaç" alanı: `pdks` | `erisim`. Biyometrik doğrulama olayları PDKS'ye **girmez** (yalnız geçiş logu).
2. Biyometri modülü varsayılan kapalı; açarken "kritik alan erişimi" gerekçesi + uyarı metni.
3. İmha aracı: proje bazlı yüz/parmak şablonlarını Convex + cihazlardan toplu sil + imha tutanağı (audit).
4. Rıza ekranında biyometriyi PDKS gerekçesi olarak sunan metni kaldır; aydınlatma metni şablonu.
5. Asistan: isimleri maskele / opt-in; `cardReadings` saklama süresi ayarı.

### Faz 2 — Tek hesap motoru (~2 hafta)
`lib/attendanceEngine.ts`: tek kanonik `computeAttendanceDay` → 3 ekran (tablo/bordro/detay) aynı sonucu gösterir (R8 kapanır).
- Yön-bazlı giriş/çıkış çiftleri (P8), eksik çift tespiti.
- Vardiya penceresine göre gün ataması → gece yarısını geçen vardiya (P7).
- md. 68 mola, haftalık 45 sa + opsiyonel denkleştirme, çalışan bazlı hafta tatili günü (P10).
- Gece dönemi 20:00–06:00 + 7,5 sa uyarısı; UBGT ilave gün.
- Mevzuat örnekleriyle golden testler; geçiş için eski/yeni karşılaştırma raporu.

### Faz 3 — Operasyon akışları (~2 hafta)
1. Eksik okutma / geç giriş tespiti + yönetici ve çalışan bildirimi.
2. Fazla mesai onay akışı + yıllık yazılı onay kaydı + 270 sa sayacı + serbest zaman (P11).
3. Puantaj onayı + dönem kilidi; kilitli dönemde düzeltme = gerekçeli talep (P14).
4. İşe giriş/çıkış + doğum tarihi → yıllık izin hakedişi otomatik (P13).

### Faz 4 — Biyometrisiz kimlik kanalları (~1 hafta)
Dönen QR kiosk (30 sn TOTP), sunucu tarafı geofence, mobil NFC, PIN (P12). Hikvision terminallerinde kart + QR (`0x9c`) modları.

### Faz 5 — Entegrasyon + performans (~1 hafta)
Logo / Mikro / Netsis Excel şablonları, MUHSGK eksik gün listesi; `by_project_access_time` index'i ile tarama düzeltmesi (P15).

## Kaynaklar
- KVKK 2026/921 (RG metni): https://www.lexpera.com.tr/resmi-gazete/metin/kisisel-verileri-koruma-kurulunun-29-04-2026-tarihli-ve-2026-921-sayili-karari-33268
- İMER rehber: https://imer.av.tr/rehber/biyometrik-mesai-takibi-kvkk-ilke-karari
- Prozon sirküler (kritik alan ayrımı): https://prozon.net/sirkuler/kvkkdan-mesai-takibinde-biyometrik-veri-islenmesine-iliskin-kritik-kamuoyu-duyurusu-karakter-kodlamasi-matematiksel-kod-biyometrik-niteligi-degistirmez-acik-riza-dahi-olsa-mesai-takibinde-b/
- NPartners inceleme: https://npartners.com.tr/tr/6698-sayili-kanun-kapsaminda-biyometrik-verilerle-mesai-takibinin-hukuki-rejimi-kvkknin-2026921-sayili-ilke-karari-incelemesi/
- KVKK 2026 ceza tutarları: https://cottgroup.com/tr/mevzuat/item/administrative-fine-amounts-in-kvkk-for-2026
- Çalışma süreleri: https://wageindicator.org/tr-tr/turkiye-de-calismak/is-hukuku/tazminat-ve-calisma-suresi , https://www.muhasebenews.com/?p=142594
- SGK eksik gün kodları: https://www.eleman.net/is-rehberi/calisan-rehberi/sgk-eksik-gun-nedenleri-nelerdir-h8196 , https://kolayik.com/blog/sgk-eksik-gun-nedenleri
- Pazar: https://kolayik.com/pdks , https://www.pdksbulut.com/parmak-izi-ile-mesai-takibi-kvkk/ , https://www.habergazetesi.com.tr/personel-devam-kontrol-sistemlerinde-yeni-donem-barkodesten-yerli-ve-akilli-cozumler

# Sistem audit'i — özet ve düzeltme planı (2026-10-25)

## Plan (checklist — Emre onayı bekliyor)

### Faz 0 — Acil güvenlik: canlıda istismar edilebilir (~1 gün)
- [ ] 0.1 **Mobil hesap devralma** (X-01, P0): `sendEmployeeSetupEmail` `employees.manage` istesin, e-posta/ad/proje çalışan kaydından alınsın (`convex/actions/sendEmail.ts:141`) — S
- [ ] 0.2 **Başka projenin IDE paneline kapı komutu** (C-01, P0): `ideUuid` her create/update/claim yolunda global tekil (`convex/devices.ts:233`, `lib/deviceProvision.ts:66`) — S
- [ ] 0.3 **Taşımada eski kart cihazda kalıyor** (K-02 + C-02, P0) — geçici: kişi proje değişimini ve IDE cihaz taşımayı reddet (`convex/employees.ts:294`, `lib/deviceAssignment.ts:137`) — S
- [ ] 0.4 **Yetki tutarlılığı kümesi** (P1): kişi formundan kural üyeliği → `accessRules.manage` (K-01); ziyaretçi uçları → `visitors.manage` + maske (K-03, K-06); takvim izin notu dar DTO (P-02); asistan + fotoğraf URL → `employees.view` (Y-02); dondurulmuş hesaba rapor maili gitmesin (R-01) — her biri S
- [ ] 0.5 **IDE izin daraltma panele uygulanmayabilir** (C-03, P0): önce test panelinde `create_data` cevabını gör, sonra köprü hata kodunu iletsin (`scripts/lib/ide-mqtt-routing.mjs:54`) — S + cihaz teyidi

### Faz 1 — Mobil 1.0.5 yayın engelleri (~0,5-1 gün)
- [ ] 1.1 **Düzeltme talepleri kimseye görünmüyor** (X-02): yönetici paneli `bb7d942a^`'dan geri, PDKS İşlemler menüsüne bağla — S
- [ ] 1.2 **Mobil özet hata ekranı** (B-03): sabit kurallı projede Dart `presentDays` eşitlik kontrolü yanıtı reddediyor (`mobile/lib/models/attendance_summary.dart:179`) — S
- [ ] 1.3 Kişi silinince bekleyen izin/düzeltme talepleri karar verilemez kalıyor (R-03) — M
- [ ] 1.4 Mobil hata kodu allowlist eksikleri (8 kod "bilinmeyen hata" görünüyor; M5 §4.2) — S

### Faz 2 — Erişim geri alma + IDE köprü teslimi (~3-4 gün + cihaz testi)
- [ ] 2.1 IDE köprü teslim paketi: hata kodu (C-03 tam), sahipsiz kuyruk işi (C-04), olay/ACK kalıcı tekrar (C-06), web kapı açma komutuna süre + tek deneme (C-09), `requeue-ide-timeouts` düşük frekansla — M/L
- [ ] 2.2 Kart olayı tekilleştirme (C-05) + Hik canlı olayda cihaz zamanı (eski A teyit 10) — M
- [ ] 2.3 Hik silme retry adil tarama (C-08) · IDE sayısal kart çakışması `00123`=`123` (K-04) — M
- [ ] 2.4 Kalıcı taşıma akışları (K-02 kişi, C-02 IDE): "önce eski cihazdan sil → ACK → yeni projede aç"; Faz 0.3 engeli bununla kalkar — L
- [ ] 2.5 Eski açıklar: ziyaretçi bitişi cihaza (Hik 2037), ziyaretçi kart iadesi yarışı, IDE çözülemeyen kapı seçiminde tüm kapılara genişleme (A2-5), ayrılma tarihi cihaza bitiş olarak — M

### Faz 3 — Puantaj ve para doğruluğu (~3-5 gün)
- [ ] 3.1 **Departman değişince geçmiş ay puantajı değişiyor** (P-05, P0): tarihli departman üyeliği / transfer tarihi — L
- [ ] 3.2 Mesai özeti/departman maliyeti raporu tatil-gece katsayısını kaybediyor (P-04) — M
- [ ] 3.3 Ertesi güne uzanan sabit vardiya çıkışı yanlış güne yazılıyor (P-06) — S
- [ ] 3.4 PDKS/bordro uçlarında `projectId` zorunlu (P-03) — S
- [ ] 3.5 PDKS/geçiş okuma izin anahtarı (P-01) — **karar gerekli (aşağıda #2)**, sonra M
- [ ] 3.6 Çok vardiyalı günde ara giriş/çıkış manuel girilemiyor (P-07) — L

### Faz 4 — Dayanıklılık, kota, saklama (~3-4 gün)
- [ ] 4.1 Saklama/temizlik politikası + cron: kuyruk/sync/deviceEvents/audit (R-04), QR/oturum/kapı niyeti (B-07, B-01), eski profil fotoğrafı (K-05) — M/L
- [ ] 4.2 Sınırsız tarama / kör `take(N)`: K-08, P-08, P-09, C-07, Y-08 — L
- [ ] 4.3 AI asistan hız/uzunluk sınırı (Y-06) · alarm e-posta bekçisi (Y-05) · biyometrik imha tutanağı cihaz işlerini bekleyecek (Y-04) — S/M
- [ ] 4.4 HTTP gövde boyutu + auth önce (C-11) — M

### Faz 5 — Eksik akışlar ve tutarsızlıklar (~2-3 gün)
- [ ] 5.1 Web şifre sıfırlama akışı yok (Y-03) — M
- [ ] 5.2 Çalışan e-postası normalize değil → büyük harfli kayıt mobilde giremiyor (R-02) — M
- [ ] 5.3 Küçükler: K-07, K-09, K-10, P-10, P-11, B-06, Y-07, Y-09, Y-10, C-10 — her biri S
- [ ] 5.4 Windows köprüsü (ertelendi) aktif UI'da hâlâ seçilebiliyor → gizle — S

### Faz 6 — Temizlik (~1 gün)
- [ ] 6.1 18 çağıransız public uç (3'ü Faz 1.1'de bağlanacak) — tek tek karar + kaldırma
- [ ] 6.2 Şema borcu: `mailSettings`, `chatConversations`, `leaveBalances`, `workSettings.lunch*`, 12 kullanılmayan index; cron sözdizimi (Y-12); R-05, K-11

### Karar gerekenler (Emre)
1. **Pasifleştirme** geçici askı mı, kalıcı iptal mi? (Bugün mobil oturum/QR silinmiyor; yeniden aktifleşince eski token geçerli olabiliyor.)
2. **PDKS/geçiş kayıtlarını kim görsün?** Bugün hiçbir izin anahtarı istenmiyor; projedeki her üye görüyor. Öneri: `reports.view` veya yeni `attendance.view`.
3. **Proje pasifleştirme** ne demek: arşiv mi, erişimi durdur mu? (Bugün cihazlar, kuyruklar, mobil giriş ve rapor maili sürüyor.)
4. X-02 için öneri: paneli geri getir (mobilde gizlemek yerine).

## Sonuç (sade)

Sistem büyük ölçüde çalışıyor ve 22 Ekim audit'inin kritik maddelerinin çoğu kapanmış (Hik erişim geri alma, yetki açıkları, kart↔proje eşleştirme, cihaz taşıma engeli). Yeni turda **57 yeni bulgu** çıktı; P0/P1 olan 41'i ayrı bir denetçi (Claude) koddan yeniden doğruladı: **hiçbiri yanlış değil**, 20'sinin önemi abartılıydı ve indirildi. Gerçek **P0 sayısı 6**:

| # | Bulgu | Kim yapabilir / ne olur |
|---|---|---|
| X-01 | Çalışanın mobil hesabını devralma | viewer/security/technician rolü, kendi e-postasına aktivasyon linki yollatıp çalışan olarak mobile girer |
| C-01 | Başka projenin IDE paneline kapı komutu | Bir projede teknisyen, başka projenin panel UUID'sini kendi cihazına yazar, o kapıyı açtırır |
| K-02 | Kişi proje değiştirince eski kart cihazda kalır | Çok projeli yönetici kişiyi taşır; eski projenin kapısı açılmaya devam eder, sonra silinemez |
| C-02 | IDE panel proje değiştirince eski kartlar panelde kalır | super_admin paneli başka müşteriye atar; eski müşterinin kartları çalışır |
| C-03 | IDE'de izin daraltma uygulanmayabilir | Köprü hata metnini sildiği için "zaten var → güncelle" dalı çalışmıyor (panel cevabı canlıda teyit edilmeli) |
| P-05 | Departman değişince geçmiş puantaj değişir | Bugünkü departmanın vardiya planı geçmiş aylara da uygulanıyor → bordro geriye dönük değişir |

Üç ana tema:
1. **Yetki "ana kapıda" var, "yan kapılarda" yok:** aynı veriye giden ikinci bir uç yetkiyi kontrol etmiyor (X-01, K-01, K-03, P-01, P-02, Y-02, R-01).
2. **Taşıma ve köprü teslimi:** fiziksel cihazdaki kimlik/roster, DB'deki taşımayı takip etmiyor; IDE köprüsü hata/ACK/tekrar sözleşmesi zayıf.
3. **Geçmişe karşı kararsız puantaj + iki ayrı hesap:** departman tarihçesi yok, raporlar bordro motorundan ayrı para hesaplıyor.

Kota: cron'lar ayda ~56 bin çağrı (Convex Free 1M'nin %6'sı). IDE poll açılırsa veya panel sayısı artarsa hızla aşılır (10 panel × 60 sn heartbeat ≈ 1,1M/ay).

## Raporlar
- [M1-kisi-erisim.md](M1-kisi-erisim.md) — kişiler, erişim kuralları, ziyaretçi (11 yeni)
- [M2-cihaz.md](M2-cihaz.md) — cihaz, kapı/okuyucu, kart olayı, köprüler (11 yeni)
- [M3-pdks.md](M3-pdks.md) — PDKS, vardiya, izin/talep, rapor (11 yeni)
- [M4-hesap-yonetim.md](M4-hesap-yonetim.md) — hesap, roller, ayarlar, KVKK, alarm, 540 fonksiyon yetki sayımı, cron maliyeti (12 yeni)
- [M5-mobil.md](M5-mobil.md) — Flutter + çalışan uçları (7 yeni)
- [ILISKILER.md](ILISKILER.md) — kişi/proje yaşam döngüsü matrisi, kimlik/zaman sözleşmesi, saklama/kota, şema borcu, 18 ölü uç (5 yeni)
- [DOGRULAMA.md](DOGRULAMA.md) — P0/P1 bağımsız doğrulama: 21 DOĞRU / 20 KISMEN / 0 YANLIŞ, önem düzeltmeleri, kök neden kümeleri

## Yöntem
5 Codex (gpt-6-astra high) salt-okuma modül worker'ı → 1 Codex ilişki worker'ı + 1 Claude (opus high) doğrulayıcı (yazan denetlemez).
Orca run `run_6ad575351ae0`; spec'ler `.claude/orca-specs/sistem-audit-*.md`. HEAD `520ba5fc` → `77bce329` (arada başka oturumun mobil talep + doküman commit'leri).
Kod, DB, cihaz, ağ değişikliği yok; "KESİN" = kodda kanıtlı, sahada denenmedi. Emek: S ≤2 sa · M ≤1 gün · L >1 gün.

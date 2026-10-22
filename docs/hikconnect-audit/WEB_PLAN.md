# Hik-Connect kıyası → Web eksikleri planı

> **Tarih:** 2026-10-20 · **Kaynak:** [KIYAS.md](KIYAS.md), [UYGULAMA_PLANI.md](UYGULAMA_PLANI.md), kod taraması (main `71163d0`, canlı)
> **Kapsam:** yalnız web (React + Convex). Mobil (Flutter, P8) ayrı ekibin işi.

## Checklist

### Dalga 1 — BİTTİ, canlı
- [x] Alarm merkezi v1: liste, Alarm/Arıza sekmeleri, toplu onay, kritik olayda e-posta, kart okuma tetiği
- [x] Kişiler: Excel şablon, içe aktarma, dışa aktarma, toplu kart atama
- [x] İzin + PDKS düzeltme talebi **backend'i** (`leaveRequests`, `attendanceCorrections`: talep, geri çek, onay, red)

### Dalga 2 — önce (yüksek değer)
- [x] **W1 Talepler ekranı (P3b)** — commit `c23926d` 2026-10-20 15:18 (kapı vitest 2356/2356, tsc 0/0, eslint 0, build OK; Claude denetimi P1 yok, düzeltme turu sonrası temiz). YAYIN BEKLİYOR
  - Bulgu: izin talebini onaylayan backend de yok (eski `leaves.approve/reject` C6'da ölü diye silindi) → W1 = backend + UI
  - `/leaves` → "Talepler" sekmesi: bekleyen izin talepleri, onay / red + gerekçe
  - `/pdks-records` → "Düzeltme talepleri" kuyruğu: eski/yeni saat yan yana, onay / red
  - Menüde bekleyen sayısı rozeti
  - Backend hazır. Bugün hiçbir ekran bu fonksiyonları çağırmıyor (yalnız backend var)
- [x] **W2 İşten ayrılma akışı (P4)** — commit `4e2ef07` 2026-10-21 12:09 (kapı vitest 2393/2393, tsc 0/0, eslint 0, build OK; Claude denetimi P1=0, 5 P2 düzeltildi). YAYIN BEKLİYOR. Ek kararlar: son çalışma günü −62/+365 gün; pasif kişi işten çıkarılamaz; ay sonu ayrılış tam ay SGK prim günü; ayrılış nedeni/SGK kodu yalnız yöneticiye
  - Bulgu (kod): employees'ta yalnız `isActive`; ayrılış alanı/cron yok. Ziyaretçide benzeri var: `visitors.expireVisitorAccess` cron + `by_project_visitor_expiry` index.
  - `isActive===true` filtresi ay içinde ayrılanı düşürüyor: `convex/lib/reportAttendance.ts:75,77,84`, `convex/cardReadings.ts:1358,1375` (PDKS detay; Flutter ortak dosya), `convex/sgkExport.ts:75` (aktif VEYA okutması olan).
  - Tasarım: şema employees += `employmentEndDate` (YYYY-MM-DD, son çalışma günü), `terminationType` (istifa/işveren feshi/emeklilik/sözleşme sonu/diğer), `terminationReason` (≤500), `sgkExitCode` (opsiyonel 2 hane), `terminatedAt`, `terminatedBy` + index (isActive, employmentEndDate).
  - Backend YENİ dosya `convex/employeeTermination.ts` (employees.ts'e dokunma): `terminate` (adminMutation; tarih ≤ bugün ise hemen isActive=false + `syncEmployeeToDevicesInternal` + `syncEmployeeToIdePanels`, ileri tarihse cron kapatır), `reinstate` (alanları temizle, isActive=true, sync), audit. Günlük cron 00:05 TR (21:05 UTC) → bitiş tarihi geçmiş aktifleri kapatır.
  - Ortak yardımcı `convex/lib/employment.ts` `employedDuring(emp, start, end)` / `employedOn(emp, date)` → reportAttendance + sgkExport + cardReadings PDKS detayı: dönem içinde ayrılan dahil, bitiş sonrası gün devamsız sayılmaz.
  - UI: EmployeeDetails'e "İşten çıkar" diyaloğu + ayrılmış rozeti + "Geri al"; Kişiler filtresine "Ayrılanlar".
  - Kapsam dışı: işe giriş tarihi alanı, SGK işten ayrılış bildirgesi çıktısı, bekleyen talepleri otomatik iptal.
  - Kişi detayında "İşten çıkar": tarih, tip, neden; o tarihte erişim kapanır, cihazdan silinir
  - Ayrılış sonrası PDKS'te devamsız sayılmaz; "Geri al" (reinstate) kaydı
  - Takip notunu kapatır: bordro `isActive=true` filtresi ay içinde ayrılanı düşürüyor
- [ ] **W3 Yönetici 2FA + kullanıcı dondurma / son kullanma (P6)** · ~6 sa
  - Giriş sonrası e-posta kodu (OTP) — önce tasarım (Convex Auth üstüne), sonra uygulama, güvenlik denetimi şart
  - `/system-admin`: kullanıcıyı dondur / çöz, hesap bitiş tarihi

### Dalga 3 — sonra
- [ ] **W4 Erişim zaman şablonları + yetki durumu ekranı (P5)** · ~8 sa
  - Haftalık 7×24 şablon bir kez tanımlanır, birçok kurala bağlanır
  - Kişi × kapı tablosu: Etkin / Bekliyor / Hata (Hik "Overview" karşılığı); Hik/IDE senkron riski → tasarım + denetim
- [ ] **W5 PDKS kuralları (P7)** · ~8 sa
  - Esnek vardiya (saat serbest, süre sabit)
  - Giriş/çıkış zorunluluğu kuralı (eksik okutma nasıl sayılır) — şu an `pdksCalc` içinde sabit
  - PDKS'e sayılan cihazlar (check point): turnike sayılır, iç kapı sayılmaz
  - Özel dışa aktarma: kolon seçici
- [ ] **W6 Küçükler paketi** · ~4 sa
  - Denetim kaydı Excel dışa aktarma
  - Cihaz çevrimdışı süre/sayı geçmişi (Cihazlar detayında)
  - Vardiyalar: toplu temizle + dışa aktar
  - Kapı durum planı: tek günlük pencere → haftalık plan (şu an `hikDoorStatusPlan` tek aralık)

### Yapılmayacak / ertelenen
Harita, captive portal, video kayıt şablonu, konut, AD eşitleme, firmware yükseltme, araç plakası, özel kişi alanları,
Bluetooth/PIN kimlik, özel rol tanımı, kullanıcı giriş raporu. Geçici PIN/QR geçiş ve QR ile kendi kaydı → ziyaretçi
modülü büyürse tekrar bakılır.

## Kodda doğrulandı (2026-10-20)

| Konu | Durum |
|---|---|
| Talep backend'i | Var (`convex/leaveRequests.ts`, `convex/attendanceCorrections.ts`); `src/` ve `mobile/lib` çağırmıyor |
| Ayrılma alanları | Şemada yok (yalnız `isActive`) |
| Zaman şablonu | Şemada yok; gün-saat kuralın içinde |
| 2FA / dondurma | Şemada yok |
| Esnek vardiya / check point / Attendance Rule | Şemada yok |
| Kapı açık-kalma planı | Kısmen var: Hik kapısında tek günlük pencere (`EditDoorDialog`) |
| Cihaz olayları UI | Alarm sayfasında Alarm/Arıza sekmesi var; ayrı operasyon günlüğü yok |

## Hâlâ doğrulanacak
- Resmi tatilde erişim kuralının davranışı (tatil takvimi kurala bağlı mı)
- Çalışana giden hatırlatma bildiriminin içeriği (`notificationSettings`)
- Raporlarda firma adı/logosu

## Yöntem
- Her paket: Codex worker yazar (`gpt-6.1-sol medium`; W3/W4 tasarımı `gpt-6-astra high`) → Claude denetler → temiz worktree kapısı → commit.
- Yayın her dalga sonunda tek seferde, Emre "yayın onay" ile.
- Şema eklemeleri opsiyonel alan + yeni tablo (geri uyumlu, migration yok).

## Kararlar
- 2026-10-20 Emre: "tek tek devam" → sırayla W1'den başlanır.
- Varsayılan (değiştirilebilir): izin geri çekme = bekleyen talep silinir (backend böyle); çalışan talebi mobilden açılır (mobil ekip P8). Not: mobil uygulama henüz `leaveRequests`/`attendanceCorrections` çağırmıyor → W1 sonrası mobil koordinatöre bildirilecek.

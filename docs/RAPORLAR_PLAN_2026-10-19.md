# Raporlar Modülü — Plan (2026-10-19)

> Kaynak: Hik-Connect rapor kataloğu [hikconnect-reports/README.md](hikconnect-reports/README.md) + mevcut ngsaccess kodu.
> Durum: **Kararlar verildi (2026-10-19)** — K1: 4 grup · K2: 6 temel rapor ilk dalga · K3: resmi raporlar Ayarlar'da kalır.

## Checklist

### Faz 0 — Karar + ön koşul
- [x] Menü şekli: sidebar'da "Raporlar" altında 4 grup (Kayıtlar · Günlük · Aylık · Resmi) + Zamanlanmış
- [x] İlk dalga: 6 temel rapor (Dalga 1)
- [x] Resmi raporlar Ayarlar'da kalır; Raporlar → Resmi grubu oraya link verir
- [ ] Çalışma ağacındaki commit'lenmemiş A2 değişiklikleri (AppSidebar dahil) önce commit'lenir

### Dalga 1 — İskelet + 6 temel rapor (~1,5 gün)
- [ ] `/reports` hub + `/reports/:group` + `/reports/:group/:slug` route'ları (`App.tsx`, `routeMeta.ts`)
- [ ] Sidebar'a açılır "Raporlar" menüsü, 4 grup alt öğe (`SidebarMenuSub`, `AppSidebarNav.tsx`)
- [ ] Grup sayfası: sol/üst ikincil liste ile rapor seçimi (Hik-Connect düzeni)
- [ ] `src/lib/reports/registry.ts`: rapor tanımları (slug, grup, başlık, kolonlar, filtreler, formatlar, veri kaynağı)
- [ ] Generic `ReportPage`: filtre çubuğu + kolon seçici + tablo + `PaginationBar` + export (Excel/CSV/PDF)
- [ ] Zaman presetleri: Bugün · Dün · Bu hafta · Geçen hafta · Bu ay · Geçen ay · Özel (≤31 gün)
- [ ] `computePdksTableRow`'a `lateMinutes` + plan başlangıç/bitiş alanları + testler
- [ ] Ham Okutmalar · Günlük Puantaj · Geç Kalanlar · Devamsızlar · Fazla Mesai · Aylık Durum
- [ ] Resmi grubu: Ayarlar → Raporlar bölümüne link kartları (SGK · Fazla Mesai Özeti · Departman Maliyet)
- [ ] KVKK: biyometrik kaynaklı okutmalar PDKS hesaplı raporlara girmez (KVKK Faz 1 bayrağına bağlı)

### Dalga 2 — Kalan raporlar (~1,5 gün)
- [ ] Günlük: Çalışma Süresi · İlk Giriş/Son Çıkış · İstisnalar · Erken Çıkanlar (`earlyExitMinutes`) · Mola
- [ ] Kayıtlar: Mobil Okutmalar · Günlük Okutma Kartı
- [ ] Aylık: Aylık Çalışma Süresi · Kişi Bazlı Devam · Departman Bazlı Devam · Aylık Puantaj Excel

### Faz 5 — Ayarlar + performans (~1 gün, opsiyonel)
- [ ] Zamanlanmış raporlar (`ReportReminderSettings`) → Raporlar altında
- [ ] Günlük özet aggregate tablosu (B5) — büyük projede ay sorgusu ağırlaşırsa

### Faz 6 — Doğrulama
- [ ] `tsc --noEmit` 0 · `eslint src convex` no-explicit-any 0 · birim testler yeşil
- [ ] Tarayıcı turu: her rapor açılıyor, filtre + export çalışıyor
- [ ] Convex: `npx convex dev --once` (canlı = dev deployment) · commit (Emre onayıyla)

---

## 1. Kararlar (Emre, 2026-10-19)

- **K1 — Menü:** sidebar'da "Raporlar" altında 4 grup (Kayıtlar · Günlük · Aylık · Resmi) + Zamanlanmış;
  grup sayfasında ikincil liste ile rapor seçimi. 20 raporun hepsi sidebar'a konmaz.
- **K2 — İlk dalga:** Ham Okutmalar · Günlük Puantaj · Geç Kalanlar · Devamsızlar · Fazla Mesai · Aylık Durum.
- **K3 — Resmi raporlar:** SGK / Fazla Mesai Özeti / Departman Maliyet Ayarlar'da (`ReportsSettings.tsx`) kalır;
  Raporlar → Resmi grubu link verir.

## 2. Hik-Connect → ngsaccess eşlemesi

| Grup | ngsaccess raporu | Hik karşılığı (id) | Veri kaynağı | Durum |
|---|---|---|---|---|
| Kayıtlar | Ham Okutmalar | Transaction (1) | `cardReadings.listFiltered` | var, sayfaya bağlanacak |
| Kayıtlar | Mobil Okutmalar | Mobile Transaction (9) | `cardReadings` (self check-in) | filtre eklenecek |
| Kayıtlar | Günlük Okutma Kartı | Time Card (18) | `PdksTableRow.detailedLogs` | var |
| Günlük | Günlük Puantaj | Total Time Card (2) | `computePdksTableRow` | plan saatleri eklenecek |
| Günlük | Çalışma Süresi | Worked Hrs (3) | `totalMinutes`, `overtimeMinutes` | var |
| Günlük | İlk Giriş / Son Çıkış | First In Last Out (19) | `firstEntry`, `lastExit` | var |
| Günlük | İstisnalar | Exception (7) | geç + erken + devamsız | dakika alanları eklenecek |
| Günlük | Geç Kalanlar | Late (4) | `isLate` → `lateMinutes` | alan eklenecek |
| Günlük | Erken Çıkanlar | Early Leave (5) | `isEarlyExit` → `earlyExitMinutes` | alan eklenecek |
| Günlük | Devamsızlar | Absent (6) | `status = absent` | var |
| Günlük | Fazla Mesai | Overtime (8) | `overtime*` alanları | var |
| Günlük | Mola | Break (17) | `dashboard.getBreakViolations` | uyarlanacak |
| Aylık | Aylık Durum | Monthly Status (12) | `getMonthlyPayrollSheet` / `days[]` | var |
| Aylık | Aylık Çalışma Süresi | Monthly Worked Hrs (11) | satır toplamı | kolay |
| Aylık | Kişi Bazlı Devam | Person Attendance (13) | gün durum sayıları | kolay |
| Aylık | Departman Bazlı Devam | Department Attendance (14) | departman toplamı | orta |
| Aylık | Aylık Puantaj (Excel) | Overview/Status/Summary (15/16/10) | `PDKSEnhancedExportPanel` | birleştirilecek |
| Resmi | SGK Aylık (APHB) | — | `reports.getSgkMonthlyReport`, `sgkExport` | Ayarlar'da kalır, link |
| Resmi | Fazla Mesai Özeti | — | `reports.getOvertimeSummaryReport` | Ayarlar'da kalır, link |
| Resmi | Departman Maliyet | — | `reports.getDepartmentCostReport` | Ayarlar'da kalır, link |

## 3. Tasarım notları

- **Registry deseni:** Hik-Connect 16 tablo raporunu tek bileşen + sunucu tanımıyla çiziyor. Biz tanımları TS'de
  tutarız (`registry.ts`); kolon tipleri `FunctionReturnType` ile bağlanır, `any` yok.
- **Plan / gerçek ayrımı:** her günlük satırda vardiya plan saatleri ve gerçek okutma birlikte gösterilir (Hik'te `checkIn*`/`clockIn*`).
- **Kota:** `getPdksTableData` dönemdeki tüm okutmaları topluyor; aralık ≤31 gün sınırı + aylık raporlar için
  gerekirse Faz 5 aggregate. Convex Free kotası daha önce aşıldı (bkz. memory: poll kota olayları).
- **KVKK 2026/921:** biyometrik olaylardan puantaj üretilmez; Ham Okutmalar'da kaynak/doğrulama tipi gösterilir,
  PDKS hesaplı raporlar biyometrik okutmayı saymaz (KVKK Faz 1 ile birlikte).
- **Yürütme:** Faz 1-4 Codex K2 worker'lar (dosya sahipliği ayrık), denetim Claude worker; commit/deploy koordinatörden.

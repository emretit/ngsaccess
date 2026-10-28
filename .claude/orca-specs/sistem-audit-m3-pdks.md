# SİSTEM AUDIT — M3 PDKS, VARDİYA, İZİN/TALEP, RAPOR, ANA SAYFA

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/sistem-audit-ortak.md` dosyasını OKU; oradaki kurallar (YASAK listesi dahil) bağlayıcı.

**Rapor:** `docs/sistem-audit-2026-10-25/M3-pdks.md` (yalnız bu dosyayı yazabilirsin). Bulgu ID öneki `P-`.

## Kapsam
- Backend: `convex/{pdksRecords,pdksRules,shifts,shiftPlans,holidays,leaves,leaveRequests,attendanceCorrections,reports,sgkExport,dashboard}.ts`,
  `convex/actions/{pdksImport,sendScheduledReports}.ts`,
  `convex/lib/{pdks*,shift*,leave*,overtime*,breakDeduction,sgk*,report*,dashboard*,workingDays,trDate,turkishHolidays,legacyOvertime,requestRules,payVisibility}.ts`.
- Web: `src/components/{pdks,shifts,leaves,reports,dashboard}/**`, `src/pages/{PDKSRecords,PdksSettings,Leaves,Reports,Index}.tsx`,
  `src/hooks/{usePdks*,useDashboard}*`, `src/lib/{pdks*,shiftExport,spreadsheet*,reports/**}`.
- Eski audit: `docs/genel-akis-audit/B-pdks-rapor.md` (tamamı) + OZET Faz 3-4.
- Son işler (2026-10-23/24, kodda doğrula): vardiyalar PDKS içinde filtre ağacı + plan Sheet (e0205881), sabit vardiya kuralları
  (8f57a2d9), vardiya planı departman ataması/rotasyon/çok vardiyalı gün (26e5570b, 520ba5fc), PDKS ayarları sayfası.
  Mobil talepler backend'i commit'siz WIP (leaveRequests/attendanceCorrections/requestRules) — "(commit'siz WIP)" işaretle.

## Özellikle bak
- Gün hesabı: vardiya çözümleme önceliği (kişi atama vs departman planı vs rotasyon), gece vardiyası, çok vardiyalı gün,
  tatil/hafta tatili/izin çakışması, mola düşme, fazla mesai (haftalık 45 sa), geç/erken eşikleri, eksik okutma.
- Aynı puantajın farklı yerlerde (PDKS tablo, detay, raporlar, SGK, dashboard, mobil özet, bordro/ücret) FARKLI hesaplanması.
- Manuel düzeltme / talep onayı → hesap; denetim izi.
- Saat dilimi (UTC+3) ve gün sınırı; tarih aralığı filtrelerinde off-by-one.
- Kota/performans: rapor ve tablo sorgularında `.collect()`, ay × kişi döngüleri, Convex Free limitleri.
- Ücret görünürlüğü (project_user → null) tüm çıkışlarda (export dahil) tutarlı mı.

## İlişkiler (bölüm 4'te mutlaka işle)
M2 (kart olayları: kaynak, yön, okuyucu/kontrol noktası, biyometrik filtre), M1 (çalışan durumu, departman, işten çıkış tarihi),
M4 (rol/yetki, ayarlar, denetim logu, zamanlanmış e-posta raporu), M5 (mobil özet/geçmiş, izin+düzeltme talepleri).

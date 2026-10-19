# Dalga 2b — ADM-0F: Raporlar proje kapsamı + Devam Özeti doğruluğu (PDKS motorunu yeniden kullan)

**Hedef:** Rapor ekranı ve zamanlanmış raporlar aktif projeyi (veya açık "tüm erişilebilir projeler" seçimini) sunucu kimliğiyle doğrulanmış kapsamla üretir ve dosya başlığında bu kapsamı yazar; Devam Özeti tüm aktif personeli (sıfır okumalı dahil) içerir, devamsızlığı yalnız tamamlanmış ve çalışılması beklenen günler üzerinden PDKS'nin mevcut hesap fonksiyonlarıyla hesaplar.

(Ortak kurallar aşağıda; modül raporu: `docs/ux-audit/04_AYARLAR_ADMIN.md` §3 ADM-12/41 + §5. PDKS bağlamı: `docs/PDKS_AUDIT_VE_PLAN_2026-10-16.md` — Faz 2 "tek hesap motoru" sonra gelecek; bu görevde paralel hesap YAZMA, mevcut `convex/lib/pdks*.ts` fonksiyonlarını kullan.)

## Bulgular
1. **ADM-12 (🟠)** — `ReportsSettings.tsx` tüm `projectIds`'i yolluyor; `reports.ts` istemciden gelen `isSuperAdmin` + proje dizisine göre dallanıyor.
   - Tüm rapor query'leri (`getSgkMonthlyReport`, `getOvertimeSummaryReport`, `getAttendanceSummaryReport`, `getDepartmentCostReport`) `projectId?: Id<"projects">` alır → `resolveProjectScope`; rol `ctx.user.role`'dan. Eski `projectIds`/`isSuperAdmin` arg'larını kaldır (tek çağıran `ReportsSettings.tsx`, senin).
   - UI: varsayılan aktif proje; birden fazla izinli projesi olana açık "Tüm erişilebilir projeler" seçimi; seçili kapsam ekranda ve indirilen dosyanın başlığında/adında yazar.
   - Zamanlanmış raporlar (`getReportSchedule`, `saveReportSchedule`, `getEnabledSchedules`, `getReportSummaryForEmail`, `triggerScheduledReports`): kapsam = zamanlamanın `projectId`'si; e-posta özeti aynı kapsamı yazar. Kayıt yetkisi mevcut rol matrisine uysun (proje yöneticisi rapor ayarlayabilir — `convex/lib/capabilities.ts`'e bak, değiştirme).
2. **ADM-41 (🔴)** — `getAttendanceSummaryReport` satırları okumalardan kuruyor (hiç okutmayan personel görünmüyor), `workDaysInMonth = lastDay` takvim günü, gelecekteki günler paydada.
   - Satır kümesi: kapsamdaki aktif, ziyaretçi olmayan personel (sıfır okumalı dahil).
   - Payda: yalnız tamamlanmış günler (bugünden önce, TR günü — `convex/lib/trDate.ts`) ∩ çalışılması beklenen günler (vardiya ataması / çalışma ayarı hafta tatili / resmi tatil — `turkishHolidays.ts` + tatil takvimi tablosu; PDKS tablosu bunu nasıl yapıyorsa AYNI yardımcıları kullan: `pdksTable.ts`, `pdksCalc.ts`, `pdksPayroll.ts`, `pdksHelpers.ts`). İzin günleri devamsızlık değil.
   - PDKS yardımcıları rapor için doğrudan çağrılamayacak kadar ekran-özelse: kendi `convex/lib/reportAttendance.ts` içinde SADECE birleştirici (adapter) yaz, gün sınıflandırmasını PDKS fonksiyonlarına bırak; aynı ay için PDKS tablosu ile rapor sayıları tutarlı olmalı → bunu test et (küçük fixture: 1 personel sıfır okuma, 1 personel tatil + hafta sonu, ay ortası "bugün").
   - Doğrulanamayan kısım (ör. ay ortası işe giriş — `hireDate` alanı yok) için rapor ekranında ve dosyada açık "güvenilirlik sınırı" notu.
   - Diğer raporlar (`getOvertimeSummaryReport`, `getDepartmentCostReport`) aynı "okumalardan satır kurma / takvim günü" hatasını taşıyorsa aynı adapter'la düzelt veya raporla (kapsam büyürse yalnız raporla).

## Ownership (yalnız bunlara yaz)
convex/reports.ts · convex/lib/reportAttendance*.ts / convex/lib/reportScope*.ts (yeni) · src/components/settings/sections/ReportsSettings.tsx (+ aynı klasörde yeni rapor alt bileşenleri `src/components/settings/sections/reports/**`)
`convex/lib/pdks*.ts`, `convex/lib/trDate.ts`, `convex/lib/turkishHolidays.ts`, `convex/sgkExport.ts`, `convex/lib/sgk*.ts` → YALNIZ OKU; değişiklik gerekiyorsa `ask`.

## Kapsam dışı
PDKS ekranları ve `convex/cardReadings.ts` · SGK dışa aktarım mantığı · auditLog / admin paneli (ADM-denetim worker) · schema.ts (koordinatör) · Dalga 3 tasarım göçü.

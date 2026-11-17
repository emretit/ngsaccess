# Denetim — PDKS Faz A-D (salt okuma)

## Hedef
HEAD 592355fa üzerindeki çalışma ağacı değişikliklerini (git diff + yeni dosyalar) doğruluk ve güvenlik açısından denetle; yalnız GERÇEK hataları raporla.

## Kapsam (dosyalar)
- Faz A mola: convex/lib/pdksDay.ts (+ pdksBreakRule/BreakFixes/Day.audit/NightFixes/PunchPairs testleri)
- Faz B: convex/dashboard.ts, convex/dashboardAnnualOvertime.test.ts
- Faz C: convex/dataMigrations.ts, convex/lib/pdksRuleWrite.ts, convex/pdksRules.ts, convex/pdksRequirementsSwitch.test.ts
- Faz D: convex/schema.ts, convex/payrollPeriods.ts (+test), convex/lib/pdksPayrollQuery.ts, convex/lib/pdksManualWrite.ts, convex/lib/adminGuards.ts, convex/lib/auditLogQuery.ts, src/components/audit/auditLabels.ts, src/components/pdks/records/{MonthlyPayrollView,PayrollPeriodPanel,PdksRecordsResults}.tsx

## Emre kararları (doğru kabul et, bunlara itiraz bulgu değildir)
- Mola düzeltmesi geçmiş tüm dönemlere. Tanımlı mola: pencere ∩ içeride (eachPunch) / pencere ∩ [ilk,son] (legacy ilk-son, ara okutma yok sayılır). Tanımsız: yasal mola (≤4 sa 15, 4–7,5 sa 30, >7,5 sa 60), eachPunch'ta max(0, yasal − dışarıda). Eksik günde mola 0.
- C: legacy projeler 2026-11-18'den requirements'a; geçmiş sürümler değişmez.
- D: dönemi proje admin kapatır, YALNIZ super_admin yeniden açar; kapalı aya manuel düzeltme reddedilir; sonraki okutmalar fark listesine.

## Özellikle bak
1. D yetki: closePayrollPeriod proje sınırı (başka projenin dönemi kapatılabilir mi?), reopen gerçekten yalnız super_admin mi, fark listesi/snapshot okuma yetkisi ve ücret maskeleme (project_user ücret görmemeli — reports_module ücret gizleme kuralı).
2. D tutarlılık: scheduler batch'li kapanışta yarım kalan kapanış (status/satır sayısı), reopen sonrası tekrar kapanış, 10000 satır üst sınırı, Convex işlem limitleri.
3. A: gece vardiyası/çok parça, esnek duration yolu, saniye hassasiyeti; legacy anlamı korunmuş mu.
4. B: dashboard sorgu maliyeti (N+1 yok mu, take sınırları).
5. C migration idempotent mi, checkpoint seçimleri gerçekten kopyalanıyor mu, actorUserId doğrulaması.

## Kurallar
Salt okuma: dosya düzenleme, git add/commit/stash/checkout, convex run/deploy, DB yazma YOK. Tam vitest KOŞMA (makine yükü yüksek); gerekirse yalnız tek hedefli test dosyası.
Supabase MCP kullanma.

## Rapor (worker_done, ≤15 satır)
Her bulgu: önem (high/medium/low) · file:line · bir cümle hata · somut senaryo. Bulgu yoksa "bulgu yok" + neye baktığını 2 satırda yaz.

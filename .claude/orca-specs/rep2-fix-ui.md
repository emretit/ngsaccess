# Raporlar D2 — düzeltme turu (FRONTEND)
Kurallar: `.claude/orca-specs/rep1-common.md` + `rep2-ui.md` (Ownership aynı: `src/lib/reports/**` (groups.ts hariç), `src/components/reports/**`, `src/pages/Reports.tsx`).
Denetim: `.claude/orca-specs/reports/review-rep2.md` (bulgu no'ları oradan). Backend düzeltme worker'ı AYNI ANDA çalışıyor (`rep2-fix-api.md`).

**Hedef:** #1 (UI), #2, #3, #6, #7 düzelir + Okutma Kartı / Mola raporları `includePunches: true` gönderir; testler eklenir; D1 raporları değişmez.

## Düzeltmeler
1. **#1 UI:** transactions raporlarında `!isDone && rows.length === 0` iken EmptyState ("eşleşen kayıt yok") YERİNE: "Taranan kayıtlarda eşleşme yok. Daha eski kayıtlar için “Daha fazla yükle”."
   + yükle düğmesi görünür. `isDone && rows.length === 0` → mevcut EmptyState.
2. **#2:** geç/erken bayrakları yalnız iş gününde sayılır: günlükte `cell.detail?.dayType === "workday"` (detail yoksa sayma), aylıkta `cell.classification === "workday"`.
   Uygula: Geç Kalanlar (D1 — davranış düzeltmesi, kabul), Erken Çıkanlar, İstisnalar (geç/erken kısmı; devamsız aynen), Kişi/Departman "Geç/Erken çıkış (gün)". Aylık Durum `totals.lateDays` (sunucu) dokunma.
3. **#3:** Kişi/Departman Bazlı Devam: "Çalışılan gün" = iş günü katılımı (`payrollCode` "N" — kodları `convex/lib/pdksPayroll.ts`'ten DOĞRULA; geç gelen günün kodu ne, onu da kapsa).
   Hafta tatili / resmî tatilde çalışma (`classification` weekend|holiday + `totalMinutes > 0`) ayrı kolon "Tatilde çalışma (gün)". İzinli gün yalnız İzinli'de. Devam oranı = çalışılan / (çalışılan + devamsız).
   Test: 22 iş günü (2 DV) + 4 cumartesi çalışması → %90,9 (20/22); izinli+okutma çift sayılmaz; tek okutmalı N günü çalışılan sayılır.
4. **#6:** okutma metni `readingCount > punches.length` ise sonuna "· +N okutma daha".
5. **#7:** `transactionSources` olan raporda (Mobil Okutmalar) biyometrik gizli sayaç satırı gösterilmez (KVKK genel notu kalır).
6. **#8 bağlantısı:** `dailyReportArgs` Okutma Kartı ve Mola İhlalleri için `includePunches: true` ekler (tanımda bayrak, ör. `includePunches?: boolean`); key'e girer (sunucu argümanı).
   Diğer günlük raporlar göndermez. Backend arg'ı henüz yoksa (`grep -n includePunches convex/cardReadings.ts`) tsc kırmızı olur — önce diğer maddeleri yap, en son bağla.

## Kapılar
app tsc 0 · convex tsc 0 · eslint kendi dosyaların 0 · `node_modules/.bin/vitest run src/lib/reports src/components/reports` · `git diff --check`.
YASAK: commit/push/deploy, `npx convex`, DB. Rapor: `.claude/orca-specs/reports/rep2-fix-ui.md` + `worker_done` ≤10 satır.

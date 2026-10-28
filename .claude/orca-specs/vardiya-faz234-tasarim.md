# Vardiya Faz 2-4 — birleşik planlama modeli TASARIMI (salt okuma, K3)

Çalışma dizini /Users/emreaydin/ngsaccess. **Kod dosyalarına YAZMA**; yalnız kendi tasarım dosyana yaz (spec sonunda).
`git` yazma komutu, `npx convex`, DB erişimi YOK.

## Bağlam
Hikvision modeli: Timetable (saat) → Shift (tekrar deseni, günde ≤8 timetable) → Schedule (kişi/departman/grup ataması, geçici vardiya).
Kıyas: `docs/hikconnect-audit/PDKS_KIYAS.md` §2.3. Plan: `.claude/plan-vardiya-hik.md`.
Bizde: `shifts` (sabit/esnek), `shiftAssignments` (kişi + tarih aralığı + haftalık gün deseni `weekPattern`), `employees.shiftId` varsayılan.
Çözüm: `convex/lib/shiftResolver.ts` (en son güncellenen uyan atama → kişi varsayılanı → null = proje saatleri); gün hesabı
`convex/lib/pdksDay.ts`, `pdksWorkDay.ts`, `pdksPunchPairs.ts`, `pdksFlexible.ts`, `pdksPayroll.ts`, `pdksTable.ts`, `reportAttendance.ts`.
Atama: `convex/shifts.ts` (`bulkAssignShift`, `previewBulkAssign`, `listAssignments`, `updateAssignment`, `removeAssignment`, `clearAssignments`),
`convex/lib/shiftAssign.ts`; UI `src/components/shifts/AssignShiftDialog.tsx`, `calendar/**`, `ShiftTree.tsx`, `ShiftPlanSheet.tsx`.
Departmanlar ağaç: `departments.parentId`, kişide `departmentId`.

**Paralelde Faz 1 uygulanıyor** (sen etkilemezsin, uyumlu tasarla): sabit vardiyaya opsiyonel `validWindow`, `absentAfterLateMinutes`,
`minWorkMinutes`, `missingCheckInLateMinutes`, `holidayWorkRequired` alanları + `pdksDay` hesabı (`.claude/orca-specs/vardiya-faz1-kurallar.md`).

## İstenen (Emre kararları)
- **Faz 2 — Departman ataması:** atama hedefi kişi YA DA departman; alt departmanlar üstün atamasını miras alır, en yakın departman kazanır.
  Öncelik: kişi ataması > departman ataması > kişi varsayılanı (`employees.shiftId`) > proje saatleri. Departmana yeni giren kişi otomatik alır.
- **Faz 3 — Rotasyon:** haftalık gün deseni (mevcut) + N günlük döngü + N haftalık döngü (slot başına vardiya ya da boş gün),
  ör. "2 sabah · 2 akşam · 2 boş".
- **Faz 4 — Günde birden çok vardiya:** bir kişiye aynı gün birden çok vardiya ("istediğimiz kadar"; makul üst sınır öner, Hik 8).
  Okutmaların vardiyalara bölüştürülmesi, günlük durum birleştirme (geç/devamsız/eksik), fazla mesai, gece vardiyası, esnek ile karışım, mola.
- Pencere dışı okutma = "incelenecek" (Faz 1 ile aynı).

## Teslim — tasarım dosyası
1. **Veri modeli:** Convex şema kodu (validator'lar dahil), mevcut `shiftAssignments` + `employees.shiftId` ile geri uyumluluk;
   widen → migrate → narrow adımları (gerekiyorsa `@convex-dev/migrations`), backfill gerekip gerekmediği.
2. **Çözümleme algoritması:** `resolve(employee, date) → Shift[]` (sıralı), öncelik, çakışma, döngü hesabı; Convex okuma sınırları
   (bounded reads, index'ler), `pdksTable` geniş aralık performansı.
3. **Hesap motoru:** çoklu vardiya için gün hesabı değişiklikleri — file:line ile; mevcut tek vardiyalı sonuçlar BİREBİR aynı kalmalı.
4. **Arayüz:** atama diyaloğu (kişi/departman, desen türü, çoklu vardiya), takvim hücresi, PDKS tablosu/gün detayı gösterimi.
5. **Mobil etkisi:** `mobile/` (Flutter) vardiya/atama okuyor mu? Hangi API'ler bozulur, nasıl korunur (grep ile kanıtla).
6. **Uygulama paketleri:** ≤3 iş paketi, her birinde dosya ownership'i (iki paket aynı dosyaya yazmaz), sıra/bağımlılık, tahmini süre.
7. **Test planı** ve **riskler** (en fazla 5, her biri 1 cümle + önlem).

Kısa ve somut yaz: kod parçaları, file:line, tablo. Uzun düzyazı yok.

## Rapor
Tasarım dosyası yolu worker'a özel (başlatma mesajında). `worker_done` ≤10 satır: dosya yolu + en kritik 3 karar + açık sorular.

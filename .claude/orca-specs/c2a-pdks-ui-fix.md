# C2a 08 PDKS frontend denetim düzeltmeleri + toplu içe aktarma gerekçesi
Önce `.claude/orca-specs/c2-common.md` ve `.claude/orca-specs/c2a-pdks-ui.md` oku (ownership aynı: src/pages/PDKSRecords.tsx · src/components/pdks/** ·
src/hooks/usePdks*.ts · src/lib/pdks*.ts · src/utils/pdksExport.ts). Claude denetimi bulguları — hepsini düzelt:
1. YÜKSEK `src/hooks/usePdksFilterParams.ts:67` + `src/pages/PDKSRecords.tsx:71`: proje değişince URL'deki departmentId/companyId/positionId/shiftId (ve kişi
   seçimi) kalıyor → eski projenin ID'si yeni projeye gidiyor. projectId değişince bu paramları URL'den sil (tarih/dönem/reportType korunur); ilk yüklemede
   (önceki proje yokken) silme. Saf yardımcı + vitest.
2. ORTA `PDKSTableView.tsx:~150`, `PDKSMobileCardList.tsx:~58`: future/noData satırlarda süre "00 sa 00 dk" → "—" (puantaj gibi).
3. ORTA `PDKSEmployeeDetailDrawer.tsx:~170`: "Manuel düzelt" future günde GİZLİ; noData'da açık ama süreler "—".
4. DÜŞÜK ölü dosyalar (önce `grep -rn` ile import eden olmadığını doğrula, sonra sil): PDKSSummaryCards, PDKSLateBoxplot, PDKSCalendarHeatmap, PDKSMobileDrawer,
   PDKSActiveFilterChips (src/components/pdks/dashboard/), usePdksStats, usePdksAi (src/hooks/). Kullanılan çıkarsa silme, raporla.
5. DÜŞÜK `ManualPdksEditDialog.tsx` aria-describedby hata yokken var olmayan id'yi göstermesin; `PDKSTableView` kullanılmayan editDate/selectedDate prop'ları
   kaldır; rangeError sheet kapanınca temizlensin.
6. **Toplu içe aktarma** `PDKSImportDialog.tsx:25`: paralel backend worker'ı `convex/pdksRecords.ts` `bulkUpsertManual`'a batch düzeyinde ZORUNLU `note`
   (gerekçe, trim 3–500) + satır bazlı sonuç (iki boş saatli satır hata) ekliyor. `convex/pdksRecords.ts`'i oku: değişiklik varsa diyaloğa zorunlu "Gerekçe"
   alanı (alan altı hata, backend sınırıyla aynı) + satır bazlı sonuç listesi (başarılı/hatalı satır, hata metni) ekle. Henüz değişmediyse bu maddeyi EN SONA
   bırak, 10 dk sonra tekrar bak; hâlâ yoksa worker_done'da "6 bekliyor" yaz. convex/** DÜZENLEME.
## Kapılar
app tsc · eslint src convex · npx vitest run (convex/lib/pdks*/reportAttendance testleri backend worker'ında — onların kırığını sayma, raporda ayır) · npx vite build.
commit/push/deploy YOK. worker_done ≤6 satır.

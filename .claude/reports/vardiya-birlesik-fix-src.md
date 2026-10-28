# Vardiya birleşik denetim — src düzeltmeleri

- Önemli-1 kapandı — `src/components/pdks/dashboard/PDKSHeatmapView.tsx:85`: rest override kaldırıldı; renk/kod sunucunun durumundan, plan özeti ayrı rozetten gelir; present/rest ve weekend/rest testleri `src/components/pdks/dashboard/shiftPlans.test.tsx:91`.
- Düşük-1 kapandı — `src/components/pdks/lib/presentation.ts:10` ve `:39`, `src/components/pdks/dashboard/PdksDaySegments.tsx:11`: gün durumu tipte zorunlu; absent parça future gününde Bekleniyor, leave/holiday/weekend gününde nötr —; çalışma gününün Gelmedi ve kesin Geldi/İncelenecek kararları korunur.
- Düşük-2 kapandı — `src/components/shifts/calendar/shiftCalendarModel.ts:36`, `src/components/shifts/lib/planning.ts:187` ve `:215`: gece kuyruğu önceki sunucu hücresinin shiftIds listesinden türetilir; kişisel kayıt yapısı aynı kalır; `calendar/calendarActions.ts:13` ve `ShiftDayDetails.tsx:68` devam hücresini ayrıntıya açar, departman kaynağını düzenletebilir; departman/varsayılan 22–06 ve gündüz/esnek negatif testleri `src/components/shifts/assignmentPlans.test.tsx:288`.

Kapılar: `tsc --noEmit -p tsconfig.app.json` exit 0; `eslint src` exit 0 (uyarı yok); `vitest run src` exit 0, 190 dosya / 1244 test; hedefli 2 dosya / 43 test başarılı.
10 yeni test senaryosu eklendi; mevcut test beklentileri değiştirilmedi veya silinmedi.
Convex dosyalarına ve ortak review dosyasına dokunulmadı; geçici backend hatası görülmedi; açık soru yok.

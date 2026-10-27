# Input border audit — özet (2026-10-27)

3 Codex worker (gpt-6.1-sol medium), salt okuma. **88 bulgu: Y8 / O78 / D2.** Ayrıntı: W1/W2/W3 raporları.
Kapı: `src/` + `convex/` değişmedi (git status md5 aynı), yeni commit yok.

## Kök sebepler (tek düzeltme → çok yer)

| # | Kök sebep | Etki | Düzeltme | Süre |
|---|---|---|---|---|
| 1 | `src/components/shared/FormDialog.tsx:91` `overflow-y-auto`, padding yok → focus ring yanlardan kesik | **Y** — 8 dialog: VisitorZone, AddZone, AssignLocation, ProjectEditor, ManualPdksEdit, AddDepartment, Company, MoveDepartment | scroll gövdesine `-mx-1 px-1` (offset-2 için `-mx-2 px-2`) | ~5 dk |
| 2 | Yerel scroll ataları padding'siz | **Y** `src/pages/Settings.tsx:58` (Kullanıcılar arama/filtre) · O `live-monitoring/ReadingDetailPanel.tsx:36` | aynı padding payı | ~5 dk |
| 3 | Primitive'lerde hata border'ı yok (`aria-invalid` var ama border kırmızı olmuyor) | O — ~45 alan (E kategorisi, 3 alan) | `ui/input`, `textarea`, `select`, `date-picker` tetikleyicisine `aria-[invalid=true]:border-destructive`; ~8 tüketici aria-invalid'i hiç geçirmiyor (W1 #16-20, W2 #17/#18/#34/#35, W3 #14/#21/#28) | ~15 dk + ~30 dk |
| 4 | Ham `<select>` ~20 yerde, her biri farklı stil (h-9/10/11, bg-background/surface, outline vs ring, focus yok) | O | ortak `nativeSelectClass` (ya da SelectTrigger) — AdminListParts tek noktadan 3 listeyi düzeltir | ~1-1.5 sa |
| 5 | Primitive tutarsızlığı: Select `focus:ring-offset-2` (Input offset-0), Textarea `bg-background`, CommandInput'ta focus göstergesi yok, date-picker text-xs + offset-2 | O/D | primitive'leri tek focus/bg sözleşmesine bağla | ~15 dk |

## Öneri sırası
1. Dalga 1 (Y'lerin hepsi, ~10 dk): #1 + #2
2. Dalga 2 (~45 dk): #3 + #5
3. Dalga 3 (~1.5 sa): #4

## Düzeltme durumu (2026-10-27 11:55)
- Dalga 1-3 + denetim düzeltmeleri BİTTİ; kapılar: tsc 0, eslint 0 error, vitest 439 dosya / 5030 test yeşil.
- Tarayıcı kontrolü (Orca, /visitors → Erişim bölgesi oluştur): ring 4 kenarda tam (4px pay), boş adla kaydet → kırmızı border + mesaj.
- Commit pathspec: .claude/pathspec-input-audit.txt (50 satır). Commit/yayın yok.
- 13:55: ertelenen 4 bulgu da kapandı (W1 #17/#18/#19/#24; yeni `invalidTimeField` + test). **88/88 bitti.** Kapılar: tsc 0, eslint 0 error, vitest 439/5031. Codex denetimi temiz.
- DİKKAT: DoorPlanDialog.tsx, TimeSchedule.tsx, TemplateEditor.tsx hem bu pathspec'te hem .claude/pathspec-gk-dalga1.txt'te; önce commit'lenen paket iki işin değişikliğini birlikte götürür.

# Vardiya Paket C2 — PDKS tablo/gün detayında çoklu vardiya ve planlı dinlenme gösterimi (aynı C1 worker'ı)

## Hedef (test edilebilir)
PDKS tablosu, ısı haritası, mobil kart listesi ve kişi gün detayı; B'nin opsiyonel `segments` (≥2 vardiyalı gün) ve `planKind: "rest"` (döngüde boş gün) alanlarını gösterir.
Bu alanlar yokken her ekran bugünküyle birebir aynı (mevcut testler değişmeden geçer).

## Önce oku
1. `.claude/design/vardiya-model.md` (OTORİTER) + `.claude/design/vardiya-model-claude.md` §4.3.
2. B çıktısı (çalışma ağacında, commit'siz): `convex/lib/pdksMultiShift.ts:12-26` (`PdksSegment`, `pdksSegmentValidator`, `PlannedDay`, `plannedDayFields`),
   `.claude/vardiya-paketB-report.md` (hangi query'ler `segments`/`planKind` döndürüyor: tablo `pdksTable`, detay `pdksDetail`/`cardReadings`, bordro `pdksPayroll`).
3. Proje `CLAUDE.md`: Convex sonuçları `FunctionReturnType<typeof api.X.Y>` ile tiplenir; `any`/`!` yok.

## Yapılacaklar
1. Tablo hücresi (`src/components/pdks/dashboard/PDKSTableView.tsx`, `PDKSHeatmapView.tsx`, `PDKSMobileCardList.tsx`): `segments` varsa vardiya adı `"Sabah + Akşam"` (parça adları ` + ` ile),
   giriş/çıkış = ilk/son parça, küçük "2 vardiya" rozeti (N vardiya). Karışık karar mevcut "İncelenecek" durumuyla görünür (yeni durum YOK, `statusMeta.ts` değişmez).
2. Gün detayı (`PDKSEmployeeDetailDrawer.tsx` ve ilgili alt bileşenler): `segments` varsa parça başına satır: plan saatleri (plannedStart–plannedEnd) · giriş/çıkış ·
   net süre · geç/erken · parça durumu (Geldi / Gelmedi / İncelenecek). Altında tek satır not: "Manuel düzeltme girişi ilk vardiyaya, çıkışı son vardiyaya uygulanır."
3. `planKind === "rest"`: hücre ve detayda "Boş gün (döngü)" etiketi (hafta sonu görünümüyle aynı ton, yeni renk yok).
4. Sunum yardımcıları gerekiyorsa `src/components/pdks/lib/presentation.ts` içinde (saf fonksiyon + test).
5. Dışa aktarma (`src/components/pdks/dashboard/export/**`, `src/utils/pdksExport.ts`): vardiya adı sütunu çoklu günde `"Sabah + Akşam"`; başka sütun EKLEME.

## Kapsam dışı (DOKUNMA)
`convex/**` (B denetimi paralel çalışıyor; DTO'da eksik görürsen `ask` ile sor) · `src/components/shifts/**` (C1 kabul edildi) · `mobile/**` · yayın.

## Ownership
`src/components/pdks/dashboard/**`, `src/components/pdks/lib/presentation.ts`, `src/utils/pdksExport.ts`, ilgili `src/hooks/usePdks*.ts` (yalnız tip geçişi gerekiyorsa), bunların testleri.

## Kurallar
- Mevcut A2 bileşen dili; yeni renk/tema yok; kısa Türkçe metin. Rozet/etiket yalnız renkle anlam taşımaz (metin var).
- TypeScript strict; `any` / `as any` / `!` YOK.
- **YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git restore`, `git worktree`; `npx convex`**. Dev server açma. Yayın YOK.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint src
node_modules/.bin/vitest run src
```
Yeni testler (en az): 2 parçalı gün hücre metni + rozet; detayda parça satırları ve durumları; rest günü etiketi; `segments`/`planKind` yokken hücre ve detay çıktısı DEĞİŞMEDİ;
dışa aktarmada çoklu gün vardiya adı.

## Rapor
`worker_done` ≤10 satır: değişen/yeni dosyalar (file:line), kapı sonuçları (test sayısı), açık sorular.

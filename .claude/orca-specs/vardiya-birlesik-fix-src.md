# Vardiya birleşik denetim — src düzeltmesi (aynı C worker)

## Hedef
`.claude/review-vardiya-birlesik.md` src bulguları kapanır: Önemli 1 + Düşük 1, 2.

## Kararlar (koordinatör)
1. **Önemli-1** `src/components/pdks/dashboard/PDKSHeatmapView.tsx:85`: `planKind === "rest" ? STATUS_META.weekend : ...` override'ını SİL; sunucu durumu (`statusMetaFor(cell)`) esas.
   Test: `planKind:"rest"` + `status:"present"` hücre hafta tatili kodu/rengi BASMAZ; `planKind:"rest"` + `status:"weekend"` → hafta tatili.
2. **Düşük-1** `PdksDaySegments.tsx:13` "Gelmedi" etiketi: `PdksPlanDay` (`src/components/pdks/lib/presentation.ts:10`) Pick'ine `status` ekle; gün `future` / `leave` / `holiday` / `weekend`
   ise kararsız parça "Gelmedi" değil "—" gösterir (gelecek gün için "Bekleniyor"). Çağıranlar `status`'u zaten hücreden geçiriyor olmalı; geçmiyorsa ekle. Test.
3. **Düşük-2** `src/components/shifts/calendar/shiftCalendarModel.ts:35`: gece vardiyasının ertesi gün "(devam)" kuyruğu kaynak fark etmeksizin (kişisel / departman / varsayılan)
   önceki hücrenin `shiftIds`'inden türetilsin. Kişisel atamada bugünkü sonuç birebir. Test: departman kaynaklı 22:00-06:00 → ertesi gün devam görünür.

## Ownership
`src/**` yalnız. `convex/**` (A/B worker paralel çalışıyor) ve `convex/_generated/**` DOKUNMA. Sunucu DTO'sunda alan eksikse DUR, raporla.

## Kurallar
- **YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git restore`, `git worktree`; `npx convex`**. Dev server başlatma.
- TypeScript strict; `any` / `as any` / `!` YOK. Mevcut test beklentisini değiştirme/silme (gerekiyorsa DUR, sor).
- convex'ten gelen geçici tsc/test hatasını DÜZELTME, raporda belirt.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint src
node_modules/.bin/vitest run src
```

## Rapor
`.claude/reports/vardiya-birlesik-fix-src.md` (YENİ dosya; review dosyasına convex worker yazıyor, ona DOKUNMA) — her bulguya 1 satır (file:line). `worker_done` ≤10 satır: file:line + kapı sonuçları.

# Vardiya Orca turu — src görsel düzeltmesi (aynı C worker)

## Hedef
Canlı Orca turunda (NGS, 2 vardiyalı departman ataması) görülen 3 görsel sorun kapanır. Yalnız `src/**`.

## Bulgular + kararlar
1. **Isı haritası hücresi uzuyor** — `src/components/pdks/dashboard/PDKSHeatmapView.tsx:110` hücreye `PdksPlanSummary` tam vardiya adlarını
   ("TEST Sabah (silinecek) + TEST Öğle (silinecek)") basıyor; haftalık/aylık görünümde 72 px genişlikteki hücre 157 px yüksekliğe çıkıyor, satır 4 kat uzuyor.
   Karar: ısı haritası hücresinde YALNIZ kısa rozet ("2 vardiya" / "Boş gün"); tam adlar hücrenin `title`'ında (ve `aria-label`'ında) kalsın.
   `PdksPlanSummary`'ye `compact` prop'u ekle (detay çekmecesi ve tablo bugünkü gibi tam ad göstermeye devam eder). Hücre yüksekliği plansız hücreyle aynı satır düzeninde kalmalı.
2. **Okutma yokken "—–—"** — `segmentTimeRange` (`src/components/pdks/lib/presentation.ts`) ve segmentin "Gerçekleşen" satırı (`PdksDaySegments.tsx`) giriş ve çıkış
   ikisi de yokken "—–—" yazıyor. Karar: ikisi de yoksa tek "—"; biri varsa "08:01–—" biçimi kalır. Isı haritası hücresinde ikisi de yoksa satırı hiç basma.
3. **Düzenleme başlığı yalnız ilk vardiyayı yazıyor** — "Tüm atama serisini düzenle" diyaloğu ve "Tüm seri güncellensin mi?" onayı çoklu vardiyalı planda
   "Yönetim · TEST Sabah (silinecek) · 26.10.2026–01.11.2026" diyor. Karar: planda ≥2 vardiya varsa vardiya adı yerine desen etiketi
   (`Haftalık · 2 vardiya`, departman atamaları tablosundaki etiketle aynı fonksiyon) yazılsın; tek vardiyada bugünkü metin birebir.

## Ownership
`src/**` yalnız. `convex/**` ve `convex/_generated/**` DOKUNMA.

## Kurallar
- **YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git restore`, `git worktree`; `npx convex`**. Dev server başlatma.
- TypeScript strict; `any` / `as any` / `!` YOK. Mevcut test beklentisini değiştirme/silme (gerekiyorsa DUR, sor). Her madde için test.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint src
node_modules/.bin/vitest run src
```

## Rapor
`.claude/reports/vardiya-orca-turu-fix-src.md` — her maddeye 1 satır (file:line). `worker_done` ≤10 satır: file:line + kapı sonuçları.

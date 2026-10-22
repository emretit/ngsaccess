# W4.2b DÜZELTME 1 — arayüz denetim bulguları (UYGULAMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w4-2-grant-status` (İLK İŞ `cd`). Denetim raporu: `/tmp/w42b-denetim.md`. Orijinal spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w4-2b-grant-status-ui.md`. Backend düzeltmesi (W4.2a fix1, rapor `/tmp/w42a-fix1.md`) bu ağaca UYGULANDI. `redistribute({onlyFailed:true})` HENÜZ >100 hatalıda hata veriyor — madde 0'da sen düzelteceksin.

## Ortak kurallar
TypeScript strict; `any`/`as any`/`!` yok; `FunctionReturnType`; Türkçe; yeni bağımlılık yok (SSR + saf fonksiyon testleri).
YASAK: commit, push, deploy, `npx convex *`, DB yazma, `mobile/**`, `bridge/**`, `package.json`/lock. `convex/**`'ta YALNIZ madde 0 (redistribute onlyFailed) ve madde 3 (counts.deviceId bölgesi) + testleri.

## Düzeltmeler
0. **Backend `redistribute({onlyFailed:true})`** (`redistribute` nerede tanımlıysa — `convex/accessGrantStatus.ts` / `convex/deviceSyncRuns.ts`): failed >100 ise HATA verme; `by_project_state` 'failed' satırlarından en eski güncellenen ilk 100 çifti al, tek run başlat, dönüşe `{pairCount, remainingFailed, remainingCapped}` ekle (`.take(101)` deseni, 101+ ise capped). Açık `pairs` listesi >100 ise hata davranışı aynı kalsın. Test.
1. **"Hatalıları yeniden dağıt"** (`status/StatusPage.tsx` ~506, ~613): sayı `countText` ile (1000+); hatalı >100 ise onay metni "İlk 100 hatalı kişi×cihaz için tek gönderim başlatılacak; kalan N sonraki turda." ; dönüşteki kalan sayısını başarı bildiriminde göster. Saf fonksiyon + test.
2. **Açılışta çift liste çağrısı** (`StatusPage.tsx` ~134-143): debounce karşılaştırması `(f.search ?? "") === trimmed`; açılışta `listByProject` TEK kez. Test (saf yükleyici/çağrı sayımı).
3. **`counts({deviceId})` okuma** (`convex/accessGrantStatus.ts` ~97): cihaz verildiğinde `by_project_device` ile TEK `.take(1001)` okuyup durum/departman sayımını bellekte yap (5 ayrı taramayı kaldır); 1001'de `capped`. Yetki/proje kapsamı aynen. Test.

## Kapılar
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK.

## Rapor
`/tmp/w42b-fix1.md` + `worker_done`'da ≤10 satır: madde başına file:line + test · kapı sayıları.

# Görev: Kimlik doğrulamasız check-in açığını kapat + İş Kanunu md. 68 mola kademesi — Faz 0 / P4 + P6

Repo: /Users/emreaydin/ngsaccess (Convex backend + React). Önce `convex/_generated/ai/guidelines.md` oku.

## Hedef (test edilebilir)
A) `convex/employeeCheckIn.ts`'teki `createCheckInToken` public `mutation`, kimlik doğrulaması YOK: employeeId bilen herkes token üretip public `checkInWithToken` ile o çalışan adına `izin_verildi` PDKS kaydı yazabiliyor. Bu fonksiyon kaldırılmalı.
B) `convex/lib/breakDeduction.ts` `legalBreakMinutes` 4857/68'e uymuyor. Kanun: "dört saat veya daha kısa süreli işlerde 15 dk; dört saatten fazla ve yedi buçuk saate kadar (dahil) işlerde 30 dk; yedi buçuk saatten fazla işlerde 1 saat".

## Değişiklik
A1. `createCheckInToken`'ı sil. Önce `grep -rn createCheckInToken src mobile/lib convex` ile çağıran olmadığını doğrula (beklenen: yok; mobil `createMyCheckInToken` kullanır, web `src/pages/CheckIn.tsx` yalnız `checkInWithToken` kullanır). Çağıran varsa SİLME, rapora yaz ve `--outcome failed` ile dur.
A2. `createMyCheckInToken` ve `checkInWithToken` davranışı değişmez.
B1. `legalBreakMinutes(totalRawMinutes)`: ≤0 → 0; 1..240 → 15; 241..450 → 30; >450 → 60. Doc yorumunu kanun metnine göre düzelt.
B2. Yeni `convex/lib/breakDeduction.test.ts`: sınırlar 0, 1, 239, 240, 241, 449, 450, 451, 540 + `computeBreakDeduction` vardiya molası penceresi örtüşme durumu + `netWorkMinutes`.
B3. Bu değişiklik yüzünden kırılan golden testlerde (izinli dosyalar aşağıda) yalnız beklenen değeri güncelle; her birini gerekçesiyle raporla.

## Ownership (YALNIZ bunlara yaz)
convex/employeeCheckIn.ts, convex/lib/breakDeduction.ts, convex/lib/breakDeduction.test.ts (yeni), convex/lib/pdksDetail.test.ts, convex/lib/pdksPayroll.test.ts, convex/lib/pdksCalc.test.ts, convex/_generated/api.d.ts (yalnız `npx convex codegen` çıktısı).

## Kapsam dışı / DOKUNMA
convex/cardReadings.ts, convex/lib/pdksTable.ts, convex/lib/pdksChart.ts, convex/reports.ts, convex/dashboard.ts, convex/lib/trDate.ts, pdksTable.test.ts, pdksChart.test.ts (başka worker'ın — paralel çalışıyor), convex/sgkExport.ts, convex/lib/sgkCodes.ts. Mobil (mobile/) ve src/ dokunulmaz.

## Proje kuralları
TypeScript strict; `any`/`as any` YASAK → `unknown` + narrowing; `!` yerine erken return. Mevcut stil ve Türkçe yorum yoğunluğunu takip et.

## YASAK
commit / push / deploy (`npx convex dev`, `npx convex deploy`) / migration / canlı DB'ye yazma (Convex/Supabase MCP dahil) YOK. `npx convex codegen` serbest.

## Kapılar (hepsi yeşil olmalı)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint src convex   (0 error)
npx vitest run
Sahip olmadığın dosyada test kırılırsa düzeltme; raporla (paralel worker'ın ara durumu olabilir).

## Rapor
worker_done özetinde ≤10 satır: değişen dosyalar file:line, değişen golden beklentiler + gerekçe, kapı sonuçları.

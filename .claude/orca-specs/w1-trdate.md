# Görev: PDKS gün sınırını Türkiye saatine (UTC+3) çek — Faz 0 / P5

Repo: /Users/emreaydin/ngsaccess (Convex backend + React). Önce `convex/_generated/ai/guidelines.md` oku.

## Hedef (test edilebilir)
cardReadings.accessTime UTC ISO ("...Z") saklanıyor ama gün anahtarı `accessTime.split("T")[0]` (UTC günü) ve tarih aralıkları `${date}T00:00:00.000` / `T23:59:59.999` (Z'siz, UTC gibi kıyaslanan) ile hesaplanıyor. Sonuç: TR 00:00–02:59 arası okumalar önceki güne düşüyor / aralık dışında kalıyor. Gün anahtarı ve aralıklar Türkiye saatine göre (sabit UTC+3, DST yok) hesaplanmalı.

## Değişiklik
1. Yeni `convex/lib/trDate.ts` (saf, ctx yok):
   - `trDateKey(iso: string): string` → TR takvim günü "YYYY-MM-DD" (ör. "2026-10-15T22:30:00.000Z" → "2026-10-16").
   - `trDayRangeISO(startDate: string, endDate: string): { startISO: string; endISO: string }` → UTC Z ISO; ör. ("2026-10-16","2026-10-16") → startISO "2026-10-15T21:00:00.000Z", endISO "2026-10-16T20:59:59.999Z".
   - `trTodayKey(now?: Date): string`.
   - Mevcut benzer helper'ları YENİDEN KULLAN / tek kaynağa bağla, kopyalama: `convex/lib/cardReadingProcess.ts` (`startOfTurkeyDayISO`), `convex/lib/pdksHelpers.ts` (`isoTimeToTRMinutes`).
2. Yeni `convex/lib/trDate.test.ts` (vitest): yukarıdaki örnekler + 00:00/02:59/03:00 TR sınırları + ay/yıl dönümü.
3. Sahip olduğun dosyalarda (aşağıda) accessTime'dan gün anahtarı üreten her `split("T")[0]` → `trDateKey`; okuma sorgusu aralıkları → `trDayRangeISO`; varsayılan "bugün" (`new Date().toISOString().split("T")[0]`) → `trTodayKey()`.

## Ownership (YALNIZ bunlara yaz)
convex/lib/trDate.ts (yeni), convex/lib/trDate.test.ts (yeni), convex/cardReadings.ts, convex/lib/pdksTable.ts, convex/lib/pdksChart.ts, convex/reports.ts, convex/dashboard.ts, convex/lib/pdksTable.test.ts, convex/lib/pdksChart.test.ts, convex/_generated/api.d.ts (yalnız `npx convex codegen` çıktısı olarak).

## Kapsam dışı / DOKUNMA
- convex/sgkExport.ts, convex/lib/sgkCodes.ts (başka worker'ın), convex/employeeCheckIn.ts, convex/lib/breakDeduction.ts (başka worker'ın).
- Manuel pdksRecords entryTime/exitTime ("HH:MM" TR) semantiği ve `+03:00` ISO eki aynı kalsın.
- 3 PDKS ekranı (tablo/bordro/detay) arasındaki bilinçli hesap farkı (R8) KORUNACAK — birleştirme yapma.
- Public fonksiyon arg/return imzaları değişmez. Performans (tam tablo taraması) bu işin dışında.
- Testlerde gün değişimi nedeniyle değişen beklenen değerleri güncelleyebilirsin; her birini raporda gerekçesiyle listele.

## Proje kuralları
TypeScript strict; `any`/`as any` YASAK (eslint error) → `unknown` + narrowing; `!` non-null yerine erken return; Convex alanları camelCase. Mevcut kod stilini ve yorum yoğunluğunu takip et (yorumlar Türkçe).

## YASAK
commit / push / deploy (`npx convex dev`, `npx convex deploy`) / migration / canlı DB'ye yazma (Convex/Supabase MCP dahil) YOK. `npx convex codegen` serbest.

## Kapılar (hepsi yeşil olmalı)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint src convex   (0 error)
npx vitest run
Not: Aynı çalışma ağacında başka bir worker paralel çalışıyor (breakDeduction/employeeCheckIn). Senin sahip olmadığın dosyada test kırılırsa düzeltme, raporla.

## Rapor
worker_done özetinde ≤10 satır: değişen dosyalar file:line, değiştirilen her golden beklenti + gerekçe, kapı sonuçları.

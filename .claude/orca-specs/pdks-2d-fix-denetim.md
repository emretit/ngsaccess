# PDKS 2d düzeltme — DENETİM (SALT-OKUMA, kısa)

ÖNCE `.claude/orca-specs/akis-denetim-ortak.md` oku (YASAK + rapor biçimi). EK YASAK: HİÇBİR git yazma komutu yok; rapor dışında dosya yazma yok.

## Bağlam
`convex/lib/pdksPunchPairs.ts` "Her giriş/çıkışı topla" (eachPunch) eşleştirmesi. Önceki denetim (`/tmp/pdks-2d-denetim.md` DÜZELTİLMELİ 1-3 + NOT 2)
şu hataları buldu: elle çıkış/giriş, yönsüz son/ilk okumayı körlemesine siliyordu (yönsüz 08:00 + elle çıkış 18:00 → 0 dk). Koordinatör (Claude) düzeltti:
- `resolvePdksPunches`: yönleri önce çözer (yönsüz = açık/kapalı duruma göre dönüşümlü), tekrar okutma SON KABUL EDİLEN okumaya göre elenir.
- `pdksPairReadings(readings, manual, minInterval)`: elle çıkış yalnız çözülmüş son okuma "exit" ise onun yerine geçer; elle giriş ilk okuma açık
  "entry" ise yerine geçer, açık "exit" ise eklenir; yönsüz ilk okumada iki aday (yerine geç / ekle) içinden eksik ucu az olan seçilir, eşitlikte yerine geç.
- Çağıranlar: `convex/lib/pdksEvidence.ts` (~23), `convex/lib/pdksDay.ts` (~131) artık minInterval'ı pdksPairReadings'e de geçiyor.
- Testler: `convex/lib/pdksPunchPairs.test.ts` son iki `it`.

## Bak
1. Yeni kodun mantık hatası: sırasız girdi, aynı saniye, min aralık 0, yalnız elle uçlar, elle giriş ham okumalardan SONRA, elle çıkış ham okumalardan ÖNCE,
   yönlü+yönsüz karışık, gece (gün sınırı) — kendi uç vakalarını üret ve `node_modules/.bin/vitest` ile geçici olmayan bir şekilde değil, kafanda/okuyarak
   ya da `/tmp` altında geçici test dosyasıyla (`/tmp/pp-check.test.ts`, repo dışı) dene.
2. firstLast / alan yok yolunun etkilenmediği (pdksPairReadings yalnız eachPunch'ta çağrılıyor mu).
3. Öncekiyle davranış farkı yalnız elle uç + yönsüz okuma ve tekrar-okutma zinciri vakalarında mı.

## Kapılar
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/vitest run convex/lib/pdksPunchPairs.test.ts convex/pdksEachPunch.test.ts convex/w5aLegacyEquivalence.test.ts`

## Rapor
`/tmp/pdks-2d-fix-denetim.md` — ENGEL / DÜZELTİLMELİ / NOT (file:line + girdi → yanlış sonuç). `worker_done`'da ≤8 satır + rapor yolu.

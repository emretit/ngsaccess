# PDKS okuyucu uyarısı — DENETİM (SALT-OKUMA, kısa)

ÖNCE `.claude/orca-specs/akis-denetim-ortak.md` oku (YASAK + rapor biçimi). EK YASAK: HİÇBİR git yazma komutu yok; rapor dışında dosya yazma yok.

## Bağlam
PDKS kuralında seçili okuyucu, Hik okumalarıyla `readers.hikReaderNo` ↔ `cardReadings.hikCardReaderNo` üzerinden eşleşir (`convex/lib/pdksRules.ts`
loadPdksRulePolicy/resolvePdksCheckpoint). Kapı numarası değişir/okuyucu silinirse kural sessizce eşleşmeyi bırakır. Koordinatör (Claude) uyarı ekledi:
- `convex/pdksRules.ts` `getCheckpointWarnings` (authedQuery, schedule.manage): yürürlükteki + gelecek "selected" sürümlerdeki reader hedefleri için
  (a) okuyucu silinmiş/taşınmış, (b) Hik okuyucusunun numarası yok, (c) son 7 gün (bugün HARİÇ — reaktif yeniden çalışmayı önlemek için) cihazın
  gönderdiği ama hiçbir okuyucuda olmayan cardReaderNo.
- UI: `src/components/pdks/settings/CheckpointWarnings.tsx` (+test), `PdksSettingsPanel.tsx` içinde kuralların üstünde.
- Test: `convex/pdksCheckpointWarnings.test.ts`.

## Bak
1. Uyarı mantığı loadPdksRulePolicy'nin gerçek eşleşme davranışıyla tutarlı mı (yanlış pozitif / kaçırılan vaka)? Özellikle IDE (ioId snapshot) hedefleri,
   reader.projectId/doorId kontrolü, aynı cihazda başka projeye ait okuyucular.
2. Sorgu maliyeti / sınırlar: take sınırları, okuma başına sorgu yok mu, reaktif invalidasyon (bugünün okumaları aralığa girmiyor mu), `trDayRangeISO` ve accessTime biçimi (UTC Z) uyumu.
3. Yetki: başka projenin verisini sızdırma riski.
4. Türkçe metinler anlaşılır mı.

## Kapılar
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/vitest run convex/pdksCheckpointWarnings.test.ts src/components/pdks/settings/CheckpointWarnings.test.tsx`

## Rapor
`/tmp/pdks-okuyucu-uyari-denetim.md` — ENGEL / DÜZELTİLMELİ / NOT (file:line + somut senaryo). `worker_done`'da ≤8 satır + rapor yolu.

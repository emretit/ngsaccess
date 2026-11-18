# Plan — Durum makinesi kalanı: ölü değerler (2026-11-18)

Kaynak: `docs/audits/2026-11-14-implicit-state-machines/dalga3c-olu-degerler.md` (Dalga 3c raporu).
Dalga 1-3 kodu CANLI (e67adf51 + a0a77c65). Kalan yalnız aşağıdaki 7 bulgunun kararı ve uygulaması.

## Checklist

### Faz 0 · Canlı salt-okuma sayımı (~10 dk, koordinatör)
- [x] 0a `doors.status`, `readers.status` değer dağılımı (A-06)
- [x] 0b `accessTransfers` status=`requested` ve kind=`ide_panel` sayısı (A-07)
- [x] 0c `leaveBalances` satır sayısı (B-06), `chatConversations` satır sayısı (C-08)
- Yöntem: `npx convex data <tablo> --limit 100000 --format jsonl` (salt okuma; mutation/deploy YOK) → yerelde say

**Sonuç 2026-11-18:** doors 17/17 active, readers 17/17 active, accessTransfers 0, leaveBalances 0, chatConversations 0 → migration gerekmez.

### Faz 1 · Karar (Emre, ~2 dk) — temiz yol (1a) seçildi; 1b gereksiz
- [x] 1a Sayım temizse: A-06/A-07 daralt, B-06/C-08 tabloyu kaldır → onay
- [x] 1b Beklenmeyen değer/veri varsa: o madde için ayrı karar (eşleme / arşiv / bırak)

Faz 2-4 tek Codex worker: ctx_2505d102903a (sol medium), spec .claude/orca-specs/olu-degerler.md

### Faz 2 · Belgeleme (~15 dk, koordinatör; migration yok)
- [x] 2a A-08 `convex/schema.ts` + `convex/hikBridge.ts`: lastSeenAt/lastClientInfo/claimedBy legacy yorumu
- [x] 2b B-07 `convex/schema.ts`: eski 4 rıza türü legacy, `visitor_kvkk` aktif
- [x] 2c C-07 `convex/schema.ts`: biyometri varsayılanı yorumu (`true`) davranışla eşit

### Faz 3 · Kaldırma, yalnız tablo boşsa (~30 dk)
- [x] 3a B-06 `leaveBalances`: schema + `convex/lib/adminGuards.ts` + `orphanGuards.test.ts` + `adminSettingsGuards.test.ts`
- [x] 3b C-08 `chatConversations`: schema + adminGuards + `convex/projects.ts` yorumu + test (web sohbet hook'larına DOKUNMA)

### Faz 4 · Daraltma (~30 dk)
- [x] 4a A-06 create/update argümanları `active | inactive`; schema `v.optional(v.union(...))`; okuma fallback'i kalır; alan zorunlu YAPILMAZ
- [x] 4b A-07 `accessTransfers` union'dan `requested` ve `ide_panel` çıkar (canlıda 0 ise)

Kapı 2026-11-18 13:10: tsc 0, eslint 0, leak 0, vitest 511/5829 · denetim ctx_4b698f526902 (opus high) 0 bulgu

### Faz 5 · Kapı + denetim + yayın (~40 dk + Emre onayı)
- [x] 5a tsc 0 · eslint 0 · tam vitest · `node scripts/find-node-leak.mjs`
- [x] 5b Denetim: Codex read-only (yazan Claude → denetleyen Codex)
- [x] 5c Commit (pathspec, faz başına)
- [ ] 5d Emre onayı → export → function-spec kıyası → `convex dev --once` (+ bekleyen web: a4c2e0fe vardiya formu)
- [ ] 5e Push (onayla)

## Kapsam dışı
- A-01/A-02 Windows köprüsü yeniden yazımı (DS-K2804 riskiyle ayrı proje)
- `AddShiftDialog.tsx` commit'lenmemiş değişikliği (başka oturumun; yayından önce sahibine sor)
- Saha testleri / mobil store build (Emre)

## Riskler
- Bilinmeyen `doors.status` değerini otomatik `active` yapmak kapı açabilir → asla varsayma.
- Schema'dan tablo kaldırmak canlıda veri varken yapılmaz.
- Canlı Convex = HEAD (dün 17:19 f083c762); yayın öncesi function-spec kıyası yine şart.

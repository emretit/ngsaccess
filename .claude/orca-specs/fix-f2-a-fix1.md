# FAZ 2-A FIX1 — Köprü spool dayanıklılığı (2 DÜZELT) + kural io sorgusu önbelleği

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU. Denetim: `/tmp/fix-f2-a-denetim.md` (oku; denetçi /tmp'de yeniden üretti). Rapor: `/tmp/fix-f2-a-fix1-rapor.md`.
## Ownership
`scripts/lib/ide-mqtt-routing.mjs`, `scripts/lib/ide-mqtt-routing.nodetest.mjs`, `scripts/ide-mqtt-bridge.mjs`, `convex/ideSync.ts`, `convex/fixF2Ide.test.ts`.
## Değişiklik
1. Spool'da bozuk/yarım satır açılışta köprüyü çökertmesin (routing.mjs ~17-22): satırı atla, ayrı `.corrupt` dosyasına taşı + uyarı logu.
2. Kalıcı reddedilen olay (4xx — doğrulama/kimlik hatası; 5xx/ağ değil) kuyruğun başında kalıp arkasındakileri bekletmesin (routing.mjs ~43-51): kalıcı hatada
   olayı `.rejected` dosyasına taşı ve sıradakine geç; geçici hatada (5xx/ağ/timeout) mevcut geri çekilme.
3. `ideSync.ts` ~274: aynı çağrıda kural başına io sorgusunu tekrar tekrar yapma — çağrı içi önbellek (Map).
## Kabul
Node testleri: bozuk satır → köprü açılır, satır `.corrupt`'a gider; 4xx olay → `.rejected`'a gider, sonraki olay gönderilir; 5xx → yeniden denenir, sıra korunur.
`node --test scripts/lib/ide-mqtt-routing.nodetest.mjs`, `convex/ideSync.test.ts`, `convex/fixF2Ide.test.ts` yeşil.

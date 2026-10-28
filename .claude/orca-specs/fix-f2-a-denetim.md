# DENETİM — Faz 2-A (IDE köprü: C-04, C-06 spool/ACK, C-09 web komut süresi, A2-5, timeout cron)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f2-a-ide.md`. Worker raporu: `/tmp/fix-f2-a-ide-rapor.md`.
Rapor: `/tmp/fix-f2-a-denetim.md`. Dosyalar (yalnız `git diff HEAD`): convex/ideSync.ts convex/actions/ideGatewayDevice.ts convex/lib/deviceHelpers.ts convex/crons.ts convex/http.ts
scripts/ide-mqtt-bridge.mjs scripts/lib/ide-mqtt-routing.mjs scripts/lib/ide-mqtt-routing.nodetest.mjs convex/ideSync.test.ts convex/fixF2Ide.test.ts
Kapılara ek: `node --test scripts/lib/ide-mqtt-routing.nodetest.mjs`.
Özel dikkat: C-03 (428382a4) errorCode zinciri korunuyor mu; spool: disk dolması/bozuk satır/çift gönderim (sunucu tekilleştirmesi yoksa olay iki kez yazılır mı? — C-05 henüz yapılmadı, risk olarak belirt);
ACK tekrarında markAck idempotent mi; timeout cron'un kota etkisi (~4.320/ay) ve okuması sınırlı mı; openDoor expiresAt mobil yolunu bozuyor mu; A2-5 değişikliği mevcut kuralları (geçerli io'lu) etkilemiyor mu;
cascade IDE kuyruğu silerken başka cihazın işine dokunuyor mu. Worker'ın bahsettiği "grantStatus projeksiyonu" notunu değerlendir.

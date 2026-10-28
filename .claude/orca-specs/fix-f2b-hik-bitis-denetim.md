# DENETİM — Faz 2 Dalga B-1 (Hik cihazına erişim bitişi)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f2b-hik-bitis.md`. Worker raporu: `/tmp/fix-f2b-hik-bitis-rapor.md`.
Rapor: `/tmp/fix-f2b-hik-bitis-denetim.md`. Dosyalar (yalnız `git diff HEAD` / yeni dosya): convex/lib/gateway/persons.ts convex/lib/gateway/persons.test.ts convex/lib/hikSyncEmployee.ts
convex/hikvisionSync.ts convex/actions/hikQueueWorker.ts convex/employeeTermination.ts convex/employeeTermination.test.ts convex/fixF2bHikEnd.test.ts + koordinatörün yardımcısı convex/lib/accessEnd.ts (+test).
DİKKAT: aynı ağaçta B-2 (ideSync/ideGatewayDevice/visitors/grantStatus/accessGrantStatus/deviceSyncRuns) ve B-3 (processCardReadingCore/http/köprü) worker'ları yazıyor — onları DENETLEME, dokunma.
Özel dikkat: TR duvar saati dönüşümü (UTC+3, saniye kırpma) ve Hik `timeType=local` uyumu; bitiş ≤ başlangıç düzeltmesinin cihazın reddetmeyeceği sırayı her yolda (gateway, localBridge kuyruğu, retry payload) üretmesi;
bitişsiz kişide 2037 geriye uyumu; `terminate` ileri/bugün tarihli senkron planlaması (çift planlama, geçmiş tarih yolu değişmedi mi, `closeAccess` ile çakışma); validator (`returns`) güncellemeleri eksik mi;
ayrılan kişi `reinstate` edilince bitişin cihazdan kalkması (yeniden senkron end'i 2037'ye döndürüyor mu).

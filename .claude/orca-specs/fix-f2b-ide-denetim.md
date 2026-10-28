# DENETİM — Faz 2 Dalga B-2 (IDE user.end + güncel kimlik koruması + yetki projeksiyonu + ziyaretçi küçükleri)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f2b-ide.md`. Worker raporu: `/tmp/fix-f2b-ide-rapor.md`.
Rapor: `/tmp/fix-f2b-ide-denetim.md`. Dosyalar (yalnız `git diff HEAD` / yeni dosya): convex/ideSync.ts convex/actions/ideGatewayDevice.ts convex/deviceSyncRuns.ts convex/lib/grantStatus.ts
convex/accessGrantStatus.ts convex/visitors.ts convex/fixF2Cards.test.ts convex/fixF2bIde.test.ts. (Bağlam: convex/lib/accessEnd.ts, convex/lib/cardIdentity.ts, convex/hikvisionSync.ts protectCurrentCredential ~1163, docs/ide-smart/05-crud-data-models-validation.md.)
DİKKAT: aynı ağaçta B-3 denetimi sürüyor (processCardReadingCore/köprü) — onları DENETLEME, dokunma. B-1 (Hik dosyaları) kapandı, dokunma.
Özel dikkat: güncel kimlik koruması YANLIŞ POZİTİF üretip gerçekten silinmesi gereken kartı panelde BIRAKIYOR mu (erişim geri alınamaması = güvenlik açığı; ör. aynı kişinin kendi eski işi, pasif/ayrılmış kişi, başka projedeki aynı kart, o panele erişimi olmayan yeni sahip);
koruma kararı poll/markSent/ACK'te tutarlı mı, superseded iş Yetki Durumu'nda doğru görünüyor mu, sorgu maliyeti (poll başına ek okuma, kota) makul mü;
user.end epoch saniye + start≥end düzeltmesi tüm userRecord yollarında (create/update/reconcile/deviceSyncRuns) var mı, roster karşılaştırması end yüzünden sürekli fark/yeniden gönderim üretiyor mu;
grantStatus projeksiyonu seçimsiz kuralda eski davranışı koruyor mu; accessGrantStatus değişikliği yalnız okuma mı; visitors.ts senkron planlaması çift iş/kota üretiyor mu.

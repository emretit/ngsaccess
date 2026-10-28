# Güvenlik + eşdeğerlik denetimi — Backend dalga 2 (B3, B2b; Codex yazdı)

Rol: SALT-OKUMA denetçi. Hiçbir dosyaya yazma (yalnız rapor). commit/push/deploy/DB/`npx convex` YOK.
Çalışma dizini /Users/emreaydin/ngsaccess (main). Başka oturumların commit'siz dosyalarını (git status'ta aşağıdakiler dışındaki M/??) DENETLEME.
Eski hâl `git show HEAD:<dosya>`, yeni hâl çalışma kopyası.

## B3 — processCardReading (CANLI kart geçiş kararı) — EN KRİTİK
Dosyalar: convex/cardReadings.ts (processCardReading 412→36 satır sarmalayıcı), YENİ convex/lib/processCardReadingCore.ts (491), YENİ convex/processCardReading.characterization.test.ts (237, 71 test). Rapor /tmp/backend-b3-rapor.md.
1. Eski gövde (HEAD cardReadings.ts:443-854) ile 7 faz fonksiyonunun birleşimini satır satır karşılaştır: her `ctx.db` okuma/yazma (sıra + sayı + index + alanlar), `ctx.scheduler` çağrısı, erken `return` dalı ve dönüş nesnesi birebir mi? Bir faz atlanabiliyor ya da sırası değişmiş mi?
2. Güvenlik: token ile sabitlenen cihaz vs body serial/IP (cross-tenant forge), kart→çalışan eşleşmesinde proje filtresi, pasif/işten çıkmış çalışan, kural/zaman planı kontrolü, `canEmployeeAccessDevice`/accessDecision çağrısı — hiçbir izin yolunu genişletmiş ya da ret yolunu kaldırmış mı? Ret→izin dönüşebilecek herhangi bir fark ENGEL'dir.
3. Karakterizasyon testleri gerçekten bu dalları kapsıyor mu (sadece mutlu yol değil)? Eksik kalan kritik dal varsa NOT olarak listele.
4. Worker'ın bilinçli koruduğu tuhaflıklar (core:333 tarih/pasiflik istisnası, core:424/459 çıkışta geç bildirimi, debounce yokluğu) gerçekten HEAD'de de öyle mi?
5. processCardReadingCore.ts "use node" İÇERMEMELİ ve doğrudan/dolaylı node-yalnız modül (crypto, ./hikGateway, ./gateway/*) import ETMEMELİ (internalMutation V8'de çalışır).

## B2b — accessRules.listMemberships (yeni sorgu) + 4 personel ekranı
Dosyalar: convex/accessRules.ts, convex/lib/accessRuleRead.ts, YENİ convex/accessRuleMemberships.test.ts, src/components/employees/{EmployeeForm.tsx, hooks/useEmployeeFormData.ts, EmployeeSyncConfirmDialog.tsx, EmployeeDetails.tsx, EmployeeSyncConfirmDialog.test.tsx}. Rapor /tmp/backend-b2b-rapor.md.
1. Yetki: listMemberships, list ile AYNI resolveProjectScope / rol davranışını uyguluyor mu? Başka projenin kuralı/üyesi sızabilir mi? authedQuery mi?
2. Dönen alanlar 4 tüketicinin kullandığı alanların tamamını içeriyor mu (ekranlar eskisiyle aynı sonucu gösterir mi)? Gereksiz hassas alan (çalışan PII vb.) dönüyor mu?
3. `list` değişmemiş mi?

## Kapılar (kendin koş)
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `-p tsconfig.app.json`
- `node_modules/.bin/eslint convex/cardReadings.ts convex/lib/processCardReadingCore.ts convex/processCardReading.characterization.test.ts convex/accessRules.ts convex/lib/accessRuleRead.ts convex/accessRuleMemberships.test.ts src/components/employees`
- `node_modules/.bin/vitest run convex src/components/employees`
- `node /tmp/find-node-leak.mjs` (çıktısız olmalı)

Rapor: /tmp/backend-denetim-2.md — ENGEL/DÜZELT/NOT, file:line, eski vs yeni, öneri; B3 ve B2b için SAF/GÜVENLİ hükmü + kapı özetleri.
worker_done (≤10 satır): sayılar + hükümler + kapılar.

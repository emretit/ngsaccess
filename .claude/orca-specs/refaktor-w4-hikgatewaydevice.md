# Refaktör W4 — convex/actions/hikGatewayDevice.ts (1316 satır, "use node" action god-file)

Hedef: registered action'lar (`api.actions.hikGatewayDevice.*` / `internal.actions.hikGatewayDevice.*`) AYNI dosyada, AYNI isim/args/returns ile ince sarmalayıcı olarak kalır; büyük gövdeler lib'e taşınır; davranış birebir; convex tsc 0 ve ilgili testler yeşil.

ORTAK KURALLARDAKİ "convex/ klasörüne dokunma" maddesi bu worker için GEÇERSİZ; yerine aşağıdaki ownership geçerli.

Ownership (yalnız bunlara yaz):
- convex/actions/hikGatewayDevice.ts
- YENİ dosyalar: convex/lib/gatewayReconcile.ts (+ .test.ts), convex/lib/gatewayBackfill.ts, convex/lib/gatewayCommand.ts (isimler önerilir; convex/lib/ altında, mevcut lib dosyalarını DEĞİŞTİRMEDEN)
- DOKUNMA: convex/cardReadings.ts, convex/accessRules.ts, convex/hikvisionSync.ts, convex/actions/hikvisionSync.ts, convex/actions/hikQueueWorker.ts, convex/deviceSyncRuns.ts, convex/lib/peopleHikSnapshot.ts, convex/lib/employeeCardChange.ts ve git status'ta M görünen HER convex dosyası (başka oturumun commit'siz işi). convex/lib/gateway/* ve convex/lib/reconcileMath.ts'i yalnız import et.

Önerilen yapı:
1. `reconcileDevice` (~:798-1010): kart/yüz/parmak izi diff hesabı saf fonksiyona (girdi: beklenen + cihazdaki listeler → diff nesnesi) taşınır; ctx bağımlı toplama (runQuery/gateway çağrıları) action'da ya da ctx alan lib fonksiyonunda kalır. Saf diff için golden test yaz (boş, tam eşleşme, iki yönlü fark, normalize edilen kart no'ları — mevcut normalize mantığı neyse o).
2. `_runBackfill` (~:700-797) + `collectAllPages` + `auditDeviceCommand` → lib modülleri; çağıran action'lar aynı.
3. "use node" gereksinimi: lib dosyası node API'si kullanıyorsa başına "use node" KOYMA (lib'ler action değildir); Node-yalnız import varsa yalnız action dosyasından çağrılan modülde tut — convex tsc + mevcut testler bunu doğrular.
4. Hata mesajları, audit kayıtları, dönüş şekilleri, `allowedProjectIds` yetki kontrolü sırası BİREBİR. Yetki/proje kontrolü sarmalayıcıdan lib'e taşınırsa sırası değişmemeli.

Kapsam dışı: cardReadings.backfillHikEventRow mantığı (akış D1 başka oturumda), yeni özellik, cron tanımları.

Kapılar (ortak kurallardaki tsc YERİNE/YANINDA):
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 (başlangıç 0)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/eslint convex/actions/hikGatewayDevice.ts convex/lib/gateway*.ts`
- `node_modules/.bin/vitest run convex/actions convex/lib` (başka oturumun yarım işinden gelen alakasız kırmızıyı dosya adıyla raporla)
- `npx convex ...` / codegen / deploy YOK. `convex/_generated` değişmemeli (yeni lib dosyası api'ye registered fn eklemez).
Rapor yolu: /tmp/refaktor-w4-rapor.md

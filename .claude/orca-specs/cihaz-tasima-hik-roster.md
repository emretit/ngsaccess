# Spec — Hik cihaz proje taşıma açığı: taşımayı engelle + kayıtta cihaz kişi listesini eşitle

## Hedef (test edilebilir)
Bir Hikvision (gateway) cihazı başka projeye geçtiğinde eski projenin kişileri cihazda kalıp yeni projenin kapısını açamaz:
(1) admin panelden Hik cihazın projesi değiştirilemez (backend açık hata), (2) gateway'e kayıt/backfill sonunda cihazdaki
"sistemin beklemediği" kişiler silinir (güvenlik sigortalı, dry-run destekli).

## Bağlam (koordinatör kontrolü, 2026-10-22 22:20)
- Hik cihazda kişi kimliği `employeeNo = cardNumber` (hikvisionSync.ts:411, accessRules.ts:85, deviceSyncRuns.ts:473).
- `convex/lib/deviceAssignment.ts` `reassignDeviceCore`: Hik cihazında `purgeDeviceCascade` devices satırını SİLİYOR
  (hikDevIndex, ehomeID/ehomeKey, deviceSerial, hikTransport, hikModel, apiToken gidiyor), sonra `claimAdminDeviceCore`
  (`convex/lib/devicePool.ts`) IDE-biçimli yeni satır açıyor (Hik alanları yok, kapılar IDE yoluyla). Sonuç: cihaz yeni
  projede bozuk + fiziksel cihazda eski projenin kişileri/kartları kalıyor (cihaz yerel karar verir → eski kart kapıyı açar).
- UI: `src/components/admin/AdminDevicesPanel.tsx` tüm markaları listeliyor; `AdminDeviceDialog.tsx` `saveEdit` Hik için de
  `reassignDevice`/`claimDevice` çağırıyor.
- Diğer yol: cihazı A'dan sil → B'de aynı fiziksel cihazı yeniden ekle (`createHikDeviceCore` → `registerDeviceOnGateway`
  (`convex/lib/gatewayCommand.ts:70`) → `runBackfillDeviceFromGroups` (`convex/lib/gatewayBackfill.ts:93`)). Cihazdaki A
  kişileri hiç silinmiyor.
- 2A denetim3 N1: `deletionUnresolvableReason` taşınmış cihazda silmeyi "çözülemez" sayıyor. Bu spec onu DEĞİŞTİRMEZ;
  eşitleme ayrı mekanizma.
- Canlı (salt-okuma): 4 Hik cihaz (NGS0001, NGS0002 = NGS projesi gateway; NGS cikis, Deneme1 = emre). Şu an taşınmış cihaz YOK.

## Yapılacaklar
1. **Taşımayı engelle (backend):** `claimDeviceCore` + `reassignDeviceCore` — adminDevice.brand === "hikvision" ise ve proje
   değişiyorsa `ConvexError({ code: "HIK_DEVICE_MOVE_UNSUPPORTED", message: "Hikvision cihazının projesi değiştirilemez. Cihazı
   bu projeden silip hedef projede yeniden ekleyin; eklerken cihazdaki eski kişiler temizlenir." })`. Yalnız ad değişikliği
   (proje aynı) çalışmaya devam eder. Reddetme HİÇBİR DB yazımından önce olmalı.
2. **Taşımayı engelle (UI):** `AdminDeviceDialog.tsx` — Hik cihazında proje seçicisi devre dışı + kısa açıklama (aynı metin).
   Ad düzenleme açık kalır.
3. **Eşitleme çekirdeği (saf fonksiyon):** yeni `convex/lib/hikRosterReconcile.ts` — girdi: cihazdaki employeeNo listesi +
   beklenen employeeNo kümesi; çıktı: silinecekler + güvenlik kararı. Normalizasyon mevcut kodla aynı olmalı (kart no nasıl
   yazılıyorsa öyle karşılaştır; yeni türetme yazma, mevcut yardımcıyı bul ve kullan). Sigorta: beklenen küme hesaplanamadıysa
   VEYA (cihazda kişi var ve beklenen küme boş) → silme YOK, sebep döner.
4. **Beklenen küme (internalQuery):** cihazın MEVCUT projesinde sistemin bu cihaza yazacağı tüm kimlikler: aktif kurallardan
   cihaza düşen çalışanlar (mevcut `resolveRuleDeviceTargets` / `peopleHikSnapshot` mantığını yeniden kullan) + bu cihaza
   yazılan ziyaretçiler (visitors → hikvisionSync yolu; nasıl hedeflendiğini koddan çıkar) + varsa başka yazan yollar
   (parmak izi kaydı `fingerprintEnrollment` employeeNo'su vb. — kontrol et, rapora yaz). Emin olmadığın kategori varsa onu
   beklenen kümeye EKLE (fazla tutmak güvenli, eksik tutmak kilitler).
5. **Eşitleme action'ı:** yeni `convex/actions/hikRosterReconcile.ts` (`"use node"`) — `internalAction reconcileHikDeviceRoster
   ({ deviceId, dryRun })`: yalnız `hikTransport` gateway + `hikDevIndex` dolu cihaz; cihaz kişilerini sayfa sayfa oku
   (`searchPersonOnDevice`, `convex/lib/gateway/persons.ts` — İMPORT ET, DOSYAYI DEĞİŞTİRME), farkı hesapla, dryRun=false ise
   fazlaları `deletePersonFromDevice` ile sil (sırayla, cihaz başına üst sınır ör. 500/koşu; aşarsa kendini `runAfter` ile
   devam ettir). Dönüş: `{ onDevice, expected, extra, deleted, failed, skippedReason? }` + `console.log` tek satır JSON.
   localBridge / gateway'siz cihaz → `skippedReason`, silme yok.
6. **Tetik:** `runBackfillDeviceFromGroups` sonunda (yeni kayıt) `reconcileHikDeviceRoster({ dryRun: false })` zamanla
   (`ctx.scheduler.runAfter`). Var olan cihazlar için otomatik tetik YOK (NGS0001/0002 canlıda dokunulmaz).
7. **Testler:** saf fonksiyon (normalizasyon, sigorta, boş küme), claim/reassign Hik reddi (yazım olmadığı dahil), IDE
   reassign'ın değişmediği, AdminDeviceDialog Hik'te proje seçicisinin kilitli olduğu, beklenen kümenin ziyaretçi +
   kural çalışanlarını içerdiği.

## Ownership (yalnız bunlar)
convex/lib/deviceAssignment.ts, convex/lib/hikRosterReconcile.ts (yeni), convex/actions/hikRosterReconcile.ts (yeni),
beklenen küme internalQuery için yeni dosya `convex/hikRosterReconcile.ts` (tercih) — gerekirse convex/hikvisionSync.ts'te
yalnız EXPORT ekleme, convex/lib/gatewayBackfill.ts, src/components/admin/AdminDeviceDialog.tsx, ilgili yeni/var olan
*.test.ts(x) dosyaları. `convex/_generated/api.d.ts` yeni modül girişleri (elle, alfabetik).

## Kapsam dışı / DOKUNMA
- BAŞKA OTURUMUN COMMIT'SİZ İŞİ VAR, DOKUNMA: convex/employees.ts, convex/lib/gateway/persons.ts, convex/lib/hikSyncEmployee.ts,
  convex/actions/hikQueueWorker.ts, convex/employeeAuth.ts, convex/lib/employeeAuth.ts, convex/lib/employment*.ts,
  convex/lib/mobileAccess.ts, convex/lib/mobileErrors.ts, convex/w53Integration.test.ts, src/components/employees/**,
  src/types/employee.ts. (Okumak serbest, yazmak yasak.)
- IDE panelleri: DEĞİŞİKLİK YOK. Yalnız salt-okuma notu: IDE reassign sonrası eski projenin kartları panelde ne zaman
  silinir (`idePanelUsers` ideUuid bazlı, `reconcileRoster`)? Rapora 2-3 satır.
- 2A `deletionUnresolvableReason`, sync issue UI, Hik yerinde (in-place) proje taşıma — yapılmaz.
- Canlı cihaza/gateway'e çağrı, `npx convex run`, `convex dev/deploy` YOK.

## Kurallar
- Önce `convex/_generated/ai/guidelines.md` oku. TS strict; `any`/`as any` yasak; `unknown` + narrowing; `!` yok.
- Node modülü (gateway core/crypto) import eden HER convex dosyası `"use node"` ister ve `"use node"` dosyası yalnız action
  export eder. Bitince `node scripts/find-node-leak.mjs` temiz olmalı.
- commit / push / deploy / migration / canlı DB yazma YOK.

## Kapılar (hepsi yeşil)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint <değişen dosyalar>` → 0 hata
- `node_modules/.bin/vitest run` TAM (yalnız convex değil; src testleri convex modüllerini mock'luyor). Başka oturumun yarım
  işinden gelen kırmızı varsa dosya adıyla rapora yaz, düzeltmeye çalışma.
- `node scripts/find-node-leak.mjs` temiz

## Rapor
`/tmp/cihaz-tasima-rapor.md` (≤40 satır): değişen dosyalar (file:line), beklenen kümenin kategorileri ve kaynak satırları,
sigorta kuralları, IDE salt-okuma notu, kapı çıktıları (sayılar). `worker_done` özeti ≤10 satır.

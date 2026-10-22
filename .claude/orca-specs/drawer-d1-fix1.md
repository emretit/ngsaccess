# Drawer D1 düzeltme turu 1 — denetim bulguları (P1-1, P2-1, P2-3, P2-4, P3-1)

Bağlam: D1 kodu çalışma ağacında COMMIT'SİZ (spec `.claude/orca-specs/drawer-d1-backend.md`). Denetim raporu `.claude/orca-specs/drawer-d1-denetim-rapor.md` — ÖNCE oku. Yalnız aşağıdaki maddeler; başka refactor yok. Emre kararı: project_user YALNIZ kapı açar (`remoteOpenDoor`, `openIdeDoor`).

## Ortak kurallar
- TypeScript strict; `any`/`as any` YASAK; `unknown` + narrowing; `!` yerine erken return. Türkçe metinler.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `convex/_generated/**`, `mobile/**`, `src/**` (bu tur yalnız backend), git stash/checkout/reset.

## Değişiklik
1. **P1-1** `convex/actions/hikGatewayDevice.ts`: `registerDeviceOnGateway` (:116), `removeDeviceFromGateway` (:258), `refreshGatewayDeviceStatus` (:293), `captureFaceFromDevice` (:1033), `applyDoorStatusPlan` (:1103), `applyVerifyPlan` (:1239) — proje/çalışan kontrolünden SONRA `if (!isManager(ctx.user)) return { ok:false, error:"Bu işlem için yönetici yetkisi gerekiyor" }` (fonksiyonun dönüş sözleşmesi throw ise throw). Bu 6'sından cihaza YAZAN 4'ü (register, remove, applyDoorStatusPlan, applyVerifyPlan) de `auditDeviceCommand` ile kaydedilsin (etiketler: "Gateway'e kaydet", "Gateway'den kaldır", "Kapı durum planı uygula", "Doğrulama planı uygula"). Dosyadaki diğer `authedAction`'ları da tara: kapı açma ve salt-okuma `pingHikGateway` dışında yetkisiz kalan varsa aynı kontrolü ekle ve raporla.
2. **P2-1** `convex/devices.ts`: `create` (:116), `createIdePanel` (:548), `createHikDevice` (:655) → `adminMutation` (update/remove ile aynı). Yalnız bu 3 sarmalayıcı satırı; dosya başka ekiple ortak.
3. **P2-3 audit best-effort** (`auditDeviceCommand`, iki action dosyası): her iki `runMutation(recordOperationInternal)` çağrısı kendi try/catch'i içinde, hata `console.warn` ile loglanır; komutun orijinal sonucu döner / orijinal hatası yeniden fırlatılır (audit hatası maskelemez).
4. **P2-4** `convex/deviceCenter.ts:105-107`: throw yerine `doors.slice(0,256)`, `readers.slice(0,1024)` + dönüşe `limits: { doorsCapped: boolean, readersCapped: boolean }`. (UI gösterimi D2'nin işi; tip tsc'den geçmeli.)
5. **P3-1** başarısız komut kaydına kısa neden: `summary` = `result.error` ilk 200 karakter; 6+ haneli rakam dizileri `…` ile maskelenir (kart no sızmasın). Throw yolunda `error instanceof Error ? error.message : "Bilinmeyen hata"` aynı maskeyle.
6. **Testler:** 6 action için project_user reddi (en az register/remove/applyDoorStatusPlan), create×3 adminMutation reddi, audit hatası komutu bozmaz (mock `recordOperationInternal` throw), getOverview 257 kapıda kırılmaz + `doorsCapped:true`, başarısız komut summary'si maskeli.

## Ownership
convex/actions/hikGatewayDevice.ts · convex/actions/ideGatewayDevice.ts · convex/devices.ts (yalnız madde 2) · convex/deviceCenter.ts · convex/deviceEvents.ts (gerekirse) · convex/deviceCenter.test.ts ve yeni test dosyaları

## Kapılar (kendin koş, sayıyla raporla)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (başlangıç 2409)

## Rapor
`worker_done` ≤10 satır: madde → file:line, madde 1'de ek bulunan action'lar, yeni test sayısı, kapı sayıları.

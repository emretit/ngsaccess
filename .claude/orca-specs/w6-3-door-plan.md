# W6-3 — Haftalık kapı durum planı (UYGULAMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w6-door-plan` (dal `emretit/w6-door-plan`, taban `5d36adb`; `node_modules` ana repoya symlink — DOKUNMA). Arka plan: `/Users/emreaydin/ngsaccess/docs/hikconnect-audit/WEB_PLAN.md:48` ("Kapı durum planı: tek günlük pencere → haftalık plan").

## Hedef (test edilebilir)
Hik kapısının durum planı (DoorStatus) gün bazında farklı aralıklarla tanımlanabilir: her gün için 0..N segment (`beginTime`, `endTime`, `mode`), cihaza `setDoorStatusWeekPlan` ile birebir gider. Mevcut tek-aralıklı kayıtlar değişmeden aynı sonucu üretir.

## Mevcut durum
- Şema `convex/schema.ts:~289` `doors.hikDoorStatusPlan = { enabled, beginTime, endTime, mode: "remainOpen"|"normal" }` (her gün aynı).
- Cihaza yazan İKİ kopya kod: `convex/actions/hikGatewayDevice.ts:~1114` `applyDoorStatusPlan` ve `convex/actions/hikQueueWorker.ts:~222` `syncDoorStatusPlan` (7 gün aynı segment). `convex/lib/gateway/plans.ts:27` `setDoorStatusWeekPlan` gün bazında gruplar.
- UI `src/components/access-control/EditDoorDialog.tsx` (tek aralık + mod), `convex/doors.ts:~173, ~267` validator'ları.

## Yapılacaklar
1. **Şema (geri uyumlu, opsiyonel):** `hikDoorStatusPlan`'a `weekly?: Array<{ day: Weekday; segments: Array<{ beginTime: "HH:MM:SS"; endTime: "HH:MM:SS"; mode }> }>` ekle. `weekly` yoksa eski `beginTime/endTime/mode` 7 gün uygulanır (birebir eski davranış). Mod listesi: mevcut `remainOpen` | `normal` + gateway/ISAPI DoorStatus'un desteklediği `remainClosed` (`convex/lib/gateway/plans.ts` tipini kontrol et; desteklenmiyorsa ekleme, rapora yaz). Migration YOK; eski alanlar zorunlu kalır (weekly varken bile doldurulur: ilk segmentin değerleri ya da varsayılan) ki eski okuyucular kırılmasın.
2. **Tek segment üretici:** `convex/lib/doorStatusPlan.ts` (yeni) `buildDoorStatusSegments(plan)` → `DoorStatusSegment[]`; iki action da bunu kullansın (kopya kaldırılsın). Doğrulama (sunucu, `convex/doors.ts` create/update'te de): HH:MM(:SS), `begin < end` (gece yarısı geçen segment YOK — iki güne böl), aynı günde çakışma yok, gün başına en fazla 8 segment (Hik sınırı; plans.ts/ISAPI'de farklıysa onu kullan), 7 günün her biri en fazla bir kez. Türkçe hata.
3. **UI `EditDoorDialog.tsx`:** "Her gün aynı" (mevcut tek aralık) ↔ "Gün bazında" geçişi; gün bazında: 7 satır (Pzt..Paz), her satırda segment ekle/sil (başlangıç, bitiş, mod), "Pazartesiyi tüm hafta içine kopyala" kısayolu. Mevcut `useUnsavedChangesGuard` karşılaştırması yeni alanı da kapsasın. Kaydet → mevcut akış (plan cihaza nasıl gidiyorsa: `applyDoorStatusPlan` / kuyruk `syncDoorStatusPlan`) değişmeden. Türkçe metin; erişilebilir etiketler.
4. Doğrulama planı (`hikVerifyPlan`) KAPSAM DIŞI — dokunma.

## Ortak kurallar
- TypeScript strict; `any`/`as any`/`!`/`filter(Boolean)` YASAK. Sınırsız yeni `.collect()`, cron, polling YOK. `convex/_generated/ai/guidelines.md` oku. Türkçe metin.
- Ownership: `convex/schema.ts` (YALNIZ `doors.hikDoorStatusPlan`), `convex/doors.ts` (validator + doğrulama), `convex/lib/doorStatusPlan.ts` (yeni), `convex/lib/gateway/plans.ts` (yalnız mod tipi gerekirse), `convex/actions/hikGatewayDevice.ts` (yalnız `applyDoorStatusPlan`), `convex/actions/hikQueueWorker.ts` (yalnız `syncDoorStatusPlan` case'i), `src/components/access-control/EditDoorDialog.tsx` (+ yeni alt bileşen dosyası), testler, `convex/_generated/api.d.ts` (yalnız yeni modül satırı gerekirse).
- YASAK: `convex/devices.ts`, `convex/shifts.ts`, `convex/lib/deviceConnection.ts`, `src/components/devices/**`, `src/components/shifts/**`, `src/components/audit/**`, commit, push, deploy, `npx convex *`, DB yazma, `git add/stash/checkout/reset/commit`. Canlı cihaz YOK — gateway çağrıları mock'la test edilir.

## Testler
- `buildDoorStatusSegments`: eski tek-aralık kaydı → 7 gün aynı segment (eski kodla birebir, snapshot ya da eşitlik); weekly → gün/segment birebir; boş gün; doğrulama redleri (çakışma, begin>=end, >8 segment, tekrar eden gün, geçersiz saat).
- Action'lar (mock gateway): `setDoorStatusWeekPlan` çağrı argümanları eski ve yeni plan için; `enabled=false` → link 0 (eski davranış).
- `doors.update` geçersiz weekly reddi; UI: mod geçişi, kopyala kısayolu, kaydet payload'u, unsaved guard.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK · `git diff --check` temiz.

## Rapor
`/tmp/w6-3-report.md`: madde başına file:line + test adı, şema değişikliği, cihazda doğrulanacaklar listesi. `worker_done`'da ≤10 satır.

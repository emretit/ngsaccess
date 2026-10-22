# Drawer D2 düzeltme turu 1 — denetim bulguları

Bağlam: D2 kodu çalışma ağacında COMMIT'SİZ (spec `.claude/orca-specs/drawer-d2-frontend.md`, taban main `59282e5`). Denetim raporu `.claude/orca-specs/drawer-d2-denetim-rapor.md` — ÖNCE oku.

## Yap
1. Raporun TÜM P2 bulgularını (P2-1 … P2-6) rapordaki öneriye göre düzelt. Özellikle P2-1: canlı cihaz verisi (heartbeat ile gelen IP/model) form values'ı yenileyip KAYDEDİLMEMİŞ düzenlemeyi silmemeli — form yalnız açılışta / cihaz id değişince / kayıt sonrası sıfırlanır. P2-4 (B20): yeni Hik cihaz tipini sabit "Kart Okuyucu" yazma; mevcut cihazda tip korunur, yeni cihazda modelden türetilebiliyorsa türet yoksa raporun önerisini uygula.
2. P3'lerden yalnız davranış değiştirmeyen tek satırlık temizlikleri (ölü kod, etiket sözlüğü eksikleri) yap; diğerlerini dokunmadan raporla.
3. Her P2 için en az bir test (P2-1 için: form kirliyken cihaz prop'u değişir → değer korunur).

## Kurallar
- TypeScript strict; `any`/`as any` YASAK; `unknown` + narrowing; `!` yerine erken return. UI metinleri Türkçe, cümle düzeni.
- Ownership: src/pages/Devices.tsx · src/components/devices/** · src/components/access-control/EditDoorDialog.tsx · ilgili testler. convex/** ve mobile/** YASAK.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, git stash/checkout/reset.

## Kapılar (kendin koş, sayıyla raporla)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (başlangıç 2430) · `npm run build` → OK

## Rapor
`worker_done` ≤10 satır: P2-1…P2-6 → file:line, yapılan/bırakılan P3'ler, yeni test sayısı, kapı sayıları.

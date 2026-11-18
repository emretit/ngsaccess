# Spec — Ölü durum değerleri (Dalga 3c uygulaması)

Hedef: Dalga 3c raporundaki 7 bulgu uygulanır; tsc 0, eslint 0 hata, hedefli testler yeşil, `node scripts/find-node-leak.mjs` temiz.

Okunacak: `docs/audits/2026-11-14-implicit-state-machines/dalga3c-olu-degerler.md` (her bulgunun dosya listesi ve yorum metni orada), `convex/_generated/ai/guidelines.md`, `CLAUDE.md`.

Canlı sayım (2026-11-18, koordinatör yaptı): doors 17 satır hepsi status=active; readers 17 satır hepsi active; accessTransfers 0 satır; leaveBalances 0 satır; chatConversations 0 satır. → Migration GEREKMEZ, doğrudan daralt/kaldır.

## İşler
1. A-06: `doors.status` ve `readers.status` → schema `v.optional(v.union(v.literal("active"), v.literal("inactive")))`. Bu alanı yazan create/update mutation argümanları da aynı union'la sınırlanır. Okuma tarafındaki fallback korunur. Alan ZORUNLU YAPILMAZ. Web formu bu alana başka string gönderiyorsa onu da union'a uydur.
2. A-07: `accessTransfers.kind` union'dan `ide_panel`, `status` union'dan `requested` çıkar (convex/schema.ts:549-550). Bu literal'lere başvuran kod/test varsa temizle (yazar yok raporu doğrula).
3. A-08: `convex/schema.ts` + `convex/hikBridge.ts` lastSeenAt/lastClientInfo/claimedBy yorumları (rapordaki metin).
4. B-06: `leaveBalances` tablosunu kaldır: schema + `convex/lib/adminGuards.ts` + `convex/orphanGuards.test.ts` + `convex/adminSettingsGuards.test.ts` ve başka referans. İzin talebi/onay tablolarına dokunma.
5. B-07: `employeeConsents.consentType` legacy yorumu (rapordaki metin). Değer çıkarılmaz.
6. C-07: biyometri varsayılanı schema yorumu (rapordaki metin). Davranış değişmez.
7. C-08: `chatConversations` tablosunu kaldır: schema + adminGuards + `convex/projects.ts` eski yorum + `convex/adminSettingsGuards.test.ts`. Web sohbet hook'larına DOKUNMA.

## Ownership
`convex/schema.ts`, `convex/hikBridge.ts`, `convex/lib/adminGuards.ts`, `convex/projects.ts`, `convex/orphanGuards.test.ts`, `convex/adminSettingsGuards.test.ts`, doors/readers create-update dosyaları (grep ile bul) ve bunların testleri, A-07 literal'lerine başvuran dosyalar. Bunların dışında dosya değişecekse önce `ask`.
DOKUNMA: `src/components/shifts/**` (başka oturumun commit'lenmemiş işi var), `convex/_generated/**` elle düzenlenmez.

## Kapılar (sen koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/eslint src convex` → 0 hata
- Hedefli vitest: değiştirdiğin test dosyaları + `npx vitest run convex/orphanGuards.test.ts convex/adminSettingsGuards.test.ts` + doors/readers/accessTransfers testleri. TAM vitest KOŞMA (RAM); koordinatör koşar.
- `node scripts/find-node-leak.mjs` → temiz

## Yasaklar
`git add` / `git commit` / `git push` / `git stash` / `git checkout` YASAK. Deploy, `npx convex dev`, `npx convex run`, migration, DB yazma YASAK. Yeni worktree açma.

## Rapor
`worker_done` ≤10 satır: bulgu başına dosya:satır + kapı sonuçları (sayılarla).

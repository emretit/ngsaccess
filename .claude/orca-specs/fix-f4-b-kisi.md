# FAZ 4-B — Kişi: eski fotoğraf dosyası silinsin (K-05) + liste/cascade verimi (K-08) + kişi silmede QR token'ları (B-01 cascade kısmı)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB). Rapor: `/tmp/fix-f4-b-kisi-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` K-05, K-08, B-01 · `M1-kisi-erisim.md`.

## Hedef (test edilebilir)
Kişi fotoğrafı değişince/kaldırılınca/kişi silinince eski `photoStorageId` dosyası (başka kayıt kullanmıyorsa) storage'dan silinir; `employees.list` izinleri kişi başına değil sorgu başına bir kez hesaplar; kişi silme cascade'i büyük geçmişte tek transaction'a sığmayan işi sayfalara böler; kişi silinince `checkInTokens` temizlenir.

## Ownership
`convex/employees.ts` (yalnız fotoğraf patch yolu ~313-317 ve `list` ~89-127), `convex/lib/employeeCascade.ts`, `convex/files.ts` (yalnız gerekirse yardımcı), ilgili testler + yeni `convex/fixF4People.test.ts`.
DOKUNMA: `convex/crons.ts`, `convex/retention.ts`, `convex/employeeCheckIn.ts`, `convex/emailVerification.ts`, `convex/schema.ts` (F4-A) · `convex/http.ts`, `convex/actions/openaiChat.ts`, `convex/alarms.ts`, `convex/biometricDestruction.ts`, `convex/fingerprintEnrollment.ts` (F4-C) ·
`convex/lib/pdks*`, `src/components/reports/**`, `src/lib/reports/**` (başka oturum). Şema değişikliği gerekirse `ask`.

## Değişiklikler
1. **K-05** — fotoğraf değişimi/kaldırma: patch ÖNCESİ eski `photoStorageId` okunsun; patch sonrası başka `employees` kaydı aynı id'yi kullanmıyorsa `ctx.storage.delete`. Cascade (`employeeCascade.ts:~27-35`) `employeeFaces` yanında `photoStorageId`'yi de silsin (aynı paylaşım kontrolü). Ziyaretçi fotoğrafı aynı alanı kullanıyorsa aynı kural.
2. **K-08** — `employees.list` (~89-127): `hasPermission`/`canSeePay` çağrıları döngü dışında proje başına bir kez; döngüde yalnız saf maskeleme. Dönüş shape'i DEĞİŞMEZ (frontend kırılmasın). Sayfalama bu işin kapsamı DIŞI (rapora not).
   Cascade `cardReadings` anonimleştirme (~58-66): tek transaction'da sınırsız patch yerine sayfalı (≤200) + `scheduler.runAfter(0, internal...)` devam; mevcut sonuç (tüm satırlar anonim) değişmez.
3. **B-01 cascade** — kişi silinince o kişinin `checkInTokens` satırları silinsin (index `by_employee` var).

## Kabul (testler)
- Fotoğraf değişince eski dosya silinir; başka kayıt aynı dosyayı kullanıyorsa silinmez; kaldırma ve kişi silme de siler.
- `list` aynı çıktıyı verir (mevcut testler yeşil), izin sorgusu sayısı kişi sayısından bağımsız (mock sayaçla test).
- 450 okumalı kişi silinince tüm satırlar anonim (sayfalar zinciri tamamlanınca); token'lar silinir.
- Kapılar (fix-ortak.md) + `vitest run convex/employees*.test.ts convex/fixF0People.test.ts convex/fixF4People.test.ts convex/payVisibility*.test.ts convex/roles.people*.test.ts` + `employeeCascade` testleri.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.

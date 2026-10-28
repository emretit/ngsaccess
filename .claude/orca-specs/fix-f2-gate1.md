# FAZ 2 KAPI-1 — tam vitest'te 4 kırmızı (temiz export: HEAD + .claude/pathspec-sistem-audit-f2.txt)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU. Rapor: `/tmp/fix-f2-gate1-rapor.md`. Tam çıktı: `/tmp/sa-gate-f2/vitest.txt`.
Ownership: `.claude/pathspec-sistem-audit-f2.txt` içindeki dosyalar + aşağıdaki 4 test dosyası. Diğer dosyalar YASAK (başka oturumun PDKS WIP'i var).

1. `convex/deviceCenter.test.ts` "preserves IDE results..." → **GERÇEK HATA**: `Validator error: Unexpected field expiresAt` — F2-A web openDoor'a `expiresAt` ekledi ama
   kuyruğa yazan (internal) mutation'ın validator'ı bu alanı kabul etmiyor → canlıda web'den IDE kapı açma ÇÖKER. Validator'a/şemaya uygun ekle (payload içinde mi ayrı alan mı —
   `convex/schema.ts` idePendingOperations'a bak; şema değişikliği gerekiyorsa yalnız opsiyonel alan ekleyebilirsin ve rapora yaz). Test yeşil + web openDoor için uçtan uca test ekle.
2. `convex/lib/privacyFixes.test.ts` "retry adayından sonra kapı kapanırsa..." → `Cannot read properties of undefined (reading 'length')` (F2-B retry değişikliği). Kod mu
   (eksik alan/null) mock mu yanlış, karar ver; kod hatasıysa kodu düzelt.
3. `convex/lib/visitorStatus.test.ts` "expiry cron..." → `membershipQuery.take is not a function` (F2-C değişikliği sonrası). Mock güncellemesi mi, kod mu — karar ver.
4. `src/components/devices/useDeviceCommands.test.tsx` → F2-B manuel taramaya varsayılan `startTime` ekledi; beklentiyi yeni sözleşmeye güncelle.
Kabul: bu 4 dosya + `convex/ideSync.test.ts`, `convex/fixF2*.test.ts` yeşil; tsc/eslint/leak temiz.

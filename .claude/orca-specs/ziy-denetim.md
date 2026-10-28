# Ziyaretçiler audit düzeltmesi — çapraz denetim (salt okuma)

## Hedef
4 Codex worker'ın (W1 kart yakalama, W2 backend+sayfa, W3 form, W4 saklama) değişikliklerini denetle. Bulguları `docs/ui-audit-ziyaretci/review.md` dosyasına yaz. Kod DEĞİŞTİRME.

## Kapsam
Taban HEAD d2530e68. Denetlenecek diff: `git diff -- $(cat .claude/pathspec-ziyaretci-audit.txt)` + o listedeki untracked yeni dosyalar (`git status --short`). `convex/deviceSyncRuns.ts`, `convex/lib/deviceSyncRun.test.ts`, `src/components/access-control/**`, `mobile/**` başka oturumun; denetleme.
Bağlam: `docs/ui-audit-ziyaretci/00_RAPOR.md`, `.claude/plan-ziyaretci-audit.md` (Kararlar bağlayıcı), spec'ler `.claude/orca-specs/ziy-ortak.md`, `ziy-w1-kart.md`, `ziy-w2-backend.md`, `ziy-w3-form.md`, `ziy-w4-saklama.md`. Koordinatörün worker'lara verdiği ek kararlar:
- schema'ya `by_project_visitor_active_expiry` index'i eklendi; W2 `nextExpiry`'yi bununla sınırlı buluyor, taşmada `nextExpiryScanLimited`, periyodik sorgu yok.
- W4: `removeEmployeeRecord` / `cascadeRemoveEmployeePII` null sistem aktörü kabul ediyor. Tarama mutation'ı her ziyaretçi için ayrı `removeRetainedVisitor` planlıyor; bu mutation koşulları yeniden doğruluyor ve idempotent.

## Kontrol et (öncelik sırası)
1. **Veri güvenliği (W4):** Ayar boşken HİÇBİR şey silinmiyor mu? Aktif, ön kayıt (bitişi gelecekte), başka proje ve süresi dolmamış kayıt korunuyor mu? Eski TR duvar saati / ofsetli `accessExpiresAt` değerleri yanlış silmeye yol açıyor mu? Null aktör mevcut 4 çağıranın davranışını değiştirdi mi (`employees.ts`, `employeeTermination.ts`, `visitors.ts`)? KVKK zinciri (rıza iptali, `revokedBy` vb.) null aktörde şema ihlali yapıyor mu? Zincir sınırı, scheduler maliyeti ve hata durumunda sonsuz yeniden planlama var mı?
2. **Yetki (W2 Z-O6, W1, W3 visitorHosts):** `listPage`/`summary`/`getDetail` `visitors.manage` ∨ `reports.view` dışında ret veriyor mu? super_admin? Telefon/not/amaç maskesi her dönüş yolunda (liste satırı, ayrıntı, form ön doldurma) tutarlı mı? Maskeli değer düzenleme formunda kaydedilince gerçek veriyi `null` ile EZİYOR mu (W3 formu `getDetail`'den doldurur)? Bu kritik: "okuma gate'i yazma gate'iyle eşleşmezse boş=temizle wipe" geçmiş hatası var. `visitorHosts` ve yeni kart yakalama mutation/sorgusu proje kapsamı + yetki kontrollü mü?
3. **Doğruluk:** Z-Y1 pasife alma `checkedOut` + formda aktif kayıtta `isActive:false` gitmiyor. Z-O1 sunucu zamanı: `createdAt` gerçekten her okuma insert'inde var mı (`processCardReadingCore.ts`, `cardReadings.ts:825`, `virtualReaders.ts`)? by_device + `_creationTime` taramasında 50 sınırı makul mü? Z-O2: aktif ziyaretçi / personel kartı asla yakalanmıyor; BatchCardAssign davranışı değişmedi. Z-O3 Hik model çözümü. Z-O5: boş-bitmemiş sayfada "daha fazla tara", sayaç "+" gösterimi, `useVisitorClock` sözleşmesi.
4. **Regresyon:** 2026-10-19 düzeltmeleri (sunucu filtre, dört sayaç, sentetik e-posta gizleme, Erişim üstte), mobil ziyaretçi akışı (`convex/mobileVisitors.ts` + `canAssignVisitorPreset` aktivasyonu), satır tıklama.
5. **Kurallar:** CLAUDE.md (any yok, `!` yok, camelCase). Node modülü sızıntısı: `node scripts/find-node-leak.mjs` varsa koş. Testler davranışı sınıyor mu, yoksa yalnız mock'u mu?

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`, `node_modules/.bin/eslint src/components/visitors convex/visitors.ts convex/visitorHosts.ts convex/cardReadings.ts convex/privacyRetention.ts convex/lib/visitorRetention.ts`, `node_modules/.bin/vitest run src/components/visitors convex/visitorsAudit2.test.ts convex/visitorCardCapture.test.ts convex/visitorHosts.test.ts convex/lib/visitorRetention.test.ts convex/retention.test.ts convex/privacyRetention.settings.test.ts convex/cardReadings.readingAccess.test.ts`.

## Yasaklar
Kod veya dosya değiştirme (yalnız rapor dosyası). `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, push, deploy, `npx convex` YASAK. Tarayıcı kullanma.

## Rapor
`docs/ui-audit-ziyaretci/review.md`: en üstte karar (Geçti / Düzeltme gerekli) + kapı sonuçları; sonra tablo: ID | önem (Engel/Önemli/Küçük) | worker (W1-W4) | dosya:satır | sorun | öneri. worker_done ≤10 satır, `--report-path` ile rapor yolu.

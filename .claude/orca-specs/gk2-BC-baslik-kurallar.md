# GK2-BC — Geçiş Kontrol ortak sayfa başlığı + Kurallar küçük düzeltmeleri

## Hedef (test edilebilir)
/access-control sayfasının en üstünde sitenin ortak `PageHeader`'ı ("Geçiş Kontrol" + "<proje> · <sekme açıklaması>") durur, sekmeler onun altında olur; sekme içindeki küçük h1'ler kalkar; Kurallar sekmesindeki 5 küçük tasarım farkı (C1-C5) düzelir. `tsc`, `eslint` ve tam `vitest` yeşil.

## Bağlam
- Plan: `.claude/plan-gecis-kontrol-2.md` (Faz B + Faz C). Proje kuralları: `CLAUDE.md` (strict TS, `any` yasak, `!` yerine optional chaining).
- Kalıp: `src/pages/SystemAdmin.tsx:34-55` — `PageHeader` → `Tabs`; sekmenin birincil düğmesi `src/components/admin/hooks/useAdminPrimaryAction.tsx` context'iyle başlığa çıkar. Aynı fikri Geçiş Kontrol için yerel bir hook/context ile kur (Admin dosyalarına dokunma). Render döngüsü olmamalı (effect'te ReactNode/obje set ederken dikkat; Admin'deki gibi `latest` ref + sabit label bağımlılığı).
- `PageHeader` API: `src/components/shared/PageHeader.tsx` (`title`, `scope`, `primaryAction`, `secondaryMenu`, `children`).

## Faz B — ortak başlık
1. `UnifiedAccessControl.tsx`: en üste `<PageHeader title="Geçiş Kontrol" scope={...}>`; scope = `${activeProject?.name ?? "Proje seçin"} · <aktif sekme açıklaması>` (açıklamalar şimdiki sekme `<p>` metinlerinden: Kurallar "Kişilerin hangi kapılardan hangi gün ve saatlerde geçebileceği", Yetki Durumu "Kişi yetkilerinin cihazlara ulaşıp ulaşmadığı", Kapı Planları "Kapıların herkes için sürekli açık ya da kilitli kalacağı saatler" — kısa, cümle düzeni). `RuleSaveNotice` başlığın ALTINDA kalır. Sekmeler (`TabsList`) başlığın altında.
2. Başlık düğmeleri sekmeye göre:
   - Kurallar: "Tüm cihazlara gönder" (outline, C1) + birincil "Yeni kural" (yalnız `canManage && projectId`).
   - Yetki Durumu: "Yenile" (outline) başlığa çıkar; "Liste okundu: …" satırı sekme içinde kalır.
   - Kapı Planları: başlıkta düğme YOK. "Planı kopyala" seçim çubuğu (`DoorPlansTab.tsx:117-129`, yalnız kapı seçilince görünür) sekme içinde kalır, dokunma.
3. Sekme içi `<h1>` + açıklama `<p>` bloklarını kaldır: `AccessRulesList.tsx:40-58`, `status/StatusPage.tsx:68-76`, `door-plans/DoorPlansTab.tsx:90-98` (`heading` değişkeni loading/empty/dolu dallarında kullanılıyor — hepsinden kaldır; boş durumdaki EmptyState metni aynen kalır).
4. Mobil (390px): başlık düğmeleri `min-h-11`; sekmeler yatay kayabilir (mevcut `TabsList` sınıfları kalır).

## Faz C — Kurallar
- C1 `SyncRuns.tsx:249-266` `ProjectSyncButton`: tek seçenekli "Diğer işlemler" menüsü → doğrudan `Button variant="outline"` "Tüm cihazlara gönder"; `disabled` koşulu (`!counts || counts.total === 0 || send.pending`) ve `ConfirmAction` onayı aynen kalır. Test: `ProjectSyncButton.test.tsx` güncelle.
- C2 `rules-list/RulesPage.tsx:73` "Kural durumu" başlığı tek satır: `whitespace-nowrap` + genişlik `w-28` (adı değişmez).
- C3 `RulesPage.tsx:94` `PaginationBar` yalnız birden fazla sayfa varken: `result && (!result.isDone || cursors.length > 1)`.
- C4 `components/RuleBasicInfo.tsx:24` "Kural Adı" → "Kural adı".
- C5 `components/DepartmentTree.tsx`: departmansız (kök seviyedeki) kişinin onay kutusu, departman satırlarındaki kutularla aynı hizada olsun (açma okunun genişliği kadar boşluk). Yalnız hiza; metin ve mantık DEĞİŞMEZ (dinamik departman ayrı iş).

## Ownership (yalnız bunlara yazabilirsin)
- src/components/access-control/unified/UnifiedAccessControl.tsx
- src/components/access-control/unified/AccessRulesList.tsx
- src/components/access-control/unified/SyncRuns.tsx (yalnız ProjectSyncButton)
- src/components/access-control/unified/rules-list/RulesPage.tsx
- src/components/access-control/unified/components/RuleBasicInfo.tsx
- src/components/access-control/unified/components/DepartmentTree.tsx (yalnız C5 hizası)
- src/components/access-control/unified/status/StatusPage.tsx (yalnız başlık/Yenile)
- src/components/access-control/door-plans/DoorPlansTab.tsx (yalnız başlık/üst düğmeler)
- Yeni dosya: src/components/access-control/unified/hooks/useAccessControlHeader.tsx (ya da benzeri tek dosya)
- Bu dosyaların testleri (`*.test.tsx`) + gerekirse `src/components/access-control/unified/audit.test.tsx`, `status/status.test.tsx`

## Kapsam dışı
- `convex/` (hiç dokunma), Admin dosyaları, `src/components/shared/*` (ortak bileşen değiştirme), dinamik departman, Yetki Durumu / Kapı Planları içerik bulguları (ayrı iş), `docs/`.
- Başka oturumların açık değişiklikleri: `mobile/`, `todo.md` — DOKUNMA.

## Kapılar (hepsini koş, çıktıyı rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata
2. `node_modules/.bin/eslint src convex` → `no-explicit-any` 0, yeni error 0
3. `node_modules/.bin/vitest run` (TAM koşu; yalnız değişen dosyalar değil) → 0 fail
4. Orca tarayıcı: kendi sekmeni aç (`orca tab create --url "http://localhost:8081/access-control" --worktree current --json`), HER komutta `--page <id>`; 3 sekmenin masaüstü ekran görüntüsünü al (`orca screenshot --page <id> --json` → `result.path`), `docs/ui-audit-gk/tur2/bc-sonrasi/` altına kopyala, bak. Bitince sekmeni kapat. Veri değiştiren düğmeye BASMA (Yeni kural dialog'u aç → Vazgeç serbest).

## Yasaklar
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, push, deploy ÇALIŞTIRMA. `npx convex *` YASAK. Dev sunucusunu yeniden başlatma.
- Ownership dışındaki dosyaya yazma; gerekiyorsa `ask` ile sor.

## worker_done
≤10 satır: değişen dosyalar (file:line), 3 kapının sonucu (tsc/eslint/vitest sayıları), ekran görüntüsü yolu, açık kalan/emin olunmayan nokta. `--report-path` gerekmez.

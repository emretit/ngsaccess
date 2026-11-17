# GK2-R1 — Codex'in yazdığı Geçiş Kontrol değişikliklerinin denetimi (salt okuma)

## Hedef (test edilebilir)
`docs/ui-audit-gk/tur2/denetim-R1.md` dosyasında aşağıdaki değişikliklerin doğruluk/regresyon denetimi olur: her bulgu önem + file:line + somut hata senaryosu ile. Kod değişmez.

## Ne denetlenecek
Codex worker'ları iki iş yaptı (plan: `.claude/plan-gecis-kontrol-2.md`, spec'ler: `.claude/orca-specs/gk2-BC-baslik-kurallar.md`, `.claude/orca-specs/gk2-D2-kapi-planlari-hizli.md`):
- BC: /access-control en üstte ortak `PageHeader` ("Geçiş Kontrol" + proje · sekme açıklaması), sekmeler altında, sekme içi h1'ler kaldırıldı; sekme düğmeleri başlığa `useAccessControlHeader` hook'uyla çıkıyor; "Diğer işlemler" menüsü → "Tüm cihazlara gönder" düğmesi; "Kural durumu" tek satır; sayfalama yalnız çok sayfada; "Kural adı"; departmansız kişi kutusu hizası.
- D2: Kapı Planları plan hücresi satır tıklaması, kapsam metni + boş durum "Cihazlara git", cümle düzeni etiketleri, mobil son kart çerçevesi, tatil takvimi bağlantısı.

Dosyalar (`git diff -- <dosya>` ile oku; DİKKAT: aynı dosyaların bazılarında BAŞKA oturumların değişiklikleri de var — aşağıdaki nota bak):
- src/components/access-control/unified/UnifiedAccessControl.tsx
- src/components/access-control/unified/hooks/useAccessControlHeader.tsx (yeni, untracked → `cat`)
- src/components/access-control/unified/AccessRulesList.tsx
- src/components/access-control/unified/SyncRuns.tsx (yalnız ProjectSyncButton)
- src/components/access-control/unified/rules-list/RulesPage.tsx
- src/components/access-control/unified/components/RuleBasicInfo.tsx
- src/components/access-control/unified/components/DepartmentTree.tsx
- src/components/access-control/unified/status/StatusPage.tsx (yalnız `useAccessControlHeader("Yenile", ...)` ve h1 kaldırma kısmı)
- src/components/access-control/door-plans/DoorPlansTab.tsx, DoorPlanDialog.tsx
- src/components/access-control/door-dialog/DoorStatusPlanSection.tsx, DoorVerifyPlanSection.tsx
- İlgili testler: ProjectSyncButton.test.tsx, SyncRuns.test.tsx, audit.test.tsx, RulesHeader.test.tsx, status.test.tsx, DoorPlanDialog.test.tsx, CopyDoorPlansDialog.test.tsx

Kapsam DIŞI (başka oturumların işi, bulgu yazma): `CreateRuleDialog.tsx`/test ve `ZoneDeviceTree.tsx` (tek pencere kural formu), `StatusFilters.tsx`, `RedistributeControls.tsx`, StatusPage'deki FilterBar `actions`/`RedistributeMenu` kısmı, `src/components/shared/FilterBar.tsx`, `src/components/ui/table*.tsx`, Ziyaretçiler testleri.

## Bakılacaklar
1. Başlık hook'u: render döngüsü, sekme değişince eski sekmenin düğmesi başlıkta kalıyor mu (cleanup), yetkisiz kullanıcıda (`accessRules.manage` yok) düğme görünüyor mu, proje yokken.
2. Sayfalama koşulu: 2. sayfadayken geri dönülebiliyor mu; `isDone` ile kenar durumları.
3. "Tüm cihazlara gönder": eski disabled koşulu ve onay penceresi korunmuş mu.
4. D2: `details` içindeki tıklama satır diyaloğunu açmıyor mu, hücrenin geri kalanı açıyor mu; klavye (Enter/Space) davranışı; `max-md:last:border!` Tailwind sözdizimi projedeki Tailwind sürümünde geçerli mi (`package.json`).
5. Testler davranışı mı ölçüyor, yoksa yalnız sınıf/metin mi; kaldırılan test kapsamı var mı.
6. `CLAUDE.md` kuralları: `any`, `!` non-null, gereksiz tip açma.

## Kapılar (salt okuma; koşabilirsin)
- `node_modules/.bin/vitest run src/components/access-control` (yalnız bu dizin; TAM vitest KOŞMA — makine yüklü)
- İstersen Orca: kendi sekmeni aç (`orca tab create --url "http://localhost:8081/access-control" --worktree current --json`), HER komutta `--page <id>`; tıklama `/tmp/orcaclick.sh <pageId> "<JS>"`. Kaydet/Gönder/Sil BASMA. Bitince sekmeni kapat.

## Yasaklar
Kaynak dosya DEĞİŞTİRME (yalnız rapor dosyası). `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, push, deploy ÇALIŞTIRMA. `npx convex *` YASAK. Dev sunucusunu başlatma/durdurma.

## Rapor (Türkçe, sade)
Üstte 2 cümle sonuç + sayılar (Kritik/Önemli/Düşük). Tablo: ID | önem | file:line | ne yanlış | hangi durumda bozulur | öneri. Kanıtsız bulgu yazma. Sonda "Sorunsuz bulunanlar" kısa liste.

## worker_done
≤10 satır: Kritik+Önemli bulgular (file:line) + rapor yolu. `--report-path docs/ui-audit-gk/tur2/denetim-R1.md`.

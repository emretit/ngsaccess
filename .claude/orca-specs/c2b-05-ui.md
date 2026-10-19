# C2b W-05-ui — 05 Geçiş Kontrol sayfası A2 (frontend) + ACC-1B/1C kuralları
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) oku. Hedef: `docs/ui-scan/pages/05-gecis-kontrol/REPORT.md` (tüm "Yeni tasarım"
bölümü: bilgi mimarisi, kural editörü kararı, "Cihazlara gönder: dürüst kapsam ve sonuç", durum metinleri, 390px) + `mockup.html`.
Backend sözleşmesi (TEK kaynak): `.claude/orca-specs/reports/c2b-05-api.md` — deviceSyncRuns.* ve accessRules.listRuleMembers.
Ek bulgular: `docs/ux-audit/02_GECIS_IZLEME_ZIYARETCI.md` UX-1 §1B'nin 05 kısmı (CreateRuleDialog, AccessRulesList, TimeSchedule).

## Hedef (test edilebilir)
`/access-control` A2 düzende: PageHeader (h1 + proje + "Yeni kural") → StatInline → FilterBar → kısa kapsam/tür/durum kolonlu
42px tablo (RuleCard görseli kalkar) → satır menüsü; ayrıntı Sheet'i; üç adımlı kural editörü dirty korumalı; "Cihazlara gönder"
projedeki tüm cihazlara gider ve sonucu çalıştırma bazında dürüst gösterir (Hik "Gönderildi · teslim kanıtı yok", IDE "Cihazda
doğrulandı", atlanan/başarısız ayrı); son çalıştırmalar listesi. 1440/390'da yatay taşma yok; vitest + vite build yeşil.

## İş
1. Liste (`AccessRulesList.tsx`, `src/pages/AccessControl.tsx`): `listSummaries` tüketimi korunur; URL state (q, durum, tür);
   global sayaç YOK ("Bu sayfada N kural"); satıra "Uygulandı" gibi kanıtsız ifade YOK.
2. Ayrıntı (`AccessRuleDetails.tsx`): üyeler `accessRules.listRuleMembers` ile cursor'lı ("Daha fazla yükle"); `membersTruncated`
   ise dürüst not. Kurala ait son gönderim çalıştırması (varsa) özet + "Ayrıntı".
3. Editör (`CreateRuleDialog.tsx`, `components/RuleBasicInfo.tsx`, `TimeSchedule.tsx`, `hooks/useRuleForm.ts`, `UnifiedAccessControl.tsx`):
   üç adım (Temel → Kimler → Nerede/Ne zaman), alan altı hata, `useUnsavedChangesGuard`; seçim listelerinde arama + mevcut
   `selectionHelpers` tri-state mantığı KORUNUR; tüm panel fallback'i ile açık kapı seçimi ayrı gösterilir; priority 0 ve gizli alanlar
   korunur; ziyaretçi üyelikleri değişmez. Kayıt başarısı ile arka plan cihaz gönderim sonucu AYRI mesaj. Kayıt sonrası gönderim
   `deviceSyncRuns.startRuleSync` (rapordaki imza) ile run üretir; mevcut syncWeekPlan/syncIdeRule akışını rapor nasıl öneriyorsa öyle değiştir.
4. Cihazlara gönder: PageHeader ikincil eylemi → ConfirmDestructive benzeri onay (kaç cihaz, marka dağılımı) → `startProjectResync`
   → sonuç Sheet'i (`get({runId})` canlı abonelik): hedef bazlı durum rozeti + sebep; "Son gönderimler" (`listRecent`). Eski
   `backfillAllRulesToDevices` çağrısı sayfadan kalkar.
5. `src/components/sync/DeviceSyncStatusBanner.tsx` (05 sahibi; 02/03/06 tüketir): A2 görünüm; dışa açık props/API GERİYE UYUMLU.
6. `src/hooks/access-rules/**`: GroupMembers/GroupDevicesManager tüketicileri kırılmaz; `UnifiedRuleTable.tsx` kullanılmıyorsa import
   taramasıyla doğrula ve sil (raporda kanıt). Saf mantık (durum etiketi, run özeti metni, filtre) `unified/lib/*.ts` + vitest.

## Ownership
src/pages/AccessControl.tsx · src/components/access-control/unified/** (yeni dosyalar dahil) · src/hooks/access-rules/** (dışa açık
imzalar geriye uyumlu) · src/components/sync/DeviceSyncStatusBanner.tsx · src/types/access-control.ts (yalnız ekleme)

## Kapsam dışı
convex/** (backend bitti; eksik varsa ask) · access-control/{ZoneDoorTree*,*Reader*,*Door*,*Zone*}.tsx (03'ün) · CardReadings* (07'nin) ·
visitors (06) · src/components/ui|shared|layout · src/index.css.

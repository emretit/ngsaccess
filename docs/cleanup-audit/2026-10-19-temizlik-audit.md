# Temizlik / Sadeleştirme Audit — 2026-10-19

## Durum (checklist)

### Faz 0 — Audit (salt-okuma)
- [x] knip taraması (kullanılmayan dosya / export / paket)
- [x] Convex fonksiyon referans taraması (src + convex + mobile/lib + scripts + infra + bridge, 2 tur)
- [x] Çift sistem / eski kalıntı kontrolü
- [x] Rapor

### Faz 1 — Güvenli silme (A katmanı) — 2026-10-19 BİTTİ: commit `b8fce5b` + `0cc8d44`, Convex CANLI (push yok)
- [x] 58 dosya silindi: 56 frontend (ölü UI/hook/util + PDKS eski sohbet kopyaları + Radix toast) + `convex/chatConversations.ts` + `convex/migrations/projectIdBackfill.ts`
- [x] 21 paket kaldırıldı (`collapsible` Ziyaretçiler worker'ı kullanmaya başladığı için geri geldi)
- [x] 43 public Convex fonksiyonu silindi (canlı web `dfd3b4e` + mobil/köprü geçmişinde çağrı yok), kullanılmayan import'lar temizlendi
- [x] Kapılar: tsc 0 · eslint 0 hata / 0 any · vitest 1988/1991 (3 kırmızı = UI audit worker'ının yeni `DeviceCommandCenter.audit.test.tsx`'i, bu temizlikle ilgisi yok) · build OK
- [x] Convex deploy 2026-10-19 21:11:48 TR — temiz worktree `b8fce5b`'den `convex dev --once` (Emre onayı); canlı 442 → 399 fonksiyon, web/mobil kritik fonksiyonlar yerinde. Yan etki: çalışma ağacından yapılan `codegen` (startPush) ile hazırlanmış 5 commit'lenmemiş index (accessRules ×3, employees ×2) düştü; canlı kod kullanmıyordu, ilgili dalga yayınlanınca yeniden kurulur
- [x] `0cc8d44`: api.d.ts commit'lenmemiş modül referanslarından arındırıldı
- [x] Commit — yalnız temizlik dosyaları + 05 worker'ının 5 ölü erişim-kontrol silmesi; temiz HEAD worktree'de tsc 0 · vitest 1838/1838 · build OK · sonner toast tarayıcıda doğrulandı

### Faz 1 dışında bırakılanlar (bilerek)
- `convex/actions/hikGatewayDevice.ts`: `refreshGatewayDeviceStatus`, `pingHikGateway`, `captureFaceFromDevice` — gateway kodu bugün aktif (608f628), geri alındı
- `ideDefaults.get/upsert` — MQTT varsayılanlarını düzenlemenin tek yolu (UI 2026-06-10'da silindi)
- 21 fonksiyon worker sahipliğindeki dosyalarda: accessRules (4), cardReadings (2), employees (2), leaves (4), settings (3), shifts (2), users (4)
- `shared/SaveBar.tsx`, `settings/sections/{AdminDashboard.tsx,types/*}`, `shifts/lib/weekUtils.ts` — dalga sahipliğinde

### Faz 2 — Karar gerekenler (B katmanı)
- [x] B2 Lovable: `lovable-tagger` (+60 alt paket) + `LOVABLE_WORKFLOW.md` kaldırıldı, paket adı `ngsaccess`
- [ ] B1 internal fonksiyonlar (seed/migration/debug) · B3 docs görüntüleri · B4 scripts

### Faz 3 — Sadeleştirme (C katmanı)
- [ ] C1 god-file bölme (refactor roadmap Faz 2 ile birleşir)

## Yöntem
- `npx knip@5` (entry: `src/main.tsx`, `convex/**`, `scripts/**`, `tools/**`; vitest dahil). Lazy route import'ları knip tarafından izleniyor.
- Convex: `export const X = query|mutation|action|authed*|admin*|internal*` tanımları; kullanım = `api.mod.X` / `internal.mod.X` / `"mod:X"` (mobil + CLI).
  2. turda knip'in ölü bulduğu dosyalar kaynaktan çıkarıldı → yalnız ölü dosyadan çağrılanlar da yakalandı.
- Sınır: `docs/` içindeki `npx convex run` örnekleri ayrıca tarandı; dinamik referans (`makeFunctionReference`) yalnız testlerde var.

## Özet

| Katman | Ne | Adet | Risk |
|---|---|---|---|
| A1 | Hiçbir yerden import edilmeyen dosya | 64 (~3.800 satır) | Düşük |
| A2 | Kullanılmayan npm paketi | 21 (+1 Radix toast) | Düşük |
| A3 | Hiç çağrılmayan public Convex fonksiyonu | 69 | Düşük (saldırı yüzeyini de küçültür) |
| A4 | Çift bildirim sistemi (Radix toast, hiç çağrılmıyor) | 4 dosya | Düşük |
| B1 | Hiç çağrılmayan internal Convex fonksiyonu | 33 | Karar: bazıları CLI aracı |
| B2-B4 | Lovable kalıntısı, 38 MB docs görüntüsü, tek seferlik scriptler | — | Karar |

## A — Güvenli silme

### A2 — Paketler
- Hiç kullanılmayan (sunucu kodu yok): `express`, `cors`, `@types/express`, `@types/cors`, `nodemon`, `framer-motion`, `@tailwindcss/typography`
- Yalnız ölü UI bileşenlerinin kullandığı: `@radix-ui/react-{accordion,aspect-ratio,collapsible,context-menu,hover-card,menubar,navigation-menu,progress,radio-group,slider}`, `embla-carousel-react`, `input-otp`, `react-resizable-panels`, `vaul`
- A4 ile: `@radix-ui/react-toast`

### A4 — Çift bildirim sistemi
Uygulama bildirimleri `src/lib/notify.ts` → `sonner` ile gösteriyor. Radix toast sistemi (`ui/toast.tsx`, `ui/toaster.tsx`, `hooks/use-toast.ts`, `ui/use-toast.ts`) yalnız `App.tsx`'te `<Toaster />` olarak mount ediliyor, hiçbir yerden `toast()` çağrılmıyor → hepsi + `App.tsx:3,101` silinir.

### Notlar
- `src/components/shared/SaveBar.tsx` ölü (Ayarlar kendi `SettingsSaveBar` adaptörünü kullanıyor); fix2-00 worker'ı bu dosyayı bugün düzenledi, o emek boşa gidiyor. Ya sil ya `SettingsSaveBar`'ı buna bağla.
- `src/components/settings/sections/hooks/useDarkMode.ts` — ikinci `useDarkMode`, export'u kullanılmıyor (asıl: `src/hooks/useDarkMode.ts`).
- 75 kullanılmayan export + 75 kullanılmayan tip var (çoğu shadcn alt bileşeni: `SheetFooter`, `DropdownMenuSub` vb.). shadcn dosyalarına dokunulmaz; diğerleri faz 1'de `export` kaldırılarak temizlenir.
- 5 dosya (`access-control/{AccessControlSidebar,GroupDevicesManager,GroupMembersManager,UnifiedAccess,ZonesAndDoors}.tsx`) audit sırasında Dalga 2 worker'ı tarafından zaten silindi.
- PDKS AI sohbeti CANLI (`PDKSRecords.tsx:387`); yalnız eski kopya dosyaları ölü.

### A1 — Kullanılmayan dosyalar (64)

shadcn UI bileşenleri (19): `accordion.tsx`, `alert.tsx`, `aspect-ratio.tsx`, `breadcrumb.tsx`, `calendar.tsx`, `carousel.tsx`, `collapsible.tsx`, `context-menu.tsx`, `drawer.tsx`, `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `slider.tsx`, `use-toast.ts`

Diğer (45):
- `src/components/access-control/AccessControlSidebar.tsx`
- `src/components/access-control/GroupDevicesManager.tsx`
- `src/components/access-control/GroupMembersManager.tsx`
- `src/components/access-control/UnifiedAccess.tsx`
- `src/components/access-control/ZonesAndDoors.tsx`
- `src/components/devices/DeviceFormButton.tsx`
- `src/components/devices/DevicesHeader.tsx`
- `src/components/devices/form-fields/DeviceAccessInfo.tsx`
- `src/components/devices/form-fields/DeviceAdditionalInfo.tsx`
- `src/components/devices/form-fields/DeviceBasicInfo.tsx`
- `src/components/devices/form-fields/DeviceLocationInfo.tsx`
- `src/components/devices/form-fields/DeviceNetworkInfo.tsx`
- `src/components/employees/FormFields.tsx`
- `src/components/pdks/AiChatPanel.tsx`
- `src/components/pdks/AiDrawer.tsx`
- `src/components/pdks/AiInsightsCard.tsx`
- `src/components/pdks/AiMessage.tsx`
- `src/components/pdks/PDKSInlineQuery.tsx`
- `src/components/pdks/chat/AiChatInput.tsx`
- `src/components/pdks/chat/AiModelStatus.tsx`
- `src/components/pdks/chat/OpenAiKeyInput.tsx`
- `src/components/pdks/chat/constants.ts`
- `src/components/pdks/chat/useAiChat.ts`
- `src/components/pdks/chat/useModelStatus.ts`
- `src/components/pdks/chat/utils/debugUtils.ts`
- `src/components/settings/sections/AdminDashboard.tsx`
- `src/components/settings/sections/types/generalSettings.ts`
- `src/components/settings/sections/types/index.ts`
- `src/components/shared/SaveBar.tsx`
- `src/components/shared/StatCard.tsx`
- `src/components/shifts/lib/weekUtils.ts`
- `src/hooks/access-rules/useAccessRulesQuery.ts`
- `src/hooks/access-rules/useGroupDeviceMutations.ts`
- `src/hooks/access-rules/useGroupMemberMutations.ts`
- `src/hooks/useAccessRules.ts`
- `src/hooks/useCardReadings.ts`
- `src/hooks/useDeviceForm.ts`
- `src/hooks/useLocationUtils.ts`
- `src/hooks/useMailSettings.ts`
- `src/hooks/usePdksChartData.ts`
- `src/hooks/useProjectFilteredCardReadings.ts`
- `src/utils/dashboardUtils.ts`
- `src/utils/deviceTypeMapping.ts`
- `src/utils/reportsExport.ts`
- `src/utils/sgkExport.ts`

### A3 — Hiç çağrılmayan public Convex fonksiyonları (69)

- `convex/accessRules.ts`: addGroupMember, removeGroupMember, addGroupDevice, removeGroupDevice
- `convex/actions/hikGatewayDevice.ts`: refreshGatewayDeviceStatus, pingHikGateway, captureFaceFromDevice
- `convex/actions/hikvisionSync.ts`: syncWeekPlanToDevices, backfillAllRulesToDevices
- `convex/actions/ideGatewayDevice.ts`: syncRuleToIdePanelsAndWait
- `convex/actions/openaiChat.ts`: status
- `convex/auditLog.ts`: distinctTargetTables, filterUsers
- `convex/cardReadings.ts`: getRecentByProjects, getPdksChartData
- `convex/chatConversations.ts`: save, list
- `convex/companies.ts`: create, update, remove
- `convex/dashboard.ts`: getPdksStats, getPdksDashboardWidgets, getCurrentlyInside
- `convex/deviceEvents.ts`: listForDevice
- `convex/devices.ts`: registerUnassignedPanel, listClaimable
- `convex/employeeConsents.ts`: hasActiveConsent
- `convex/employeeFaces.ts`: getByEmployee, generateUploadUrl, addFace, removeFace
- `convex/employeeFingerprints.ts`: listByEmployee, addFingerprint, removeFingerprint
- `convex/employees.ts`: checkDuplicate, bulkUpdateStatus
- `convex/files.ts`: saveEmployeePhoto
- `convex/hikvisionSync.ts`: debugSyncChain
- `convex/holidays.ts`: upsertOvertimeRates
- `convex/ideDefaults.ts`: get, upsert
- `convex/leaves.ts`: list, approve, reject, getBalances
- `convex/migrations/projectIdBackfill.ts`: countOrphans, backfillToProject
- `convex/pdksRecords.ts`: removeManual, getManualForEmployeeDate, listAuditForRecord
- `convex/positions.ts`: create, remove
- `convex/readers.ts`: list
- `convex/settings.ts`: getMail, upsertMail, upsertWork
- `convex/shifts.ts`: assignShift, bulkRemoveAssignment
- `convex/userPreferences.ts`: remove
- `convex/userProjects.ts`: getProjectIdsForCurrentUser, assign, remove, getAll, getByProject
- `convex/users.ts`: getProfile, isSuperAdmin, updatePhoto, setupUser
- `convex/zones.ts`: update

### B1 — Hiç çağrılmayan internal Convex fonksiyonları (33)

- `convex/actions/hikDebug.ts`: dumpEndpoint, testWeekPlanPush, testCardPush, upsertPersons, testFullSync
- `convex/actions/ideGatewayDevice.ts`: deleteEmployeeFromIdePanels
- `convex/actions/setPassword.ts`: adminSetEmployeePassword
- `convex/adminDevices.ts`: updateLastSeen, markAssigned, markReleased
- `convex/deviceSyncRuns.ts`: refreshTarget
- `convex/devices.ts`: getByIdeUuid, setIdeUuid, markIdeOnline, getPanelDoorByIo, getEmployeeCardNumber
- `convex/employeeAuth.ts`: wipeLegacyHashes
- `convex/employees.ts`: setProjectId, adminInspectByEmail
- `convex/ideSync.ts`: seedPanelUsers
- `convex/invites.ts`: adminListByEmail, adminDeleteByEmail
- `convex/maintenance.ts`: clearDeviceSyncQueue
- `convex/migrations.ts`: backfillDoorDeviceId, cleanupOrphanPanelZones
- `convex/privacyRetention.ts`: getAssistantPrivacy
- `convex/readers.ts`: backfillReadersFromDoors
- `convex/seedCardReaderTest.ts`: run
- `convex/seedTestCardAccess.ts`: setupCardAndDevice
- `convex/userProjects.ts`: adminListByUser
- `convex/users.ts`: setRoleByEmail, adminDeleteByEmail, adminFindByEmail

## B — Karar gerekenler

- **B1 internal fonksiyonlar**: seed (`seedCardReaderTest`, `seedTestCardAccess`), bitmiş migration'lar (`migrations.*`, `projectIdBackfill`, `readers.backfillReadersFromDoors`), debug (`actions/hikDebug.*` 5 adet), eski IDE HTTP kanalı kalıntıları (`devices.getByIdeUuid/setIdeUuid/markIdeOnline/...`, `adminDevices.*`). Admin e-posta araçları (`users.setRoleByEmail`, `*.adminDeleteByEmail`) CLI'dan elle kullanılıyorsa kalsın.
- **B2 Lovable**: `lovable-tagger` (vite dev eklentisi) + `LOVABLE_WORKFLOW.md`. Lovable artık kullanılmıyorsa ikisi de silinir; `package.json` adı `vite_react_shadcn_ts` → `ngsaccess`.
- **B3 docs**: 40 MB tracked; 38 MB'ı `docs/ui-scan` + `docs/ui-audit-2` PNG'leri. Eski handoff/TODO dosyaları (`SESSION_HANDOFF*.md`, `HIKVISION_TODO_2026-06-23.md`, `GELISTIRME_PLANI.md`, `YAPILACAKLAR_VE_TEST.md`) → `docs/archive/`.
- **B4 scripts**: 25 script; `ide-smart-probe*`, `ide-smart-capture`, `hikvision-curl-discovery` gibi tek seferlik keşif araçları → `scripts/archive/` ya da sil.
- **Tablolar**: 49 tablonun hepsi en az bir yerden kullanılıyor; `chatConversations` ve `mailSettings` yalnız ölü kod yolunda. Tablo silmek veri kontrolü ister → ayrı iş.

## C — Sadeleştirme
- **C1 god-file**: `convex/actions/hikGatewayDevice.ts` (1.195 satır), `convex/actions/hikvisionSync.ts` (1.026), `DeviceCommandCenter.tsx` (674), `AdminProjectsPanel.tsx` (565). Refactor roadmap Faz 2 zaten bunu kapsıyor (ISAPI canlı-verify bekliyor).

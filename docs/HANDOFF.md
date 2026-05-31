# Session Devir Notu — 2026-05-31

Bu oturumda yapılanlar, açık konular ve sıradaki işler. Yeni session buradan devam edebilir.

## Bu oturumda tamamlananlar

1. **Erişim kuralı gün sırası** — `formatWeekdaysAbbr` artık günleri sabit hafta sırasına (Pzt→Paz) sıralıyor; seçim/silme sırasından bağımsız.
   - `src/components/access-control/unified/components/weekdays.ts` (`sortWeekdays`)
   - `src/components/access-control/unified/components/TimeSchedule.tsx` (kaydederken sıralı)

2. **Kapı ağacında Wiegand okuyucuları** — her kapının altında okuyucu alt-satırı: ad + yön rozeti + son okuma + çevrimiçi noktası + düzenle.
   - `convex/schema.ts`: `doors.readerName`, `doors.readerDirection`; `cardReadings.ideIoId` + `by_device_io_time` index
   - `convex/cardReadings.ts`: IDE insert'e `ideIoId` yazılıyor (okuyucu-bazlı son-okuma için şart)
   - `convex/doors.ts`: `update` genişletildi + `readerStatus` query + `directionFromIo`
   - `src/components/access-control/ZoneDoorTree.tsx`, `src/components/access-control/EditReaderDialog.tsx`
   - **Not:** `readerDirection` şu an **görsel etiket**; gerçek erişim-log yönü hâlâ `resolveDirection`'da io0=entry / io1=exit / diğer=toggle.

3. **Kapı adlandırması** — IDE panel kapıları artık hep `Kapı 1..N` (eskiden Giriş/Çıkış/Kapı 3/4).
   - `convex/devices.ts` `defaultDoorName`

4. **UUID ile cihaz ekleme (son kullanıcı)** — IDE Smart varsayılan MQTT; yalnız **UUID** + ad + kapı sayısı. Canlılık şartı yok (panel ilk trigger'da `updateLastSeen` ile canlanır). MQTT'de `registerIdePanel` atlanıyor.
   - `src/components/devices/form-sections/DeviceIdeSmartSection.tsx`, `hooks/useDeviceFormSchema.ts`, `hooks/useDeviceFormSubmission.ts`, `hooks/useDeviceFormLogic.ts`

5. **Super Admin sayfası sadeleştirildi + layout'a taşındı**
   - Koyu gradient/parçacık/sahte stat kartları kaldırıldı, açık tema; `SystemAdmin.tsx`, `AdminDashboard.tsx`, `AdminProjectsPanel.tsx` (de-theme)
   - `/system-admin` artık `<Layout>` altında (sol menü + üst bar). Sidebar'da **"Admin"** öğesi (yalnız super_admin). `App.tsx`, `Layout.tsx`, `AppSidebarNav.tsx` (`superAdminOnly`)

6. **Admin cihaz ekleme akışı** — super_admin cihazı istediği projeye atar: proje seç → marka → form. Tüm markalar.
   - `src/components/admin/AdminDeviceDialog.tsx` (yeni), `AdminDevicesPanel.tsx`
   - `DeviceForm`/`useDeviceFormLogic`'e `projectIdOverride` eklendi (backend: super_admin `getProjectIdsForUser` tüm projeleri döner, ekstra değişiklik yok)

7. **Cihaz Yönetimi listesinde "Proje" kolonu** (opt-in `showProject`) — `DeviceList.tsx`, `DeviceTableRow.tsx`, `AdminDevicesPanel.tsx`

8. **Tek cihaz silme onay dialogu** — `DeviceTableRow.tsx` (AlertDialog). Bulk silme ve proje silme zaten onaylıydı.

9. **İlk super_admin bootstrap** — `emre@ngsteknoloji.com` artık **super_admin**.
   - `convex/users.ts` `setRoleByEmail` (internal; `npx convex run users:setRoleByEmail '{"email":"...","role":"super_admin"}'`)

## Açık bloker'lar (bu oturumun işi DEĞİL — paralel çalışma)

`tsc --noEmit -p tsconfig.app.json` şu an **kırık**, ama benim dosyalarım temiz. Hatalar paralel yürüyen yarım işlerden:

- `src/components/devices/form-sections/DeviceZoneSection.tsx` → `@/types/device`'tan olmayan **`ServerZone`** tipini import ediyor (tip tanımlanmamış).
- `convex/visitors.ts` → `MutationCtx` ve `Id` import edilmemiş, birkaç `q`/`r` implicit any.

Bunlar çözülmeden build/tsc yeşile dönmez. (Ziyaretçiler ve bölge-seçimi özellikleri devam ediyor.)

## Mimari kısıt (önemli)

Convex (bulut) LAN'daki panele ulaşamaz, Hetzner'a SSH atamaz, ham MQTT konuşamaz. Akış: **panel → Hetzner Mosquitto (1883) → ide-mqtt-bridge (poll) → Convex `/ide-bridge/*`**. Panel broker'a bağlandıktan sonra heartbeat → `updateLastSeen`. Otoriter doküman: `docs/ide-smart/NGSACCESS_SYNC_ARCHITECTURE.md`.

## Sıradaki işler (Faz 2 — sadece tasarım yapıldı, kod yok)

NGS admin provizyon otomasyonu: broker'a **per-UUID kullanıcı/ACL** üretimi (mevcut paylaşılan `device` user güvenlik açığını kapatır) + panelin MQTT hedefini ayarlama. Convex doğrudan yapamadığından mevcut **bridge poll/command kanalı** genişletilip "provisioning op" taşınır; ilk broker'a yönlendirme LAN'da kalır (script/agent). Şu an admin "broker'a ekleme" = sadece UUID kaydı + projeye atama (NGS broker'a fiziksel eklemeyi script ile yapar).

## Operasyonel notlar

- **Deploy:** `npx convex dev --once` (NOT `npx convex deploy`). Deployment `notable-tern-4` = DEV ama canlı sistem orada.
- **Lint kapıları:** `tsc --noEmit -p tsconfig.app.json` (0) + `eslint src convex` (`no-explicit-any` 0).
- **Roller:** super_admin / project_admin / project_user. İlk super_admin `/admin-setup` → `initializeAdmin` (ADMIN_SETUP_SECRET) veya `users.setRoleByEmail`.
- Mevcut kullanıcılar: emre@ngsteknoloji.com (super_admin), talip@ngsteknoloji.com (project_admin), emretit@gmail.com (project_user).

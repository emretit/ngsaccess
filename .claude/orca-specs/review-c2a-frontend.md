# Görev: Faz C2a frontend denetimi (SALT-OKUMA) — 02 Kişiler, 03 Cihazlar, 04 Sanal Okuyucular
Repo: /Users/emreaydin/ngsaccess. Codex worker'ları yazdı (spec'ler `.claude/orca-specs/c2-common.md`, `c2a-ppl-ui.md`, `c2a-ppl-ui-fix.md`,
`c2a-devices-ui.md`); 04'ü koordinatör yaptı. Tasarım dili `docs/ui-scan/DESIGN_DIRECTION.md`; sayfa hedefleri
`docs/ui-scan/pages/{02-kisiler,03-cihazlar,04-sanal-okuyucular}/{REPORT.md,mockup.html}`. Bağımsız denetçisin; DİFF'i oku:
`git diff -- src/pages/{Employees,Devices,VirtualReaders}.tsx src/components/{employees,departments,devices} src/hooks/{useEmployees,useEmployeeTable,useDepartments,useDevices,useDeviceFilters,useDeviceTable,useDeviceForm,useZonesAndDoors}.* src/components/access-control/{ZoneDoorTree,ZoneDoorTreePanel,AddZoneDialog,AddDoorDialog,EditDoorDialog,AddReaderDialog,EditReaderDialog,MoveReaderDialog}.tsx`
+ `git status --short src` (yeni dosyalar). HARİÇ: src/components/pdks/**, src/pages/PDKSRecords.tsx, src/hooks/usePdks* (başka worker yapıyor).
Koordinatör ekledi: `src/hooks/useZonesAndDoors.ts` sabit boş diziler (eski sonsuz render döngüsü düzeltmesi), DeviceList sayfa boyutu genişliği,
`src/components/devices/VirtualReader.tsx` silindi. Koordinatörün gerçek oturumla aldığı ekranlar: `/tmp/c2a-shots/0{2,3}-*.png` (1440 + 390) — aç ve bak.
Kişi ayrıntısındaki senkron/geçiş bölümleri henüz deploy edilmemiş `api.peopleActivity.*`'yi çağırdığı için ekranda hata gösteriyor (beklenen).

## Özellikle bak
1. Davranış regresyonu: önceki dalgaların düzeltmeleri korunmuş mu — proje kapsamı/proje değişiminde sıfırlama, URL filtre state'i, görünür seçim
   (`useDeviceTable` + `deviceSelection.test.ts`), kısmi kayıt sonucu, ConfirmDestructive, pending/çift gönderim koruması, nullable patch.
2. Paylaşılan hook sözleşmesi: `useEmployees`, `useDepartments`, `useDevices`, `useZonesAndDoors` başka sayfalarda (Visitors, GroupMembersManager,
   GroupDevicesManager, ZoneDeviceTree, EngineeringDepartment) kırılıyor mu (grep tüketicileri).
3. Formlar: react-hook-form `name`/zod şeması değişmemiş mi; dirty guard (useUnsavedChangesGuard) gerçekten bağlı mı (Escape, dış tık, proje değişimi);
   alan hatası aria; Hikvision/IDE form alanları ve kaydetme payload'ı eskiyle aynı mı.
4. Kişi ayrıntısı: peopleActivity null vs yetki hatası ayrımı, unknown/verified dili ("senkron" iddiası yok), bölüm başına hata sınırı; rıza/biyometri eylemi açılmamış mı.
5. Erişilebilirlik + A2 YASAKLAR: label↔id, ikon düğmesi aria-label, klavye ile ayrıntı, sabit renk/hex/emoji/gradyan/kart-içinde-kart yok, `useToast` yok.
6. CLAUDE.md: any/as any yok, `!` yok, FunctionReturnType.
## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json (PDKS dosyalarındaki hataları sayma) · node_modules/.bin/eslint src · npx vitest run · npx vite build
## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK. Uygulamaya giriş yapma.
## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Canlıya hazır mı: evet/hayır".

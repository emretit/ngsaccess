# Roller W-A — cihaz / erişim / kapı / alarm dönüşümü (backend)

## Hedef
Aşağıdaki dosyalardaki her rol kontrolü INVENTORY.md'deki anahtara (`devices.manage`, `accessRules.manage`, `doors.open`, `alarms.ack`; karar 5-6-7-11) çevrilir; bu dosyalarda `adminMutation|adminQuery|requireAdmin|isManager|project_admin|project_user` kalmaz.

## Ownership (yalnız bunlar + yeni test dosyası)
convex/accessGrantStatus.ts · convex/accessScheduleTemplates.ts · convex/actions/hikGatewayDevice.ts · convex/actions/hikvisionSync.ts · convex/actions/ideGatewayDevice.ts · convex/adminDevices.ts · convex/alarms.ts · convex/deviceSyncRuns.ts · convex/devices.ts · convex/doors.ts · convex/hikBridge.ts · convex/hikvisionSync.ts · convex/ideDefaults.ts · convex/ideSync.ts · convex/lib/accessRuleWrite.ts · convex/lib/gatewayBackfill.ts · convex/lib/gatewayCommand.ts · convex/lib/gatewayReconcile.ts · convex/readers.ts · convex/zones.ts · bu dosyaların mevcut `*.test.ts` dosyaları (yalnız amaçlı davranış değişikliği için) · YENİ `convex/roles.devices.test.ts`

## Notlar
- Kapı açma komutu → `doors.open` (viewer/security/technician varsayılanda açabilir). Diğer cihaz komutları (reboot, senkron, kapı modu) → `devices.manage`.
- Alarm onay/kapatma → `alarms.ack`; alarm e-posta ayarı/testi → `admin.manage` (karar 7).
- Cihaz sırları (şifre, token) okuma = yazma = `devices.manage` (memory: sır okuma-gate'i yazma-gate ile eşleşmeli).
- `adminDevices.ts` içindeki super_admin platform işlemleri (claim/global cihaz) envantere göre `super_admin` kalabilir.
- SAHİPLİ `convex/accessRules.ts` ve `convex/lib/accessRuleRead.ts`'e DOKUNMA (sonraki mini dalga).

## Kapı vitest
`node_modules/.bin/vitest run convex/roles.devices.test.ts convex/roles.test.ts convex/akisFaz1.authz.test.ts convex/devices*.test.ts convex/deviceCenter.test.ts convex/deviceConnectivity.test.ts convex/alarms*.test.ts convex/accessGrantStatus.test.ts convex/hikRevocation.test.ts convex/hikIsupStatus.test.ts` → yeşil (eşleşmeyen glob'u atla) + son olarak tam `node_modules/.bin/vitest run convex` (yalnız SENİN dosyalarına ait kırmızı olmamalı; dışarıdakini raporla)

## Kabul grep'i
`grep -nE "adminMutation|adminQuery|requireAdmin|isManager\(|project_admin|project_user" <ownership dosyaları (test hariç)>` → 0 satır

Rapor yolu: `docs/roles/report-wa.md`

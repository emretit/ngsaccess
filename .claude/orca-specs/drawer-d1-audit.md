# Drawer D1 denetimi — cihaz komutları backend (SALT-OKUMA)

Sen denetçisin; kodu Codex yazdı. Hiçbir repo dosyasına YAZMA (yalnız rapor: `/tmp/d1-denetim.md`). YASAK: commit, push, deploy, `npx convex *`, DB yazma, git stash/checkout/reset.

## Girdi
- Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/drawer-d1-backend.md` · kaynak denetim `docs/ui-audit-devices-drawer/RAPOR.md` (B2, B3, B6, B19)
- Değişiklik: `git -C /Users/emreaydin/ngsaccess diff -- convex src` + yeni `convex/deviceCenter.test.ts`. Taban main `4e2ef07`. `mobile/**` başka ekibin, inceleme dışı.
- Emre kararı: project_user YALNIZ kapı açar (`remoteOpenDoor`, `openIdeDoor`); diğer komutlar + cihaz güncelle/sil yönetici.

## Bak (öncelik sırası)
1. **Yetki:** 8 komutta `isManager` kontrolü proje kontrolünden sonra ve audit'ten ÖNCE mi; kapı açma 2'si project_user'a açık mı; `devices.update`/`remove` artık `adminMutation` — `src/` çağıranları (`useLocationForm.tsx:14`, `useDeviceActions.tsx:6`, `useDeviceFormSubmission.ts:39`, `useDevices.ts:21-22`, `useDeviceTable.tsx:29`) project_user için kırılan akış yaratıyor mu (UI gizleme D2'de yapılacak; burada yalnız "hangi ekran project_user'da hata verecek" listesi). `devices.create` hâlâ `authedMutation` — tutarsızlık mı, kapatılmalı mı (çağıranları + UI'da kimin gördüğünü kontrol et).
2. **getOverview:** marka filtresi doğru mu (brand undefined/other cihazlar?); `take(101)` → `{count, capped}`; done/acked okunmuyor; kapı 256 / okuyucu 1024 sınırı (`convex/deviceCenter.ts:105`) gerçek veride kesme riski; `recentEvents` 6 alan; çıkarılan alanları (`online`, `latest`, `hikVerifyMode`, `hikLastCfgAt`, `hikDoorStatusPlan` …) `src/` hâlâ okuyor mu (tsc yakalamayan opsiyonel erişimler dahil).
3. **Audit:** her komut tek kayıt; hata (throw) yolunda kayıt + yeniden fırlatma; summary'de kart listesi YOK (özellikle Eşitlik kontrolü); `recordSystemOperation` silindi — canlı web paketi (71163d0) onu çağırıyor: yayın penceresinde (Convex önce, web ~2 dk sonra) istemci ne görür (`DeviceCommandCenter` hata yakalıyor muydu)? Bu bir yayın sırası notu olarak raporla.
4. **Heartbeat throttle** (`convex/devices.ts:1243` civarı): `lastSeen`/`hikLastSeenAt`'i okuyan TÜM tüketiciler (çevrimiçi eşiği, alarm/arıza üretimi, cron'lar, `src/lib/deviceStatus.ts`) 60 sn gecikmeye dayanıklı mı; boş string `deviceIp`/`hikModel` her heartbeat'te yazmaya yol açıyor mu.
5. **Convex kuralları:** yeni sınırsız `.collect()` yok; `returns` validator'ları; `api.d.ts` değişmedi — internal fn için gerçekten gerek yok mu.

## Kapılar (kendin koş, sayıyla yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run`

## Rapor
`/tmp/d1-denetim.md`: P1 (yanlış davranış/güvenlik) / P2 (kenar durum) / P3 (stil) — file:line + somut senaryo + öneri; ayrıca "D2'ye devredilecek UI notları" bölümü (project_user'da gizlenmesi gereken butonlar/akışlar, ör. `LocationTree.tsx:92` okuyucu ayarı). `worker_done` ≤10 satır: P1/P2/P3 sayıları, en kritik 3, kapı sayıları.

# Drawer D1 denetimi (salt-okuma) — 2026-10-21

**Sonuç:** 8 komut + update/remove rol kontrolü doğru yerde (proje kontrolünden sonra, audit'ten önce); kapı açma 2'si project_user'a açık; audit, throttle ve getOverview spec'e uyuyor. 4 kapı yeşil. Asıl açık: spec'in 8'li listesinin DIŞINDA kalan, hâlâ yetkisiz çağrılabilen 6 Hik action'ı + 3 cihaz-oluşturma mutation'ı.

## Kapılar (kendi koşumum)
| Kapı | Sonuç |
|---|---|
| `tsc -p tsconfig.app.json` | 0 hata |
| `tsc -p convex/tsconfig.json` | 0 hata |
| `eslint src convex` | 0 error, 0 warning |
| `vitest run` | 234 dosya / 2409 test geçti |

## P1 (yanlış davranış / güvenlik)

**P1-1. Emre kararı ("kapı açma dışı her komut yönetici") 6 Hik action'ında uygulanmamış.** `isManager` yok, yalnız proje üyeliği var; project_user doğrudan çağırabilir:
- `convex/actions/hikGatewayDevice.ts:116` `registerDeviceOnGateway` (cihazı gateway'e kaydeder)
- `:258` `removeDeviceFromGateway` (cihazı gateway'den siler — yıkıcı)
- `:293` `refreshGatewayDeviceStatus`
- `:1033` `captureFaceFromDevice` (yalnız `canAccessEmployeeProject` var)
- `:1103` `applyDoorStatusPlan`, `:1239` `applyVerifyPlan` (cihaza kapı/doğrulama planı yazar)
- (`pingHikGateway:333` yetki gerektirmeyen salt-okuma, sorun değil.)

Senaryo: project_user tarayıcı konsolundan `removeDeviceFromGateway({deviceId})` çağırır → cihaz gateway'den düşer, kapılar çevrimdışı olur. Spec'teki 8'li liste bu 6'yı kapsamıyor; boşluk kararda değil, listede.
Öneri: 6'sına da `if (!isManager(ctx.user)) return { ok:false, error:"Bu işlem için yönetici yetkisi gerekiyor" }` (proje kontrolünden sonra). Çağıranlar: `EditDoorDialog.tsx:151-163` (kapı planı), `DeviceHikvisionSection.tsx:27`, `useDeviceFormSubmission.ts:40` — hepsi yönetici ekranı, meşru project_user kullanımı yok.

## P2 (kenar durum)

**P2-1. `devices.create` / `createIdePanel` / `createHikDevice` hâlâ `authedMutation`** (`convex/devices.ts:116, 548, 655`). UI'da "Ekle" menüsü `canManage={isAdmin}` ile gizli (`DevicesContent.tsx:71`), ama sunucu açık: project_user doğrudan çağırıp kendi projesine cihaz ekleyebilir (+ `adminDevices` kaydı oluşur). `update`/`remove` ile tutarsız. Öneri: üçünü `adminMutation` yap (çağıranlar `useDevices.ts:20`, `useDeviceFormSubmission.ts:38,41,42` — hepsi admin formu).

**P2-2. Yayın penceresi (Convex önce, web ~2 dk sonra): eski web paketi (71163d0) YENİ backend'de patlar.** Eski `DeviceCommandCenter` `overview.queues.hikvision.done.count` / `ideSmart.acked.count` okuyor; yeni backend bu alanları döndürmüyor → `undefined.count` TypeError → açık/yeniden açılan drawer çöker (~2 dk). `recordSystemOperation` silinmesi zararsız: eski istemci çağrıyı `try/catch` + `console.warn` içine almıştı (diff'te görülüyor). Tersi daha güvenli: YENİ web eski backend'de çalışır (yalnız `.count` okur, `capped` undefined=falsy; tek kayıp ~2 dk audit yazılmaması). Öneri/yayın sırası notu: **önce web, sonra Convex** (ya da drawer'ı açan kullanıcı yokken yay). Convex-önce'de kabul edilecek risk: kısa süreli drawer hatası.

**P2-3. Audit yazımı hata verirse komut sonucu kaybolur.** `hikGatewayDevice.ts:~85-108` / `ideGatewayDevice.ts:~14-37` `auditDeviceCommand`: komut ZATEN çalıştıktan sonra `recordOperationInternal` fırlatırsa (ör. cihaz tam o anda silindi → "Cihaz bulunamadı") istemci hata görür ama reboot/kapı açma gerçekleşmiştir; catch yolunda da audit'in kendi hatası orijinal hatayı maskeler. Öneri: iki `runMutation`'ı try/catch + `console.warn` ile sar (audit best-effort), orijinal sonucu/hatayı koru.

**P2-4. `getOverview` sınır aşımında tüm drawer'ı kırıyor.** `convex/deviceCenter.ts:105-107` `doors>256 || readers>1024` → `throw`. 257. kapı eklendiği an cihazın komut merkezi tamamen açılmaz (önceden sınırsız `.collect()` ile açılırdı). Gerçekte 256 kapı/1024 okuyucu tek cihazda pratikte yok (Hik 4-8, IDE 4-16 kapı), risk düşük ama davranış "sessiz bozulma" değil "tam kırılma". Öneri: throw yerine `slice(0,256)` + `doorsCapped` bayrağı ya da en azından UI'da anlaşılır hata (D2'de "Cihaz merkezi bilgisi alınamadı" metnine ayrı mesaj).

## P3 (stil / küçük)

- **P3-1.** Başarısız komutta audit'e hata nedeni yazılmıyor (`rawData` boş; test bunu bilerek doğruluyor). Operatör "Kapı aç: başarısız" görür ama nedeni (ör. gateway timeout) göremez. Güvenli bir kısa neden (`result.error` ≤200 karakter; kart no içermeyen) eklemek düşünülebilir.
- **P3-2.** Hata metni tutarsız: action'lar "Bu işlem için yönetici yetkisi gerekiyor", `adminMutation` "Bu işlem için yetkiniz yok" (`convex/lib/customFunctions.ts:61-70`). UI toast'ı ikisini de gösterir; D2'de gizleme zaten çözecek.
- **P3-3.** `DeviceCommandCenter.tsx:~200` `execute(id, _label, run)` — `_label` artık kullanılmıyor, çağıranlar hâlâ geçiriyor (ölü parametre).
- **P3-4.** `remoteOpenDoor` localBridge dalı artık `{ok:true, queued:true}` (önceden `{ok:true}`): web mesajı "Komut sıraya alındı" olur — doğru, ama `mobile/` bu dönüşü parse ediyorsa kontrol edilmeli (mobile inceleme dışı; bilgi).
- **P3-5.** `applyGatewayHeartbeat` (`devices.ts:~1243`): `deviceIp===""` olan cihazda ilk heartbeat'te `changed=true` → yazar ve `deviceIp`'yi `undefined` yapar; sonra kararlı (kendi kendine düzeliyor). `hikModel===""` aynı. Sürekli yazma YOK — doğrulandı, yalnızca not.
- **P3-6.** `getOverview` marka filtresi `device.brand === "hikvision"`; `brand` tanımsız eski Hik cihazlarında kuyruk 0/0/0 görünür (UI `getAdapter` de `brand ?? "other"` kullandığı için tutarlı). Veride brand'siz Hik cihazı varsa sayaçlar hep 0 olur.

## Doğrulanan maddeler (sorun yok)
- **Yetki sırası:** 8 komutta `isManager` proje kontrolünden sonra, `auditDeviceCommand`'dan önce; reddedilen/bulunamayan durumda audit yazılmıyor (test: `deviceCenter.test.ts` "never audits…"). `fetchReaderCfg` reader→door→device çözümünden önce reddediyor.
- **Audit:** her komut tek kayıt; throw yolunda "başarısız" kaydı + yeniden fırlatma; Eşitlik kontrolü summary yalnız sayılar ("cihazda N, eksik M, fazla K"), kart numarası yok (testle doğrulandı); `summary` 2000'e kesiliyor.
- **recordSystemOperation:** `src/`, `mobile/`, `scripts/`, `convex/` içinde başka çağıran YOK (grep); `recordOperationInternal` yalnız iki action dosyasından çağrılıyor. `api.d.ts` değişikliği gerekmiyor (`internal.deviceEvents` modülü zaten kayıtlı; tsc 0).
- **getOverview:** marka filtresi doğru, `take(101)`→`{count:min(n,100), capped}`, `done`/`acked` okunmuyor (proxy'li test `collect` yok + 3 durum doğruluyor), `recentEvents` 6 alan. Çıkarılan alanları `src/` okumuyor: `overview.online`, `hikVerifyMode`, `hikLastCfgAt` vb. yalnız başka sorgulardan gelen tiplerde (`LocationDoorItem.tsx:39` `readers.list` kaynaklı) — tsc 0 ve grep ile `getOverview` tüketicisi yalnız `DeviceCommandCenter`.
- **Heartbeat:** çevrimiçi eşikleri 5 dk (`lib/deviceConnection.ts:1`, `hikQueueWorker.ts:44`, `src/lib/deviceStatus.ts:3`) ve 10 dk (`devices.ts:~1021`, `DEVICE_OFFLINE_MS`) → 60 sn throttle'a dayanıklı (üçte-bir kuralı: <180 sn eşik yok, indirme gerekmedi). `hikOfflineHint` değişimi anında yazılıyor. `localBridge` heartbeat'i (`devices.ts:410`) ayrı yol, throttle'a girmiyor.
- **Convex kuralları:** yeni sınırsız `.collect()` yok (testler hariç); `getOverview`'da `returns` validator'ı önceden de yoktu (yeni sapma değil). `hikOfflineHint` = "Gateway çevrimdışı" (B19 tamam).

## project_user'da hata verecek ekranlar (update/remove artık adminMutation)
UI bu çağrılardan bazılarını henüz gizlemiyor:
- `useDeviceActions.tsx:6` / `useDeviceTable.tsx:29` `devices.remove` → cihaz listesindeki **Sil** (`onDeleteDevice`, `Devices.tsx:handleDeleteDevice`) project_user'a görünür → "Bu işlem için yetkiniz yok".
- `useDevices.ts:21-22` + `useDeviceFormSubmission.ts:39` `devices.update` → cihaz adına tıklayınca açılan **düzenleme paneli kaydet** (`DeviceTableRow.tsx:79` → `onEditDevice`).
- `useLocationForm.tsx:14` `devices.update` → **Konum ata** (`onAssignLocation`) → zone/kapı atama project_user'da hata.
- Gizlenen/zaten güvenli: Ekle menüsü (`canManage`), Havuza al (`onReleaseDevice` isAdmin), LocationTree + butonları (`canManage`).

## D2'ye devredilecek UI notları
1. **DeviceCommandCenter butonları (project_user'da gizle/disable):** Özellikleri tara, Yeniden başlat, Çalışma durumu, Olayları tara, Eşitlik kontrolü, Kart okut, Panel senkronu. YALNIZ "Kapı aç" (Hik `remoteOpenDoor` + IDE `openIdeDoor`) görünür kalır. Rol bilgisi `useProjectAccess().isAdmin` (`Devices.tsx:41`).
2. **`LocationTree.tsx:92`** `fetchHikReaderCfg` ("Okuyucu ayarlarını oku") ve `LocationDoorItem.tsx:~39` "Ayar okundu" satırı → yönetici-only; project_user'da buton gizli, sadece durum bilgisi.
3. **`DeviceTableRow.tsx:79`** ad-tık düzenleme + Sil + "Konum ata" (`onAssignLocation`) → `canManage` ile gizle; project_user için salt-okuma detay (ya da drawer yalnız komut merkezi).
4. **`EditDoorDialog.tsx:151-163`** `applyDoorStatusPlan`/`applyVerifyPlan` (P1-1 kapatılınca yönetici-only olacak) → project_user'da kapı planı bölümü gizli/disable.
5. **Kuyruk sayacı:** `capped` → "100+" zaten uygulandı (`DeviceCommandCenter.tsx:411-420`). "bekliyor" toplamında bir sayaç capped ise "+" ekleniyor; "işleniyor/gönderildi" metinleri D2 kopyasıyla uyumlu olsun. "Tamamlandı/Onaylandı" kutuları kalktı → grid 3 hücre (2 sütun grid'de tek hücre yetim kalır; düzen D2'de gözden geçir).
6. **Yetki hata metni:** action'lar `{ok:false,error}` döner (toast), mutation'lar throw eder — UI ikisini de aynı biçimde göstermeli; ama gizleme sayesinde normalde görünmez.
7. **P2-4:** `getOverview` null/throw durumunda "Cihaz merkezi bilgisi alınamadı" tek mesaj; sınır aşımı için ayrı metin düşünülebilir.
8. **Audit akışı:** istemci artık audit yazmıyor; `execute()`'taki `_label` parametresi ve ölü kod temizliği D2'de yapılabilir (P3-3).

## Öncelik önerisi
1. P1-1'i kapat (6 action × 3 satır, ~10 dk) — D2'den önce.
2. P2-1 (3 mutation `adminMutation`, ~5 dk) ile aynı pakette.
3. Yayın sırasında P2-2 notuna uy: önce web, sonra Convex (ya da kısa drawer hatasını kabul et).

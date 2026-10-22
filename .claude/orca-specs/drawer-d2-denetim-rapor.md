# Drawer D2 denetimi (salt-okuma)

**Sonuç:** P1 yok. Rol gizleme eksiksiz, B1 kapanma düzeltmesi doğru, 5 kapı yeşil. 6 P2 (kenar durum) + 8 P3 (stil/ölü kod) bulundu. Diff'te yaygın prettier yeniden biçimlendirmesi var (DeviceForm, DeviceList, form-sections) → gerçek değişiklikleri gözle ayıklamak zor (P3-1).

## Kapılar (kendim koştum, 2026-10-21)
| Kapı | Sonuç |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 0 hata |
| `tsc --noEmit -p convex/tsconfig.json` | 0 hata |
| `eslint src convex` | 0 error, 0 warning |
| `vitest run` | 237 dosya / **2430 test geçti**, 0 başarısız |
| `npm run build` | OK (yalnız >500 kB chunk uyarısı, eskiden de var) |

## P1
Yok.

## P2
1. **Canlı liste kopyası form `values`'ını sürekli yeniler → yazılmamış düzenleme silinebilir.** [Devices.tsx:131](../Users/emreaydin/ngsaccess/src/pages/Devices.tsx) `selectedDevice` artık canlı `devices` listesinden geliyor (B9 için doğru), ama [useDeviceFormLogic.ts:50-58](../Users/emreaydin/ngsaccess/src/components/devices/hooks/useDeviceFormLogic.ts) `useForm({values})` bu referansa bağlı ve yorumu hâlâ "referans sabit" diyor. Senaryo: admin Hik gateway cihazının Ayarlar'ında IP alanını yazarken ilk heartbeat `deviceIp`/`hikModel`'i dolduruyor (convex/devices.ts:1245-1255) → `buildDeviceFormValues` çıktısı değişir → RHF formu reset eder, yazılan değer gider. Öneri: yalnız `device._id` değişince `values` ver ya da dirty iken gelen değişikliği yoksay; yorumu düzelt.
2. **Sticky "İptal/Güncelle" çubuğu `-bottom-5` (kırpılma riski, tarayıcıda doğrulanmadı).** [DeviceForm.tsx:292](../Users/emreaydin/ngsaccess/src/components/devices/DeviceForm.tsx) `sticky -bottom-5 -mx-5`: sticky ofseti scroll-port'un padding kutusuna göre uygulanır; `p-5` kabın içinde `-20px` çubuğu görünür alanın 20 px altına iter → kaydırma ortasında alt kenar/butonlar kırpılabilir (yalnız en sonda doğru oturur). Öneri: `bottom-0` + çubuğun üstüne `-mb-5` yerine kabın `pb-0` yapılması, ya da gerçek tarayıcıda 390 px ve 1161 px'te bakılsın. Ayrıca bu `-mx-5/-bottom-5` ebeveynin `p-5`'ine gizli bağımlı (DeviceDetailsPanel.tsx:164,177,219).
3. **Çevrimdışı onay metni, kuyruklu taşıyıcıda yanlış.** [DeviceCommandCenter.tsx:63-67](../Users/emreaydin/ngsaccess/src/components/devices/DeviceCommandCenter.tsx) banner IDE/localBridge için "komut kuyruğa alınır" der; ama onay diyalogları (satır 205-207, 225) her markada "Cihaz çevrimdışı; komut başarısız olabilir." ekler. Senaryo: IDE paneli çevrimdışı, "Aç" → banner "kuyruğa alınır", diyalog "başarısız olabilir" → çelişki. Öneri: metni `offlineMessage` ile aynı kaynaktan üret (kuyruklu/kuyruksuz).
4. **B20: Hik tipi gizlendi ama yeni Hik cihazı hep "Kart Okuyucu" kaydediyor; gizli alanda doğrulama hatası görünmez.** [DeviceForm.tsx:230](../Users/emreaydin/ngsaccess/src/components/devices/DeviceForm.tsx) `brand !== "hikvision"`; `useDeviceFormSubmission.ts:110` yeni Hik cihazına `values.device_type` (varsayılan "Kart Okuyucu") yazar → DS-K1T807 gibi yüz terminali yanlış tipte doğar (RAPOR B20'deki tutarsızlık yeni kayıtta sürüyor). Mevcut cihazın tipi ezilmiyor (edit'te kayıtlı değer geri gönderiliyor — iyi). Enum dışı eski değer (örn. null/özel metin) varsa zod hatası alan gizli olduğu için "İlk hatalı alana git" boşa gider. Öneri: modelden tip türet ya da Hik create'te `deviceType` gönderme.
5. **Silinen/havuza alınan cihaz açık drawer'da hayalet olarak düzenlenebilir.** [Devices.tsx:131](../Users/emreaydin/ngsaccess/src/pages/Devices.tsx) `?? devicePanel.device` yedeği, cihaz listeden düşse de eski kopyayı gösterir; `getOverview` null → "Cihaz merkezi bilgisi alınamadı", Ayarlar formu/Güncelle açık. Öneri: ilk açılıştan sonra liste cihazı bulamazsa paneli kapat ya da uyarı ver.
6. **Derin bağlantı: panel açıkken URL başka kimliğe değişirse yok sayılıyor.** [useDeviceDeepLink.ts:13](../Users/emreaydin/ngsaccess/src/components/devices/useDeviceDeepLink.ts) `open` iken return. Senaryo: A açık, adres çubuğundan/dış bağlantıyla `?deviceId=B` → panel A, URL B (tutarsız; kapatınca URL silinir). `replace:true` yüzünden Geri tuşu sayfadan çıkar (bozulma yok). Öneri: open iken id farklıysa B'ye geç (dirty guard ile) ya da URL'yi A'ya geri yaz.

## P3
1. Diff gürültüsü: DeviceForm/DeviceList/useDeviceFormLogic/form-sections tamamen yeniden biçimlenmiş (≈1000 satır); review için kayıt ayrı commit olmalı.
2. [DeviceActionsSection.tsx:107-112](../Users/emreaydin/ngsaccess/src/components/devices/DeviceActionsSection.tsx) "Bu cihaz için desteklenen işlemleri…" dalı ölü: `unsupportedReasons` hiçbir markada boş değil. Ayrıca satır 104 gereksiz `{ <div> }` sarmalı.
3. [DeviceCommandCenter.tsx:190-194](../Users/emreaydin/ngsaccess/src/components/devices/DeviceCommandCenter.tsx) `isAdmin && <>…</>` gereksiz fragment.
4. [deviceStatus.ts:26-29](../Users/emreaydin/ngsaccess/src/lib/deviceStatus.ts) `commandResultMessage` yalnız testte kullanılıyor ve hâlâ "İşlem sonucu alındı" (B10e metni) diyor → ölü kod.
5. Çevrimiçi hesabı hâlâ iki saatte: sürücü `useNow(15_000)` (DeviceCommandCenter.tsx:51), liste `useProjectFilteredDevices` kendi `nowMs`'i (+ ClaimDeviceDialog). Spec "tek useNow"; satır rozeti ile drawer rozeti 15 sn'ye kadar ayrışabilir.
6. Destructive (reboot) yolu: `runConfirmed` hatada `undefined` döner → `ConfirmDestructive` bunu başarı sayıp diyaloğu kapatır (non-destructive diyalog hatada açık kalıyor) — tutarsız. Ayrıca reboot sürerken iki katman `pending` (diyalog Vazgeç 20 sn kilitli).
7. Project_user'da satır onay kutuları + "tümünü seç" hâlâ görünüyor ([DeviceTableRow.tsx:103](../Users/emreaydin/ngsaccess/src/components/devices/DeviceTableRow.tsx)) ama toplu işlem gizli → işlevsiz kontrol.
8. [Devices.tsx:1](../Users/emreaydin/ngsaccess/src/pages/Devices.tsx) import dosya başında boş satırla ayrı; `handleDevicePanelSuccess` sonunda boş satır, fazladan boş satırlar. B10(d): "Kapı kilitlendi/açıldı" olayı hâlâ "Durum" rozeti.

## B1-B22 durum tablosu
| ID | Durum | Not |
|---|---|---|
| B1 | **tamam** | `useDeviceDeepLink.ts` `handled` ref + kapatma `consume`; test URL gecikmesini kapsıyor (`useDeviceDeepLink.test.tsx:30`). URL'den açma, proje değişince kapanma (`DeviceDetailsPanel.tsx:93-95`) sağlam. Yan: P2-6 |
| B2 | **tamam** | Aksiyonlar yalnız `isAdmin`'e (`DeviceCommandCenter.tsx:190`); "Aç" project_user'da kalıyor (`DeviceDoorsSection`), sunucu `remoteOpenDoor`/`openIdeDoor` `isManager` istemiyor (hikGatewayDevice.ts:417, ideGatewayDevice.ts:367). Satır menüsü Sil/Konum ata/ad-tık `canManage`; toplu silme gizli; LocationTree zaten `canManage` ile (`onAction` yok → okuyucu ayarı yok); `EditDoorDialog.tsx:160` plan bölümü `isAdmin` |
| B3 | n/a (D1) | UI tarafı: done/acked/latest/online erişimi kalmadı (grep temiz), 3 hücre grid, `capped` "100+" |
| B4 | **tamam** | "Komut kuyruğu", "Cihaz işlemleri", "Son olaylar" `<details>` dışında; details içinde yalnız özellik taraması |
| B5 | **tamam / P2-2** | Sabit başlık+sekme, `flex-1 overflow-y-auto` gövde, 700 px, `SheetDescription`; sticky çubuk tam genişlik ama ofset riski |
| B6 | n/a (D1) | İstemci audit kalıntısı yok (`recordSystemOperation`, `_label` grep temiz) |
| B7 | **tamam** | `buildDeviceFormValues.ts:72-73` boş; zorunlu doğrulama testli (`deviceFormUx.test.ts`) |
| B8 | **tamam** | Ayarlar salt-okunur (`disabled`, Güncelle/Tehlikeli bölge yok), `DeviceApiTokenCard` yalnız admin, açıklayıcı metin + `aria-describedby` |
| B9 | **tamam / P2-1** | Karar noktaları `overview.device`; başlık canlı. Yan etki: form values yenilenmesi |
| B10 | **kısmen** | Sözlük `deviceLabels.ts` kullanılıyor; cümle düzeni, "Panel senkronu", ortak kuyruk durumu, "kod 1031", "Komut cihaza iletildi" tamam. Eksik: P3-4 eski metin, olay "Durum" rozeti |
| B11 | **tamam** | Reboot `ConfirmDestructive` (ad + "~30-60 sn"); Olayları tara/Kart okut `AlertDialog` onayı (test `DeviceCommandCenter.audit.test.tsx:69`); gateway kaldırma formun altında "Tehlikeli bölge". Bkz. P3-6 |
| B12 | **tamam** | `min-h-11` sekme/form/Kapat; (desktop'ta da form 44 px — kabul) |
| B13 | **tamam** | sr-only `SheetDescription`, kapalı butonlarda `aria-describedby` |
| B14 | **tamam** | Bölge/IP/UUID metinleri tek sözlükte, placeholder "ör. 192.168.1.x", UUID yardımı |
| B15 | **kısmen / P2-3** | Çevrimdışı onay metni var ama kuyruklu markada çelişkili; 20 sn "arka planda sürüyor" + kapatma izni tamam (test `:93`) |
| B16 | **tamam** | Kimlik tekrarı kalktı, "N kapı · N okuyucu", `Copy` ikonlu buton |
| B17 | **tamam** | `onUpdated`, `_filteredDoors`, `makeConfirmed`, `runImmediate`, "Gelişmiş politikalar" yok. Kalan: P3-2/3 |
| B18 | **tamam** | `DeviceCommandCenter` 238 satıra indi; `deviceAdapter/useDeviceCommands/Section*` ayrıldı; action'lar aynı argümanla (`deviceId`, `doorNo`, `doorId`+`keep:1`, `readerId`) çağrılıyor; `formatTrDateTime` + bağlam fallback'i. Tek `useNow` yarım: P3-5 |
| B19 | **tamam** | Sunucu artık "Gateway çevrimdışı" yazıyor (convex/devices.ts:1243), UI olduğu gibi gösteriyor |
| B20 | **kısmen / P2-4** | Seçim: Hik formunda tip alanı gizlendi (modelden türetme yok) |
| B21 | **tamam** | Güncelle sonrası Genel bakış'a dönüş (`DeviceDetailsPanel.tsx:198-201`, test `:185`), `form.reset` ile dirty temizlenir; drawer kapanmıyor |
| B22 | **tamam** | `devices.getById` aboneliği yok (grep); `DeviceHikvisionSection` yalnız form |

## Ek doğrulamalar
- `getOverview` yeni alanları: `queues.*.{pending,processing|sent,failed}.{count,capped}`, `limits.doorsCapped/readersCapped` kullanılıyor; uyarı satırı var (DeviceCommandCenter.tsx:127-131).
- Yıkıcı onaylar çift tıklamaya karşı `useAsyncAction` ile korunuyor; `busy !== null` tüm butonları kilitliyor.
- İnceleme dışı: `mobile/**`, `convex/**` (yalnız karşılaştırma için okundu).

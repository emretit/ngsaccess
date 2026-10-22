# Cihazlar drawer Yol B denetim raporu

Özet: P1 yok (veri kaybı / sır sızıntısı / yetki regresyonu bulunmadı). 4 P2 + 6 P3. Kapılar temiz. Canlı tarayıcı turu YAPILMADI (yalnız kod + test okuması).

## Kapılar (kendim koştum)
- `tsc --noEmit -p tsconfig.app.json` → 0 hata
- `eslint src convex` → 0 çıktı (0 error)
- `vitest run src/components/devices src/components/employees src/pages src/lib` → 70 dosya / 403 test geçti

## Doğrulananlar (sorun YOK)
1. **Değişen-alan payload**: `deviceUpdatePatch.ts` değişmeyen sırları (devicePassword/idePassword/ehomeKey/deviceUsername/ideUser) siliyor; boş sır artık "" ile ezmiyor (eski localBridge wipe riski kapandı). Bilinçli temizleme (localBridge kullanıcı/şifre "", deviceIp/description null, hikModel null) değişince `full` içindeki değerle gidiyor. Transport değişince `required` alanlar gidiyor. Create yolları (`useDeviceFormSubmission.ts` create/createHikDevice/createIdePanel) diff'te dokunulmamış.
2. **Baseline**: `getBaseline = form.formState.defaultValues` (`useDeviceFormLogic.ts:80`). `values` prop'u yalnız `snapshot` değişince değişiyor (deviceId/marka/open); heartbeat baseline'ı kaydırmıyor. Başarıda `form.reset(form.getValues())` yeni baseline kuruyor.
3. **Nav guard / URL**: `useDeviceUrlSync` guard'dan önce yakalanan ham `replace`'i kullanıyor → onaylı kapanış / deep-link restore / proje reset ikinci onay açmıyor (`useDeviceUrlSync.test.tsx` kanıtlıyor). Drawer içi push tek onayla ilerliyor; pending'de engelleniyor.
4. **Taslak kaybı**: X/Esc/dış tık `close → guard.requestClose`; sekmeler `forceMount` ile korunuyor; "geri al" yalnız `form.reset(defaultValues)`; yeni kayıtta `draftBrands` formları mount kalıyor; savedId/connectionError dalı aynen.
5. **Yetki**: project_user "Cihaz ayrıntısı", varsayılan İşlemler, form `disabled`, token + gateway danger `isAdmin` kapılı (`DeviceDetailsPanel.tsx` ~220-231). Gateway danger `<form>` dışına çıkmış, pending drawer kapanışını engelliyor.
6. **Kapanış titremesi**: `projectCache` + `snapshot.values` kapanışta korunuyor; `Devices.tsx:111-120` kapanışta device/projectId'yi silmiyor.

## P2 (kenar durum)
- **P2-1 No-op sessiz**: `useDeviceFormSubmission.ts:219` `Object.keys(patch).length === 1` ise sessizce `return`; toast yok, form kirli + çubuk açık kalıyor. Senaryo: yalnız payload'a girmeyen alan (örn. `new_zone_name`) kirletilirse Kaydet'e basılır, hiçbir şey olmaz. Öneri: `notify.info("Kaydedilecek değişiklik yok")` ya da formu yeni baseline'a çek.
- **P2-2 Odak çalma**: `DeviceDetailsPanel.tsx` ~126-130 effect bağımlılığında `projects` var → `projects.list` canlı güncellenince (başka kullanıcı proje düzenlerse) yeni-cihaz formunda yazarken odak "Cihaz adı"na zıplar. Öneri: odak effect'ini yalnız `step/brand` değişiminde çalıştır (`projects` yerine "form hazır" boolean'ı).
- **P2-3 Sekme/dirty sıfırlanması**: `DeviceDetailsPanel.tsx:~96-107` reset effect'inin bağımlılığına `isAdmin` eklenmiş. `useProjectAccess` açıkken yeniden çözülürse (rol/proje yenilenmesi) `setFormStates({})` + `setTab` çalışır → dirty bayrağı silinir, guard düşer, kullanıcı taslağı onaysız kapanabilir. Öneri: `isAdmin`'i effect'ten çıkar (başlangıç state'i yeter) ya da yalnız `open/deviceId` değişiminde sıfırla.
- **P2-4 Bayat `replace` ref'i**: `useDeviceDeepLink.ts` `useRef(navigator.replace)` yalnız ilk render'da yakalar. Devices, başka bir guard (Kişiler/Ayarlar/LeaveForm) açıkken mount olursa (render, eski sayfanın cleanup'ından ÖNCE) ref sarılmış `replace`'i tutar; bugün eski registry boşaldığı için çalışıyor ama başka guard hayatta kalırsa URL senkronu onay açar. Test yalnız "önce hook, sonra guard" sırasını kapsıyor. Öneri: ref'i `navigator.replace`'in guard-öncesi kanonik hâlinden al (navigationGuard'dan `getRawNavigator` benzeri) ya da testte "guard önceden kurulu" senaryosu ekle.

## P3 (stil / küçük)
- P3-1 `deviceUpdatePatch.ts`: değer-`undefined` anahtarlar (örn. `doorCount`, `ideDoorCount`, gateway'de gizli `hikPort`) alan değişince patch'te kalıyor → `length===1` kontrolünü atlatıp boş mutation + "kaydedildi" toast'ı. Öneri: `undefined` değerleri de patch'ten sil.
- P3-2 `DeviceDetailsPanel.tsx` SheetDescription "Zorunlu alanlar * ile işaretlidir." marka seçici adımında da görünüyor (formda alan yok). Spec yalnız düzenle için.
- P3-3 `useNow(15_000)` panel kapalıyken de çalışıyor (panel hep mount); `open` ile kapatılabilir.
- P3-4 İkinci açılışta `projects` yeniden abone olunca skeleton bir an görünüyor (`projectCache` yalnız `!open`'da kullanılıyor).
- P3-5 `DeviceForm.tsx` embedded modda `connectionError` + "Bağlantıyı tekrar dene" yok; edit yolunda savedId set edilmediği için bugün ulaşılamaz, ama gelecekte sessiz kayıp olur.
- P3-6 Mevcut (önceden var) davranış: kapanıştan sonra tarayıcı geri/ileri ile `?deviceId=X` tekrar gelirse `handled.current===X` olduğu için drawer açılmıyor.

## Test boşlukları
Baseline'ın heartbeat sonrası kaymadığını, no-op geri bildirimini ve P2-4 sırasını kanıtlayan test yok.

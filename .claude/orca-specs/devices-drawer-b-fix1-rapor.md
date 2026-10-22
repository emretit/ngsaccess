# Cihazlar drawer B — düzeltme turu 1 delta denetimi

Sonuç: **P1: 0 / P2: 0 / P3: 1 (test beklentisi tutarsızlığı)**. İncelenen düzeltmelerde işlevsel regresyon bulunmadı. Bu rapor yalnız fix1 spec'indeki deltayı kapsar; önceki rapordaki kapsam dışı maddelerin kapandığı anlamına gelmez.

## Kapılar — bizzat çalıştırıldı

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: exit 0, çıktı yok.
- `node_modules/.bin/eslint src convex`: exit 0, çıktı yok.
- `node_modules/.bin/vitest run src/components/devices src/components/employees src/pages src/lib`: exit 0; **70 dosya / 406 test geçti**.

Kod, ilgili testler ve yerel React Router implementasyonu okundu. Canlı tarayıcı/gerçek gateway denemesi yapılmadı; aşağıdaki canlı güncelleme ve effect değerlendirmeleri kod akışına dayanır. Uygulama koduna müdahale, commit/push/deploy, Convex CLI veya DB yazma yapılmadı; yalnız bu rapor yazıldı.

## Bulgu

### P3-1 — Eski test, kaldırılan undefined anahtarını hâlâ beklenen sonuçta gösteriyor

- **Dosya:** `src/components/devices/hooks/deviceUpdatePatch.test.ts:30-32`.
- **Senaryo:** `deviceUpdatePatch` artık `idePassword: undefined` anahtarını siliyor, fakat "undefined IDE sözleşmesini korur" testi beklenen nesnede hâlâ `idePassword: undefined` içeriyor. Vitest `toEqual` eksik anahtar ile undefined değerli anahtar ayrımını denetlemediğinden test yeşil; okuyana fix1 davranışının tersi bir sözleşme anlatıyor.
- **Etki:** Ürün hatası yok; testin niyeti ve beklentisi güncel davranışla tutarsız. `:34-37` yeni `Object.keys` testi anahtarların silinmesini ayrıca doğru doğruluyor.
- **Öneri:** Bu testin adını "boş localBridge şifresini korur, undefined IDE alanını çıkarır" yapıp `{ deviceId, devicePassword: "" }` sonucunu `toStrictEqual` ile doğrulayın veya `not.toHaveProperty("idePassword")` ekleyin.

## Düzeltmeler ve spec sorularının karşılığı

1. **No-op ve gateway retry:** `useDeviceFormSubmission.ts:218-221,266-285` yalnız kimlik kalan patch için mutation çağırmıyor, buna rağmen gateway koşulunu değerlendiriyor. Kayıt başarılıysa tek başarı bildirimi + tek `onSuccess` ve erken return var; kayıt gerekmiyorsa tek bilgi bildirimi + `onSuccess` var. `useDeviceFormLogic.ts:75-80` başarı callback'inde `form.reset(form.getValues())` baseline'ı yeniliyor.

2. **`changed=false` + kayıt hatası:** `useDeviceFormSubmission.ts:275-276,287-294` hata atıyor; mevcut cihaz yolunda `savedId` set edilmediğinden `connectionError` üretilmiyor. Gerçek `useAsyncAction.ts:23-26` hatayı yakalayıp **tek** `notify.error("Cihaz kaydı veya bağlantı işlemi tamamlanamadı", error)` gösteriyor; ayrıntıda gateway hatası yer alıyor. Başarı/bilgi bildirimi ve `onSuccess` çalışmıyor. Pending bittiğinde temiz embedded formun "Gateway'e bağla" düğmesi geri geliyor; alanlar kalıcı kilitlenmiyor. Otomatik tekrar veya çift toast yok; eşzamanlı submit `useAsyncAction` içindeki guard ile engelleniyor.

3. **Canlı hikDevIndex ve buton:** `DeviceForm.tsx:118-123` koşulunun ilk cihaz kontrolleri doğrudan güncel prop'tan geliyor; watch edilen form alanları da kullanıcı değişimlerini izliyor. `Devices.tsx:122-128` güncel listedeki cihazı `selectedDevice` olarak, `DeviceDetailsPanel.tsx:263-266` bunu forma geçiriyor. Liste aboneliğine `hikDevIndex` geldiğinde form yeniden render olur ve temiz retry düğmesi kaybolur. Yalnız overview sorgusu önce güncellenirse liste de güncellenene kadar kısa gecikme olabilir; bu kalıcı bir buton sorunu değil. Form baseline'ının bağlantı heartbeat'iyle resetlenmesine gerek yok.

4. **Undefined patch temizliği:** `hooks/deviceUpdatePatch.ts:30-34` eşleşen kaynak alanlarıyla birlikte undefined değerli alanları da siliyor; null ve bilinçli boş string korunuyor. Yeni `Object.keys` testi sahte changed durumunu kapsıyor. Yukarıdaki P3 yalnız eski test ifadesine ilişkin.

5. **Rol değişimi ve yeniden açılış:** `DeviceDetailsPanel.tsx:98-112` effect'i rol değişiminde tekrar çağrılsa bile aynı resetKey için erken dönüyor; açık taslak ve dirty korunuyor. Kapanış render'ında key null olarak ref'e yazılıyor; aynı cihazı yeniden açınca key tekrar farklı olup reset çalışıyor. Yeni cihaz → kapat → yeni cihaz akışında da `new:other → null → new:other` gerçekleşip picker, draftBrands ve formStates sıfırlanıyor. Mevcut formun değerleri ayrıca `useDeviceFormLogic.ts:54-62` open geçişinde yenileniyor; yeni cihaz taslak formları draftBrands temizliğiyle kaldırılıyor.

6. **Odak ve açıklama:** `DeviceDetailsPanel.tsx:131-136` effect'i proje listesi nesnesi yerine `formReady` boolean'ını kullanıyor; dolu listenin canlı değişimi odağı yeniden tetiklemiyor. Marka seçicide `:187-191` "Önce cihazın markasını seçin." gösteriliyor.

7. **Proje cache'i:** `DeviceDetailsPanel.tsx:70-75` son tanımlı listeyi saklıyor; yeniden abonelikte undefined aralığı formu skeleton'a döndürmüyor. Yeni cihaz proje etiketi `DeviceForm.tsx:173-176` içinde `currentProjectId` ile `_id` eşleştirerek bulunuyor; önceki projenin adını indis/ilk eleman üzerinden seçmiyor. Yeni proje cache'te yoksa "Seçili proje" fallback'i, varsa o projenin adı gösterilir. Yeniden abonelikten önce aynı projenin eski adı kısa süre görünebilir; başka projenin adını gösteren bir yol bulunmadı. Proje değişince açık eski taslak ayrıca `projectChanged` ile kapanıyor/devre dışı kalıyor.

8. **unguardedReplace ve history origin:** `navigationGuard.ts:84-86` kanonik replace'i çağrı anında registry'den çözüyor; hook guard'dan önce veya sonra mount olsa da ham replace kullanılıyor. Yerel React Router `node_modules/react-router/dist/development/chunk-GR4NQCSD.js:322-331` replace sırasında mevcut `getIndex()` değerini `replaceState`'e taşıyor, navigation delta'sı 0; bu iç URL eşitlemesi guard'ın origin index'ini değiştirmiyor. `navigationGuard.test.ts` back/forward, stacked guard ve pending testleriyle çelişki yok ve hepsi geçti. Yeni `useDeviceUrlSync.test.tsx` guard-önce-hook sırasını ve cleanup sonrasını kapsıyor.

## Doğrulama sınırı / ek test önerileri

İşlevsel hata olarak sınıflandırılmadı: submission testleri gerçek `useAsyncAction` yerine mock çalıştırıyor (`useDeviceFormSubmission.test.tsx:13-16`); dolayısıyla gateway retry hata toast'ının tekliği ve pending sonrası düğmenin geri gelmesi entegrasyon testiyle kanıtlanmış değil. Rol değişiminde dirty koruması, close/reopen reset'i, canlı hikDevIndex ile düğmenin kaybolması ve cache sonrası proje etiketi için gerçek React effect/subscription kullanan rerender testleri de bu pakette yok. Bunların değerlendirmesi yukarıdaki kod izine dayanıyor; canlı UI turu yapılmış gibi yorumlanmamalı.

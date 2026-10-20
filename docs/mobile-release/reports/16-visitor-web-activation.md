# 16 — Mobil ön kaydın web operatör tarafından etkinleştirilmesi

19 Ekim 2026 · Dispatch `ctx_37cf22eb54d9` · Task `task_9139f80531c8`.

## Uygulanan davranış

- Ziyaretçi ayrıntısında, pasif ve henüz bölge/kart atanmamış mobil ön kayıt için **Kart ve erişim ata** işlemi gösterilir. Ön kayıt referansı fiziksel kart gibi maskelenmez veya gösterilmez; **Henüz kart atanmadı** yazılır ve kart iade işlemi sunulmaz.
- Ön kayıt düzenlemesinde erişim bölgesi seçimi açılır. Operatör aktif ve kapısı olan bir ziyaretçi bölgesi seçer; yoksa mevcut bölge oluşturma ekranını açabilir. Diğer ziyaretçi düzenlemelerinde bölge değişikliği kapalı kalır.
- Ön kayıt, iade ve maskeli kart değerleri kart alanını doldurmaz. Gerçek kart okunmalı veya elle girilmelidir. Kart ve bölge, ön kayıt kaydedilirken zorunludur; kart verilmeden veya bölge atanmadan ön kayıt yarım bir atamaya dönüştürülmez.
- **Erişim izni ver** ayrıca operatörün seçimine bağlıdır. Seçildiğinde **Erişimi etkinleştir** düğmesi, seçilmiş bölge + gerçek kart + `isActive:true` değerlerini mevcut `visitors.update` çağrısında birlikte gönderir. Başarı bildirimi backend onayından sonra oluşur; cihaz senkronizasyonu arka plan işlemi olarak anlatılır.
- Süresi dolmuş fakat iptal edilmemiş mobil ön kayıtta bitiş ileri alınarak aynı atama yapılabilir. İptal edilmiş ön kayıtta ilk bölge atama işlemi açılmaz.
- Normal oluşturma, mevcut bölgeyi koruyan düzenleme, geçmiş pasif kayıtlardaki değişmemiş bitişi göndermeme ve nullable alan temizliği korunur.

## Yeniden doğrulanan bulgular ve audit kapsamı

Önceki form her düzenlemede bölge seçimini kilitliyor, güncelleme payload'ı bölge göndermiyor ve `PRE:` kart referansını gerçek kart alanına yerleştiriyordu. Önceki web şeması `PRE:` referansını kart olarak reddetmiyordu. Bu üç engel giderildi.

Bu teslim **MOB-18 / VIS-W05** içindeki mobil ön kayıt → web operatör bölge/kart atama → aktivasyon alt akışını tamamlar. **VIS-F01** kapsamındaki tüm mobil ürün yeteneklerinin veya **VIS-F03 / VIS-W03** donanım doğrulamasının tamamının bu worker tarafından kapatıldığı iddia edilmez; mobil ekran ve backend güvenliği ayrı sahiplerdedir.

## API ve sahiplik sınırı

Backend sahibi `ctx_3c18938f37b2` sözleşmeyi doğruladı: `visitors.update` opsiyonel `presetRuleId: Id<"accessRules">` kabul eder. Sunucu bunu yalnız mobil işaretçisi bulunan, pasif, `visitorStatus:preRegistered`, `PRE:` kartlı ve henüz `accessRuleId` olmayan kayıt için kabul eder; proje/rol/ilişki kontrolü ve bölge üyeliği aynı mutation içindedir. Web, mevcut `getDetail` alanlarından uygun ön kayıt görünümünü türetir; kimlik ve yetki kararını sunucu verir.

Yeni endpoint, dependency, schema, mobil veya generated API değişikliği yapılmadı. Ortak codegen ve genel TypeScript kontrolü koordinatörün sorumluluğundadır. Backend sahibi ayrıca IDE kart biçimini mutation öncesi doğruladığını bildirdi; web tüm okuyucu türlerine sayısal kart zorunluluğu eklemez.

## Bu teslimde değişen dosyalar

- `src/components/visitors/VisitorForm.tsx`
- `src/components/visitors/VisitorFormFields.tsx`
- `src/components/visitors/VisitorSlideOverPanel.tsx`
- `src/components/visitors/hooks/useVisitorFormData.ts`
- `src/components/visitors/hooks/useVisitorFormSchema.ts`
- `src/components/visitors/lib/formPayload.ts`
- `src/components/visitors/lib/preRegistration.ts` — yeni
- `src/components/visitors/visitorActivation.test.tsx` — yeni
- `src/components/visitors/visitorActivationData.test.tsx` — yeni
- Bu rapor.

Önceden kirli dosyalardaki değişiklikler korunarak küçük eklemeler yapıldı; başka sahiplerin backend, mobil, shared veya web dosyaları değiştirilmedi.

## Test ve kontrol kanıtı

Yeni testler yalnız yardımcı fonksiyonu sınamaz: gerçek form submit handler'ı, gerçek submit hook'u ve payload dönüşümü üzerinden mutation sınırını çalıştırır. Başarılı aktivasyondaki kart/bölge/aktif payload'ı, eksik kart/bölge, geçmiş bitiş, `PRE:`/`IADE:`/maskeli kart reddi, erişim vermeden kayıtta zorunlu atama, backend reddinde başarısızlık, backend cevabını bekleme ve çift submit engeli kapsanır. Ayrı render testleri bölge kilidinin doğru açıldığını ve referans kartın gösterilmediğini; gerçek veri hook'u testleri kart başlangıç değerini ve uygun bölge seçeneklerini doğrular.

Çalıştırılan scoped komutlar:

```sh
node_modules/.bin/vitest run src/components/visitors/visitorActivation.test.tsx src/components/visitors/visitorActivationData.test.tsx src/components/visitors/visitors.test.tsx src/components/visitors/visitorAudit.test.tsx
node_modules/.bin/eslint src/components/visitors/VisitorForm.tsx src/components/visitors/VisitorFormFields.tsx src/components/visitors/VisitorSlideOverPanel.tsx src/components/visitors/hooks/useVisitorFormData.ts src/components/visitors/hooks/useVisitorFormSchema.ts src/components/visitors/lib/formPayload.ts src/components/visitors/lib/preRegistration.ts src/components/visitors/visitorActivation.test.tsx src/components/visitors/visitorActivationData.test.tsx
```

Sonuçlar: **4 test dosyasında 39/39 test geçti** (22 yeni regresyon vakası dahil); scoped ESLint **0 hata / 0 uyarı** ile tamamlandı. Değiştirilen tracked dosyalarda `git diff --check` temizdir. Genel TypeScript derlemesi bu worker tarafından çalıştırılmadı; testlerin geçmesi genel TS/build veya tarayıcı E2E kanıtı değildir.

## Açık doğrulama sınırları

- Tarayıcıda gerçek operatör oturumu, gerçek backend ve fiziksel kart/okuyucu/panel ile uçtan uca test yapılmadı. Testlerde sentetik veri ve mutation sınırında test doubles kullanılır; gerçek backend wrapper testleri backend sahibindedir.
- Bu worker deploy, codegen, genel TS/build, Flutter/Dart/SDK veya platform imzalama komutu çalıştırmadı.
- Süresi dolmuş ön kaydın yeniden etkinleştirilmesi backend sahibiyle doğrulandı: web türetilmiş `preRegistered` veya `expired` durumu için bölgeyi açar; sunucu ham `preRegistered` durumunu doğrular. İptal edilmiş `checkedOut` kayıt bu yeteneğe dahil değildir. Aktivasyonda gelecek bitiş zorunludur.
- Mutasyonun tamamlanması fiziksel kapının açıldığı, kartın panelde uygulandığı veya kişinin giriş yaptığı anlamına gelmez; mevcut arka plan cihaz sonucu izleme sınırı korunur.

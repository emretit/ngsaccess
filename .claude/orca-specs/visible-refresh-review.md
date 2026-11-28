# Denetim: görünür sekme + periyodik yenileme (ana sayfa / PDKS)

Denetçi: Claude (Opus, salt okuma) · 2026-11-28 · Kaynak: `git diff HEAD -- src/hooks src/components/dashboard` + yeni `src/hooks/useVisibleRefresh.ts(.test.ts)`
Kapı (kendi koşumum): `vitest run useVisibleRefresh.test.ts usePdksSnapshot.live.test.ts readingAccess.test.tsx src/components/dashboard` → **5 dosya / 37 test geçti**; `tsc -p tsconfig.app.json` ilgili dosyalarda **0 hata**.

**Özet:** Firma değişiminde başka firmanın verisi **sızmıyor** (önbellek anahtarı firma+argüman, eski istek sonucu nesil sayacıyla atılıyor). Ama "gizli sekmede sıfır sorgu/abonelik" hedefi **tutmuyor** (son okumalar, cihaz sağlığı, kurulum listesi canlı kalıyor) ve yenileme periyodu planın 180 dk'sı yerine **2 dk** — Free bütçesini tek başına aşar.

## Engel

1. **Periyot 2 dk, plan 180 dk** — [useVisibleRefresh.ts:5](src/hooks/useVisibleRefresh.ts) `DASHBOARD_REFRESH_MS = 2 * 60_000`. FREE_PLAN §3a tablosu: 5 dk = 108 yenileme/9 sa → yalnız activity **4,13 GB/ay**; 2 dk = 270 yenileme → doğrusal ölçekle **~10,3 GB/ay** (yalnız activity; stats+timeline ayrıca). Koşullu Free tasarımı "üç saatte bir dashboard" diyor. Karar Emre'nin; ama mevcut değerle §3a'nın tasarruf iddiası geçersiz. Öneri: 180 dk (ya da en fazla 60 dk) + Yenile butonu.
2. **Gizli sekmede canlı abonelikler açık kalıyor** (ana sayfa):
   - [useDashboard.ts:36-38](src/hooks/useDashboard.ts) `useDashboardReadings` hâlâ `useQuery` → `getRecentReadings` + `getReadingDevices` her kart olayında gizli sekmede de yeniden çalışır (LiveFeed).
   - [DeviceHealth.tsx:18](src/components/dashboard/DeviceHealth.tsx) `useProjectFilteredDevices` → cihaz listesi her heartbeat/lastSeen yazımında yeniden çalışır.
   - [SetupChecklist.tsx:34](src/components/dashboard/SetupChecklist.tsx) `getSetupStatus` (yalnız kurulum bitmemişse).
   Son kart akışı **görünür sekmede canlı** (istenen davranış korunmuş), ama gizlide de canlı. Düzeltme: üç yerde `useTabVisible()` false iken `"skip"`. Codex raporundaki "gizli sekmede istek yok" iddiası yalnız 3 özet sorgusu için doğru.

## Düzeltilmeli

3. **PDKS: her sekme dönüşü = tam canlı tablo yeniden yükleme** — [usePdksLiveTable.ts:15-16](src/hooks/usePdksLiveTable.ts) gizlenince anında `"skip"`. Convex istemcisi aboneliği bırakınca sonucu tutmaz; dönüşte roster + availability + tüm gruplar (§3a fixture: **8,8 MB / 19 çağrı**) yeniden koşar. Excel'e alt-tab yapıp dönen yönetici, açık abonelikten (olay başına tek 64'lük grup) **daha pahalı** olur. Öneri: gizlendikten ~5-10 dk sonra kapat (debounce), kısa gizlemede abonelik açık kalsın.
4. **PDKS: dönüşte tablo boşalıyor, UI durumu kayboluyor** — gizliyken `data` undefined → [usePdksTableData.ts:126-132](src/hooks/usePdksTableData.ts) `isLoading=true`, `tableRecords=[]`. Dönüşte tablo iskelete düşer: kaydırma konumu, satır seçimi, kayıt arayan açık diyalog ([PDKSEnhancedExportPanel.tsx:242](src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx) `records.find`) boş liste görür; dışa aktarma butonu `records.length === 0` ile kilitlenir ([:264](src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx)). Öneri: aynı `key` (aynı firma+tarih) için son tam `data`yı "güncelleniyor" etiketiyle göster; key değişince (firma) temizle — sızıntı riski yok.
5. **Hata mesajı ham Convex metni** — [useVisibleRefresh.ts:49](src/hooks/useVisibleRefresh.ts) `error.message` → kullanıcı "[CONVEX Q(dashboard:getStats)] [Request ID: …] Server Error…" görür ([TodayStrip.tsx:58](src/components/dashboard/TodayStrip.tsx)). Mevcut `errorMessage()` ([notify.ts:26](src/lib/notify.ts)) kullanılmalı.
6. **Önbellek girdisi koşulsuz siliniyor / üzerine yazılıyor** — [useVisibleRefresh.ts:101](src/hooks/useVisibleRefresh.ts) `remove: () => cache.delete(key)` ve `register: () => cache.set(key, created)`. Senaryo: E1 aboneliği bırakır (silinir) → başka panel aynı key ile E2 yaratır → E1 yeniden abone olur (StrictMode/yeniden mount) ve E2'yi ezer → iki ayrı timer, çift istek; E1 bırakınca E2 hâlâ aboneyken key silinir. Veri sızıntısı yok (aynı key = aynı firma), maliyet ikiye katlanır. Düzeltme: `if (cache.get(key) === created) cache.delete(key)`, `register`'da da mevcut başka girdi varsa ezme. Ayrıca `useMemo` içinde `cache.set` render sırasında yan etki: atılan render'da girdi abonesiz kalır (küçük bellek sızıntısı).

## Not

7. **Firma değişimi güvenli** — yeni key → yeni girdi `{loading:true}`, eski veri dönmez; eski istek `generation` ile atılır ([useVisibleRefresh.ts:47-52,68](src/hooks/useVisibleRefresh.ts)). PDKS'te `key` değişince tüm `useQueries` yeni argümanla açılır, `data` tamamlanana kadar undefined. Test: [useVisibleRefresh.test.ts:107](src/hooks/useVisibleRefresh.test.ts), [usePdksSnapshot.live.test.ts:117](src/hooks/usePdksSnapshot.live.test.ts).
8. **Zamanlayıcı/dinleyici sızıntısı yok** — son abone gidince `clearInterval` + `removeEventListener` ([:67-74](src/hooks/useVisibleRefresh.ts)); gizlide interval temizleniyor ([:79-85](src/hooks/useVisibleRefresh.ts)). `useTabVisible` cleanup doğru.
9. **Dışa aktarma kesilmiyor** — Excel/CSV/PDF tıklama anındaki `records` ile senkron; bordro/APHB `convex.query` ile tek atım; tarihsel `usePdksRequest` görünürlükten bağımsız (abort yok). Test [usePdksSnapshot.live.test.ts:142](src/hooks/usePdksSnapshot.live.test.ts) bunu doğruluyor ama kodda görünürlük dalı olmadığından yalnız gerileme koruması.
10. **Tutarsızlık (UX)** — LiveFeed canlı, TodayStrip'teki "kart okuması" sayısı + ReadingsTimeline 2 dk'da bir (180 dk'ya çekilirse 3 saatte bir) güncellenir; yeni okuma akışta görünür ama sayı artmaz. "Son güncelleme" etiketi bunu kısmen açıklıyor; ReadingsTimeline'da etiket yok.
11. **Her sekme dönüşünde anında yenileme** ([:80-82](src/hooks/useVisibleRefresh.ts)) — sık sekme değiştirmede 3 sorgu × dönüş sayısı. `updatedAt` yakınsa (ör. < 5 dk) atlama önerilir; §3a "sekmeye geri dönme bu sayılara eklenir" diyor.
12. **Testler** — gerçek React yerine elle yazılmış hook emülatörüyle koşuyor (useSyncExternalStore abonesi no-op dinleyici); yeniden render tetiklenmesini ölçmüyor, mantığı ölçüyor. Eksik: LiveFeed/DeviceHealth gizli-sekme testi (2. maddeyi yakalardı), TodayStrip "Yenile" tıklaması (dashboard.test mock'larında activity/timeline `refresh` yok — tıklama testi yazılırsa patlar), StrictMode çift abone (6. madde).

## 2. tur

Kapı (kendi koşumum): `vitest run useVisibleRefresh.test.ts usePdksSnapshot.live.test.ts readingAccess.test.tsx src/components/dashboard` → **6 dosya / 42 test geçti**; `tsc -p tsconfig.app.json` ilgili dosyalarda **0 hata**. 2 dk periyot koordinatör kararıyla kapsam dışı (1. tur Engel 1 kapandı).

**Özet:** Engel yok. Ana sayfada gizli sekmede sıfır abonelik sağlanmış, PDKS'te korunan son tablo başka firmanın verisini göstermiyor, render sırasında yan etki kalmadı. Kalan iki küçük iş: PDKS "güncelleniyor" bayrağı UI'a ulaşmıyor, görünürlük testi geçişi değil ilk değeri ölçüyor.

### Kapananlar (1. tur)
- **Engel 2 — kapandı.** [useDashboard.ts:33-38](src/hooks/useDashboard.ts), [DeviceHealth.tsx:22-24](src/components/dashboard/DeviceHealth.tsx), [SetupChecklist.tsx:26,36](src/components/dashboard/SetupChecklist.tsx) `useTabVisible()` (gecikme 0) false iken `"skip"`. Ana sayfa bileşenlerinde gizli sekmede açık canlı sorgu kalmadı; 3 özet sorgusu zaten polling, gizlide istek atmıyor. DeviceHealth'in `useProjectFilteredDevices` yerine yazdığı satır aynı `{ projectId }` argümanını kullanıyor (proje filtresi korunmuş).
- **Düzeltilmeli 3/4 — kapandı.** [usePdksLiveTable.ts:13,17](src/hooks/usePdksLiveTable.ts) 30 sn eşik; kısa sekme değişiminde abonelik açık kalıyor. [:79-84](src/hooks/usePdksLiveTable.ts) son tam tablo `key = JSON.stringify(input)` (firma+tarih+filtre argümanları) ile saklanıyor; `last.key === key && input !== "skip"` değilse dönmüyor.
- **Düzeltilmeli 5 — kapandı.** [useVisibleRefresh.ts:56](src/hooks/useVisibleRefresh.ts) `errorMessage(error)`.
- **Düzeltilmeli 6 — kapandı.** Girdi artık render'da değil `subscribe` içinde yaratılıyor ([useVisibleRefresh.ts:103-115](src/hooks/useVisibleRefresh.ts)); `remove` yalnız `entries.get(key) === created` ise siliyor. StrictMode abone→bırak→abone: ilk girdi silinir, ikinci abonede yeni girdi; tek girdi, tek zamanlayıcı. `getSnapshot` önbellekte olmayan key için sabit `pending` dönüyor (useSyncExternalStore kararlılığı tamam).

### Sızıntı kontrolü (firma / kullanıcı)
- **Firma değişimi güvenli.** Key değiştiği render'da `last.key` hâlâ eski → `cached` undefined; yeni firmanın `useQueries` sonuçları gelene kadar `data` undefined. A→B→A'da `last` B'ye yazıldığı için A dönüşte de taze yüklenir. Test [usePdksSnapshot.live.test.ts:191](src/hooks/usePdksSnapshot.live.test.ts) bunu ölçüyor.
- **Kullanıcı/yetki key'de yok (Not).** Aynı tarayıcıda çıkış→başka kullanıcıyla giriş, PDKS bileşeni unmount olmadan aynı firma+tarihe dönerse eski kullanıcının tablosu kısa süre görünebilirdi. Pratikte risk yok: çıkışta `projectId`/`canRead` düşüyor → `input === "skip"` → `cached` gate'leniyor, ayrıca giriş sayfasına geçişte bileşen unmount oluyor. Aynı oturumda yetki daraltılırsa (ör. ücret görme kaldırıldı) en fazla yeni sonuç gelene kadar eski satırlar görünür; sunucu yeni sorguda zaten filtreler. Kesin kapatmak isteyen için key'e `userId` eklemek tek satır.

### Düzeltilmeli
1. **PDKS `refreshing` UI'a ulaşmıyor** — [usePdksLiveTable.ts:87](src/hooks/usePdksLiveTable.ts) `refreshing: !complete` dönüyor ama [usePdksTableData.ts:124-127](src/hooks/usePdksTableData.ts) bu alanı geçirmiyor; `src/` içinde PDKS tarafında tüketicisi yok. Sekmeye dönünce kullanıcı 30 sn+ eski tabloyu "güncelleniyor" işareti olmadan görür (`updatedAt` eski saati gösterir; o kadar). Düzeltme: `usePdksTableData` dönüşüne `refreshing` ekle, sayfada `updatedAt` yanında "Güncelleniyor…" göster.

### Not
2. **Görünürlük testi geçişi ölçmüyor** — [visibility.test.tsx:41-55](src/components/dashboard/visibility.test.tsx) `renderToStaticMarkup` effect çalıştırmaz; ikinci test `visibilitychange` olayından değil, yeni render'da `useState(visible())` ilk değerinin `document.hidden`'ı yeniden okumasından geçer. Yani "mount edilmiş bileşen gizlenince aboneliği kapatıyor" davranışını ölçmüyor (o yol `useTabVisible` dinleyicisi). Gecikme-0 dalı başka testte de yok; PDKS testleri yalnız 30 sn dalını ölçüyor. Öneri: `useTabVisible` için hook emülatörlü küçük test (gizle → false, gecikme 0; gizle → 29 sn true / 30 sn false; dön → hemen true).
3. **Uygulama genelinde canlı abonelikler** (kapsam dışı, bilgi): [ActiveProjectContext.tsx:75,79,155](src/contexts/ActiveProjectContext.tsx) (projeler, yetkiler) ve `Layout.tsx` içindeki `SyncIssuesBanner` gizli sekmede açık. İlk üçü nadiren değişir; SyncIssuesBanner'ın çalışma sıklığı ölçülmedi — "sıfır" hedefi kesinse sıradaki aday.
4. **DeviceHealth kopya mantık** (nit) — [DeviceHealth.tsx:23-27](src/components/dashboard/DeviceHealth.tsx) `useProjectFilteredDevices` mantığını yeniden yazıyor; hook'a `enabled` parametresi eklemek tek kaynak bırakırdı.
5. **`last` iki kopya tutuyor** (nit) — [usePdksLiveTable.ts:82](src/hooks/usePdksLiveTable.ts) `JSON.parse(signature)` tablonun ikinci kopyası; `data` referansını saklamak yeterli (signature zaten değişim tespiti için var).

## 3. tur — PDKS "Too many re-renders" + 65 karakter index adı

Kapı (kendi koşumum):
- `vitest run PDKSRecords.render.test.tsx usePdksSnapshot.live.test.ts useVisibleRefresh.test.ts src/components/dashboard convex/schema.indexNames.test.ts` → **7 dosya / 43 test geçti**.
- `vitest run src` → **273 dosya / 1887 test geçti** (jsdom eklenmesi bir şeyi bozmadı).
- **Ters kanıt (scratch kopyada, ana dizine dokunmadan):** `usePdksLiveTable.ts` HEAD sürümüyle render testi **4/4 kırıldı**, çıktıda 4 kez "Too many re-renders" ve ekranda provadaki "PDKS kayıtları yüklenemedi" metni çıktı. Şemaya eski 65 karakterlik ad geri konunca `schema.indexNames.test.ts` `dashboardReadingFeed...: expected 65 to be less than or equal to 64` ile kırıldı. İki test de gerçek hatayı yakalıyor.

**Özet:** Engel yok. Kök sebep doğru, düzeltme Convex'in kendi `useQuery` deseniyle aynı, testler hatayı gerçekten yakalıyor.

### Kök sebep — doğru
`convex@1.47.0` `useQueriesHelper` aboneliği `useMemo(..., [observer, queries])` ile kuruyor; `useSubscription` ise `getCurrentValue`/`subscribe` kimliği değişince **render sırasında `setState`** çağırıyor (`node_modules/convex/dist/esm/react/use_subscription.js`). HEAD'de `usePdksLiveTable` her render'da yeni nesne geçiyordu, boş `{}` dahil. Sonuç: render → setState → render → … React 25 turda keser. Bu yüzden hata yalnız canlı (bugün) görünümde değil, `"skip"` durumunda da çıkıyordu: [usePdksSnapshot.ts:40](src/hooks/usePdksSnapshot.ts) hook'u her zaman çağırıyor. Convex'in tekli `useQuery`'si argümanları kendi içinde JSON anahtarıyla sabitlediği için bu hatayı vermiyor; tetikleyici yalnız `useQueries`.

### İçerik bazlı sabitleme — doğru, ama maliyetli
- [usePdksLiveTable.ts:13-19](src/hooks/usePdksLiveTable.ts) `JSON.stringify([id, fonksiyonAdı, args])` anahtar, `useMemo([key])`. Argüman değişince anahtar değişiyor ve yeni abonelik açılıyor (firma/tarih/grup bölünmesi/`availableDates`). Render testinin firma değişimi adımı ve live test bunu doğruluyor.
- **Not (maliyet):** `calculate` isteklerinin her biri tam `roster`'ı taşıyor. Her render'da N grup × tam roster stringify ediliyor, anahtar değişince bir de `JSON.parse` var. 1000 kişide ~16 grup × ~100 KB ≈ 1,6 MB stringify/render. Render sıklığı abonelik güncellemesiyle sınırlı, kırılmaz ama pahalı. Ucuzlatma: `useMemo(() => requests, [key])` ile parse'ı kaldırmak, ya da roster için tek imza (`roster` referansı veya `groupKey`) kullanıp anahtardan çıkarmak.
- **Not (kırılganlık):** `JSON.stringify` Convex'in `convexToJson`'ı değil. bigint/ArrayBuffer/`undefined` dizi elemanı gelirse anahtar yanlış olur ya da parse edilen argüman bozulur. Bugünkü argümanlar (string/number/boolean/dizi) için sorun yok.

### Aynı desen başka yerde — yok
`grep useQueries src` (test hariç) yalnız `usePdksLiveTable.ts` döndürüyor. Ana sayfa ve raporlar `useQuery` (kendi içinde sabit) ya da `convex.query` kullanıyor; risk yok.

### Index adı — doğru
- [schema.ts:45](convex/schema.ts) 53 karakter. Kullanım yerleri [dashboard.ts:731](convex/dashboard.ts), [adminGuards.ts:72,196](convex/lib/adminGuards.ts) güncel. Eski ad repo'da başka yerde yok (`grep`, `_generated` hariç).
- `dashboardReadingFeed` Cloud'da henüz yok (prova §3: 9 tablo eksik), yani yeniden adlandırma Cloud'da index yeniden kurma ya da backfill gerektirmiyor.
- [schema.indexNames.test.ts:12](convex/schema.indexNames.test.ts) tüm tablo ve staged index'leri tarıyor. `Reflect.get(definition, "export")` Convex'in yayımlanmamış iç metoduna dayanıyor: Convex sürümü yükselince test kendi hatasıyla (`Cannot export`) kırılabilir. Bu sessiz geçiş değil, gürültülü hata; kabul edilebilir.

### jsdom
`jsdom@31.0.1` devDependency, `package-lock.json` +338 satır. Ortam yalnız dosya başındaki `// @vitest-environment jsdom` ile açılıyor, varsayılan (node) değişmedi. Engine `node ^22.22.2 || ^24.15 || >=26`, yerel v22.22.3 uyuyor. Daha eski bir Node'da `npm ci` engine uyarısı verir (engine-strict yoksa hata değil).

### Render testi
[PDKSRecords.render.test.tsx](src/pages/PDKSRecords.render.test.tsx) gerçek React 18 kökü, gerçek `ConvexProvider` + `useQueries`/`useSubscription` kullanıyor; yalnız ağ (`watchQuery`) ve iki çevre bileşeni sahte. `afterEach` hem "Too many re-renders / Maximum update depth" konsol hatasını hem abonelik sızıntısını (`listeners.size === 0`) kontrol ediyor. Ters kanıtla döngüyü yakaladığı doğrulandı.
- **Not:** Test, PDKS sayfası gizliyken 4 canlı aboneliğin açık kaldığını belgeliyor ([:105](src/pages/PDKSRecords.render.test.tsx), filtre seçenekleri). Düşük değişimli sorgular; "gizlide sıfır" hedefi kesinse sıradaki aday.
- **Ayrıca:** Aynı şema diff'indeki `by_photo_storage` index'i dosya işine ait (paralel iş), bu denetimde bakılmadı.

# C2b-07-ui — Canlı İzleme A2

## Yapılanlar ve dosya sahipliği

- `src/pages/LiveMonitoring.tsx:4`: tek h1, aktif proje ve İstanbul saati kapsamı; A2 PageHeader, kartsız sayfa.
- `src/components/access-control/CardReadings.tsx:21`: ayrı Canlı/Geçmiş görünümü; canlı kontrol → StatInline → filtre → tablo sırası. URL filtreleri ve `reading` kimliği, proje değişiminde kapsam temizliği, kirli panelde URL geri/ileri kapanış koruması, pending sırasında panel değişimini engelleme.
- `src/components/access-control/CardReadingsFilters.tsx:33`: ortak FilterBar; cihaz/sonuç, ek kapı/kişi/TR günleri; temizleme; yüklenen kayıtlarda arama etiketi. Seçenekler ayrı hata sınırında; yabancı/silinmiş cihaz/kapı/kişi URL kimlikleri proje seçenekleriyle doğrulanıp temizlenir.
- `src/components/access-control/CardReadingsTable.tsx:7`: zaman → kişi/kart → kapı/cihaz → nötr yön → sonuç/neden → kaynak → adlandırılmış ayrıntı düğmesi; compact tablo, 390px'te ayırıcılı olay listesi. Sonuç semantik rozet; kaynak nötr; yeni satır en fazla iki saniye metin + info zemini.
- `src/components/live-monitoring/useLiveReadings.ts:8` + `lib/feed.ts:5`: 500 sınırı, `_creationTime` watermark, `_id` tekilleştirme, başlangıç snapshot'ı, pause sırasında alım, filtreye uyan yeni benzersiz olay sayacı. Delta `hasMore` ve yerel taşmada watermark/snapshot korunur, açık yeniden yükleme gerekir; TR gün değişimi zamanlayıcıyla yeniden başlangıç yapar. Ekleme bir saniyelik gruplar halindedir; tablo odağı/dokunma, sayfa aşağı kaydırma ve ayrıntı açılması görüntüyü durdurur; ayrıntı kapanınca otomatik devam yoktur.
- `src/components/live-monitoring/LiveFeedControls.tsx:4`: gerçek Convex abonelik bağlantısı, pause/devam/yeni olay/yeniden yükle; son olay zamanı ayrı; yeni olay özeti en fazla beş saniyede bir duyurulur. Cihazın çevrimiçi olduğu iddia edilmez.
- `src/components/live-monitoring/useFilteredReadings.ts:8`: `listFiltered` ile aday cursor sayfaları; alınan her sayfa snapshot olarak sabitlenir, reaktif değişimde okunmakta olan sayfa kaymaz. Boş ama bitmemiş sayfada devam düğmesi kalır; `filterScope` ve biriken `scannedCount` gösterilir, toplam/günlük sayı iddiası yoktur. Sayfalar arasında `_id` tekilleştirilir; yerel metin araması yeni sorgu/remount üretmez.
- `src/components/live-monitoring/ReadingDetailPanel.tsx:25`: URL kimliğiyle `getReading`, erişim/silinme/null ve sorgu hatası; TR zamanı, proje, kişi/kart, cihaz/kapı/okuyucu/yön, bölüm, sonuç/neden ve kaynak. Biyometri erişim listesinde görünür; PDKS dışı açıklaması vardır; fotoğraf/ham biyometri/ısı gösterilmez. Sheet 480px/tam mobil, kayan gövde, dirty kapanış, tetikleyiciye odak dönüşü.
- `src/components/live-monitoring/AssignReadingCardForm.tsx:10` + `lib/assignment.ts:4`: yalnız admin + eşleşmemiş kişi + kanıtlı fiziksel kart + uygun credential; proje kişi Combobox'ı, pasif kişi devre dışı, mevcut kartın birebir snapshot'ı (boş string dahil), değiştirme onayı, çift submit kilidi, alan/form hata metni, hata sonrası açık form. Kişi kartı değişirse güncel değer ve tekrar onay gerekir. `pending`, `notRequested`, koordinatörün eklediği `noTargets` ayrı dürüst mesajlarla gösterilir; geçmiş okuma patch edilmez.
- `src/components/live-monitoring/lib/readings.ts:3` ve `lib/readings.test.ts:10`: backend dönüşünden tip, URL/kaynak/sıralama/filtre/TR saat yardımcıları; 33 test.

`rg` ile başka tüketici kontrolü yapıldı. `useCardReadings.ts` ve `useProjectFilteredCardReadings.ts` değiştirilmedi; eski dış imzaları aynen korundu. Ownership dışında kaynak dosya, `convex/**`, ortak UI/kabuk değiştirilmedi; bu rapor görevde açıkça istendi. Commit/push/deploy/migration/DB yazma, `npx convex` ve paket kurma çalıştırılmadı.

## Kontroller

- Kendi mantık testleri: `node_modules/.bin/vitest run src/components/live-monitoring/lib/readings.test.ts` → **33/33 geçti**.
- Kendi eslint: **0 hata/uyarı**.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → **0**.
- `node_modules/.bin/eslint src convex` → **0 hata/uyarı**.
- `npx vite build` → **başarılı**; mevcut büyük bundle uyarısı var. Log: `/tmp/c2b-07-ui-build.log`.
- `git diff --check` (sahipli dosyalar) → **0**.
- App tsc bir ara tüm kaynaklarda **0** oldu; son kontrol paralel backend/06 güncellemesi sonrası yalnız `src/components/visitors/visitors.test.tsx:19` → fixture'da `sensitiveMasked` eksik. **07 kaynaklı hata yok**.
- **Son tam vitest: 93 dosya / 934 test geçti.** Önceki koşuda paralel backend güncellemesinden gelen üç geçici hata koordinatörün düzeltmeleriyle kapandı; son koşu yeşil.


## Görsel / davranış doğrulamasının sınırı

1440/390 için kod düzeyi: sayfa ve grid çocukları `min-w-0`; ekstra filtreler mobil tek sütun, ana filtreler sarılır; masaüstü tablo yalnız kendi kabında yatay kayar ve mobilde gizlidir; mobil olay listesi, Sheet ve uzun kart/kimlikler kırılır. Animasyon eklenmedi; Sheet için reduced-motion kapatması var. Gerçek oturumla tarayıcı testi, cihaz trafiği, mutation/DB yazımı yapılmadı; koordinatör gerçek oturumda aşağıdaki akışları kontrol etmeli:

1. 1440/390, %200 zoom: h1/proje kapsamı, kartsız boşluklar, tablo/mobil liste, uzun kart ve ret metni, Sheet'in tam genişliği ve odak dönüşü.
2. Pause sırasında gerçek yeni olaylar; seçili filtreye göre yeni sayaç; yeniden bağlantıda aynı watermark; delta/yerel tampon taşması → yeniden yükleme; TR gece yarısı.
3. Geçmişte boş ama bitmemiş aday sayfa → devam; `scannedCount`/yüklenen/gösterilen ayrımı; metin yazarken odak; URL geri/yenileme ve `?reading=` doğrudan açılışı.
4. Admin/üye ayrımı; pasif kişi; boş/eski/mevcut aynı kart; replacement onayı; stale/duplicate/backend hatasında formun açık kalması; dirty Esc/dış tıklama/URL geri; `pending`/`notRequested`/`noTargets` metinleri.

33 test reducer ve gerçek formda kullanılan doğrulama/sonuç yardımcılarını doğrular; gerçek DOM submit/Convex transaction/cihaz teslimi testi değildir. Geçmiş snapshot'ları tarayıcıda alınan sayfaları sabitler; backend'de yeni bir bütün-arşiv snapshot transaction iddiası yoktur. Backend sözleşmesine göre canlı 500 kayıt sınırı dolduktan sonraki yerel taşmada konservatif yeniden yükleme istenir. Proje kişi seçenekleri mevcut `employees.list` endpoint'ini kullanır; kişi araması Combobox içinde yereldir, yeni sunucu kişi araması eklenmedi.

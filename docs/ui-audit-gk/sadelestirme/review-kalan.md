Düzeltme gerekli

| # | Önem (Engel/Önemli/Küçük) | file:line | Sorun | Öneri |
| --- | --- | --- | --- | --- |
| 1 | Önemli | `convex/accessGrantStatus.ts:131` | Bilinmiyor listesi `unknownGrantPairs` sonucundaki `capped` bilgisini atıyor ve kesilmiş grafiği tam sonuç olarak sayfalıyor (`:141`). Yardımcı 100 kural, 1000 üye veya 1000 çift sınırında durabiliyor; filtreler bundan sonra uygulanıyor. Örneğin tek aktif kurala bağlı 1001 aktif kişi ve tek cihaz varken yalnız 1001. kişinin adına arama, mevcut bilinmeyen çifte rağmen `page: []`, `isDone: true` döndürüyor. Ön yüz de imleç olmadığı için “Bu filtrelerde kayıt bulunamadı.” gösteriyor (`StatusResults.tsx:89`). Sonraki sayfa bu kişiye ulaşamıyor. | Eksik taramayı tamamlanmış sonuç olarak sunmayın: `capped` durumunda açık sınır hatası verin veya grafikte kaldığı yerden devam eden gerçek tarama imleci kullanın. Daraltma filtrelerinin tarama bütçesini gerçekten daraltmasını sağlayın; 1001. üye/çift ve 101. kural senaryolarını test edin. |

Denetim kapsamı: `.claude/pathspec-gk-kalan.txt` içindeki kaynak/test diffleri ve iki yeni kaynak dosyası incelendi; kaynak kod değiştirilmedi.

Doğrulanan davranışlar:

- `counts` eski sürümle karşılaştırıldı: kayıtlı satır sayaçları, `people` birleşimi, departmandaki `examinedPairs`, projedeki `seen`/`examinedMembers`, 100/1000 sınırları ve `capped` birleşimi korunuyor. Aynı bilinmeyen çift ikinci kuraldan geldiğinde yeni yardımcı `ruleIds` ekliyor; sayılan çift ve kişi sayısı değişmiyor. Cihaz seçiliyken mevcut erken dönüş de korunmuş.
- `listByProject` yetkilendirmeyi bilinmeyen grafik okunmadan önce yapıyor (`:120`); sayfa boyutu 1–50. Sınır aşılmayan grafikte departman/cihaz/kural/ad filtreleri, sentetik `_id: null`/`state: "unknown"` ve offset sayfalama doğru. Sınır durumu yukarıdaki bulgudur.
- Sentetik satırlar `employeeId:deviceId` ile seçiliyor; yeniden gönderim `_id` istemiyor. `createGrantRun` kişi ve cihazın proje sahipliğini doğruluyor (`convex/deviceSyncRuns.ts:639–643`). Bilinmiyor sayacı tıklanabiliyor, seçiliyken sıfırda kalıyor ve ilgili ipucu bu filtrede gizleniyor.
- Ortak plan mantığında Her gün/Hafta içi/Günlere göre geçişleri, veri kaybı onayı, boş Pazartesi uyarısı ve elle gün düzenlerken `customLayout` koruması eski kodla eşdeğer. İki `toDaily` de destructuring ile `weekly` alanını çıkarıyor. Mevcut etkileşim testleri geçti.
- `syncReasons.ts` yalnız metin sabitlerini içeriyor ve import bağımlılığı yok; web tarafına sunucu bağımlılığı taşımıyor. `deviceSyncRun.ts` aynı `skipReasons` değerini yeniden dışa aktarıyor; mevcut tüketiciler ve API tip haritası TypeScript kontrollerinden geçti.
- İncelenen kaynaklarda yeni `any`/`as any`, non-null assertion veya `filter(Boolean)` bulunmadı.

Kapılar:

- `node_modules/.bin/vitest run convex/accessGrantStatus.test.ts src/components/access-control src/lib/pastAttempt.test.ts` — geçti: **29 dosya, 224 test**.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` — geçti, çıkış 0.
- `node_modules/.bin/tsc --noEmit -p convex` — geçti, çıkış 0.

Ek kanıt: kaynak dosyadan alınan değiştirilmemiş `unknownGrantPairs` ve `listByProject` gövdeleri TypeScript ile bellekte derlenip sahte salt okunur DB bağlamında çalıştırıldı. 1001 üyeli tek kural/tek cihaz örneğinde yardımcı `pairs.length: 1000, capped: true`; yalnız son kişiyi arayan liste `page: [], isDone: true, continueCursor: "grant-scan:50", boundedScan: true` döndürdü. Bu izole davranış kontrolüdür; gerçek veritabanına erişilmedi.

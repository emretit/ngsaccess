# Ana sayfa denetim düzeltmeleri — 27 Kasım 2026

- E1: `convex/lib/employeeCascade.ts:3` devam mutation’ları hook’lu; `dashboardSummary.ts:117` eksik/eski günlerde de PII siler; gerçek kişi silme + zamanlanmış devamda 251 feed/kanıt kaydında ad/kart kalmadı, retention da doğrulandı.
- D1: `dashboardSummary.ts:10` cihaz/okuma hash’iyle 8 shard; saatler okunurken toplanır; 100 paralel yerel insert sekiz shard’a yayıldı ve eski sonuçla eşleşti; sabit kolon codec’i eski binary sayfaları da okuyabilir.
- D2: `dashboardSummary.ts:175` >1000 için kalıcı `count:-1`; sonraki mutation’larda yeniden tarama yok; 1006 kişi fixture’ında tek tarama, stats doğru eski yola düşüyor.
- D3: `dashboardWriters.test.ts` AST bekçisi insert/patch/replace/delete ve helper/devam çağrılarını korumak için tüm ham mutation import/re-export’larını yasaklar; 30 üretim dosyası yalnız ortak hook kaydına yönlendirildi.
- D4: `dashboard.ts:704` varsayılan eski `devices` alanı dolu; yeni `src/hooks/useDashboard.ts:35` açıkça `includeDevices:false` ister ve ayrı cihaz sorgusunu kullanır.
- W5a: `convex/__snapshots__/w5aLegacyEquivalence.test.ts.snap:77` yalnız bir dashboardDays unique okuma izi eklendi; sonuç/DTO satırlarında değişiklik yok, test yeşil.
- Doğrulama: 12 ilgili dosyada 257 test geçti; değişenlerin ESLint’i 0 hata (dataMigrations’ta önceden var olan iki unused uyarısı); git diff --check temiz; yasaklı dosyalara dokunulmadı, tam vitest/tsc, Convex CLI, migration/canlı yazma/commit/deploy yok.
- Ölçüm: 200 kişi 730457→142137 B (%80,54), 500 kişi 2006957→354122 B (%82,36); tek yazım okuma+yazması ve 2/5 açık kullanıcı dahil noktasal model %80,07/%82,27; kanıt `/tmp/ngs-load/dashboard-summary-review-results.json`, mevcut measure.mjs yöntemi; günlük integral ve canlı OCC retry ölçümü değildir.

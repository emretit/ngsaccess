# Ana sayfa özetleri — 27 Kasım 2026

200 kişilik firma fixture’ında ana sayfanın beş sorgusu (ayrılan cihaz adları dahil) **730.457 B → 141.503 B, %80,63** okudu. Yalnız yayın sonrası tam günlerde yeni yol kullanılır; tarihsel veriler için eksiksiz eski sorgu yolu korunur.

## Uygulama

- `convex/schema.ts:21`: yalnız yeni dashboardDays/dashboardHours/dashboardEvidence/dashboardCounts/dashboardReadingFeed tabloları ve index’leri.
- `convex/lib/dashboardSummary.ts:13`: sınırlı ikili transport codec’i; 64 olay/sayfa, eklenen sayfalarda 48 KB hedefi; ham cihaz gövdeleri saklanmaz. Aynı transport alanları ve kimlik/sıralama bilgileri korunur.
- `convex/lib/dashboardSummary.ts:90`: proje × İstanbul günü tamlık kontrolü, saatlik izin/ret/toplam sayaçları; insert/update/delete aynı transaction içinde. Dedup insert yapmadığı için ikinci kez sayılmaz. Bilinen eski veriyle karşılaşılırsa tamlık işareti kapalı kalır.
- `convex/lib/dashboardSummary.ts:140`: çalışan, aktif cihaz ve bekleyen erişim kuralı sayaçları; en fazla 1001 adayla tembel başlangıç. 1000 sınırını aşan projeler mevcut tam sayım yolunda kalır.
- `convex/lib/dashboardMutations.ts:6` + `convex/lib/customFunctions.ts:1`: ortak mutation hook’u; ilgili internal mutation import’ları bu kayıt fonksiyonuna yönlendirildi. Kart çekirdeği, ziyaretçi geçişi, personel yazıcısı ve cihaz silme yardımcısında idempotent hook var; başka iş mantığı değiştirilmedi.
- `convex/dashboard.ts:50,146,183,704,756`: sayaçlardan stats/timeline, aynı PDKS hesaplarına küçük kanıt girdisi, sıralamayı koruyan küçük son okuma görünümü. İzin/vardiya/personel ve politika belgeleri hâlâ canlı okunur; ayrı bir devam hesabı/snapshot kullanılmaz.
- `convex/dashboard.ts:819`, `src/hooks/useDashboard.ts:31`: yalnız görünen okuma alanları; cihaz adı/serial bilgileri tenant kontrolü yapan ayrı sorguda. lastSeen/serial güncellemeleri stats ve recent okuma sorgusunu invalidate etmez.

## Ölçüm

`/tmp/ngs-load` mevcut getConvexSize/ctx.db proxy yöntemi kullanıldı. Aynı gün ortası fixture’ında HEAD’teki eski dashboard modülü `dashboardLegacy.ts` olarak yalnız geçici kopyada çalıştırıldı; yeni sorgular ayrı cihaz adı sorgusunu da içerir. 200 kişide 350, 500 kişide 1000 okuma; ilk sayım/başlatma sonrası sıcak durum ölçülür. Eski ve yeni isimli sorgular aynı veri üzerinde çalışır.

| Senaryo | Önce sorgu okuması | Sonra sorgu okuması | Sorgu azalması | Tek insert: okuma / yazma | Yazma dahil model azalması |
|---|---:|---:|---:|---:|---:|
| 200 kişi | 730,457 B | 141,503 B | %80.63 | 4,183 / 4,496 B | %80.03 |
| 500 kişi | 2,006,957 B | 357,768 B | %82.17 | 5,113 / 5,429 B | %82.07 |

Son sütun, önceki rapordaki 200 kişide iki ve 500 kişide beş açık kullanıcı varsayımıyla hesaplanır: `(kullanıcı × yeni sorgu okuması + ölçülen tek insert okuma/yazması) / (kullanıcı × eski sorgu okuması)`. Eski insert maliyeti paydaya eklenmediğinden muhafazakârdır; başlangıç sayaç taraması, index transferi, canlı OCC/CPU, abonelik önbelleği ve gerçek bulut faturası ölçümü değildir. Özet sayfasının doluluk noktasına göre yazma maliyeti değişir; bu bir günlük integral ölçümü değildir. Stats sayaçları kart insert’inde değişmediği halde model her kartta yeniden okunduklarını varsayar.

Kanıtlar: `/tmp/ngs-load/dashboard-summary-load.test.ts`, `dashboard-summary-results.json`, mevcut `measure.mjs`; yeniden çalıştırma: `node node_modules/vitest/vitest.mjs run dashboard-summary-load.test.ts --reporter=dot --testTimeout=120000 --maxWorkers=1`.

## Doğrulama ve yayın

12 hedefli test dosyası, **207 test geçti** (`--maxWorkers=2 --testTimeout=30000`); ardından default stats sayımı da eşitlik karşılaştırmasına eklendi ve 15 summary/guard testi tekrar geçti. İlk yüksek paralellik koşusunda iki 5 saniyelik soğuk import timeout’u görüldü; sınırlı paralellikte aynı testler geçti. Değişen dosyaların ESLint kontrolü ve `git diff --check` temiz.

Eşitlik kapsamı: İstanbul gece yarısı, saat kovaları, bilinmeyen/ret durumları, geç/out-of-order okumalar, canlı Hik ve backfill dedup, IDE dedup, genel okuyucu izin/ret, çalışan QR replay, ziyaretçi QR/PIN ve ret, seed/retry, çoklu cihaz, izin/vardiya değişikliği, pasif/silinen/taşınan personel, aktif cihaz değişimi, aynı zaman damgasında son okuma sırası, update/delete ve transaction rollback. Bekçi testi doğrudan cardReadings insert eden tüm üretim dosyalarının hook kurduğunu kontrol eder. Mevcut vardiya planı, kart okuma karakterizasyonu, ziyaretçi ve mobil testleri de koşuldu.

**Tek seferlik yayın işlemi yok.** Yayın günü mevcut kayıt varsa gün eksik özetle gösterilmez; eski yol sürer, sonraki İstanbul gününde ilk insert tam özeti başlatır. Backfill, migration, canlı DB yazma, Convex CLI, tam vitest/tsc, commit/push/deploy çalıştırılmadı. getAnnualOvertimeBalance koordinatörün açık kararıyla bırakıldı; görev başındaki src/lib/pdksAnnual.ts tip referansları diğer worker’ın ownership’inde olduğundan kaldırma sonraki tura ertelendi.


Denetim sonrası güncel sonuç: 8 shard, KVKK devam mutation’ları, overflow işareti ve eski web uyumluluğu düzeltildi; sorgu okuması 200 kişide **%80,54**, 500 kişide **%82,36** azaldı. Önceki tablolar shard öncesi ölçümdür; [denetim düzeltmeleri ve tekrar ölçüm](DASHBOARD_REVIEW_FIXES_2026-11-27.md).

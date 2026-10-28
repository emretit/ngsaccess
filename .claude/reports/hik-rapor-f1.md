# Hik raporları Faz 1 — Mola

`/reports/gunluk/mola`, gerçek okutma çiftleri arasındaki mola aralıklarını ve toplam mola süresini gösterir. “Yalnız ihlaller” eski Mola İhlalleri predicate'inin verdiği günleri korur; eski bağlantı arama parametreleri korunarak `ihlal=1` ile yönlenir. Çalışma süresi, mevcut mola kesintisi, fazla mesai, durum ve gece günü ataması değiştirilmedi.

## Uygulama

- `convex/lib/pdksPunchPairs.ts:70`: `pdksPunchSegments`, mevcut `resolvePdksPunches` ile yönsüz/tekrar okutma davranışını paylaşır; eksik uçlar null kalır, yalnız ardışık tam çiftler arasındaki pozitif tam dakika boşlukları mola olur. Eski `pairPdksPunches` ve `pdksPairReadings` gövdeleri değişmedi.
- `convex/lib/pdksDay.ts:152`: gösterim için, mevcut eachPunch hesabının kullandığı aynı readings, manuel uçlar, fixed/flexible filtreleri ve minimum aralık paylaşılır; flexibleConflict boş liste üretir. `includePunchSegments` isteğe bağlıdır: eski çağrıların dönüş şekli ve karakterizasyon beklentileri korunur, her iki hesaplama modunda istendiğinde `punchSegments` eklenir.
- `convex/lib/pdksTable.ts:114`, `:333`, `:390`: `includePunches` açıkken pairs/breaks/breakMinutes eklenir; kapalıyken yeni alanlar hiç yoktur. HH:MM dönüşümü mevcut İstanbul formatlayıcısıyla yapılır. Çok vardiyada mevcut splitReadingsByShift ve manualForSegment, dayKind ve manuel gece çıkış kuralıyla her parça ayrı hesaplanır; parçalar arasından mola türetilmez.
- Çok vardiya gerekçesi: `pdksMultiShift.ts` ownership dışında; mevcut merge yalnız ilk günün ek alanını taşıdığı için tablo katmanında aynı saf hesap girdileriyle parça hesapları tekrar kullanıldı. Bu yalnız includePunches açık çok vardiya günlerinde ek CPU hesabıdır; ek DB sorgusu, polling veya reaktif sorgu yoktur.
- `src/lib/reports/registry.ts:83`, `:90`: Mola raporu, Türkçe açıklama, sekiz odak kolon, varsayılan gizli giriş/çıkış/süre/okutmalar ve Excel sayısal dakika değeri eklendi. Mevcut güvenli dışa aktarma yolu kullanılır.
- `src/lib/reports/rows.ts:31`, `:98`: tüm molalar predicate'i ve ihlal-yalnız seçeneği eklendi.
- `src/components/reports/ReportScreen.tsx:60`, `:70`, `:78`: Mola seçimi `ihlal=1` üzerinden istemcide uygulanır; temizleme bu parametreyi de siler. `ReportResults.tsx:24` filtreyi satır üretimine aktarır; sunucu argümanları ve query key değişmez.
- `src/pages/Reports.tsx:34`: eski URL için replace yönlendirmesi; `ReportPage.tsx:47`: yeni rapora uygun boş durum metni.

## Testler

- `convex/lib/pdksPunchPairs.test.ts:98`: tek çift, bir/iki mola, yönsüz/debounce, null uçlar, sıfır/subminute boşluk, manuel uçlar, gece 02:00–02:30 molası, firstLast/eachPunch hesap sonucunun gösterim dışındaki alanlarının birebir eşitliği.
- `convex/lib/pdksTable.test.ts:534`: includePunches payload farkı ve geri kalan gün/özet alanlarının birebir eşitliği; `:549`: çok vardiya arası boşluk dışarıda.
- `src/lib/reports/rows.test.ts:155`: tüm molalar ve eski predicate ile aynı ihlal-yalnız gün listesi.
- `src/lib/reports/registry.test.ts:50`: başlık, odak kolonlar, mola kayıtları biçimi, süre ve sayısal export dakika değeri.
- `src/lib/reports/query.test.ts`: yeni rapor includePunches beklentisi.
- `src/components/reports/ReportPage.test.tsx:140`: eski URL replace + parametre koruması; `:146`: istemci filtresi değişirken sunucu argümanı aynı.
- `src/components/reports/auditFixes.test.tsx:77`: Mola filtresi ve ihlal URL seçimiyle temizleme görünümü.
- Karakterizasyon testlerinde ve mevcut pdksDay beklentilerinde değişiklik yok; snapshot değişikliği yok.

## Kapılar

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: geçti (0).
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: geçti (0).
- `node_modules/.bin/eslint <değiştirilen 16 TS/TSX dosyası>`: geçti (0); son iki test dosyası ayrıca tekrar temiz.
- İlgili 7 test dosyası: 97/97 geçti; ek filtre görünümü testiyle auditFixes ayrıca 9/9 geçti.
- `node scripts/find-node-leak.mjs`: geçti (0, çıktı yok).
- Tam `node_modules/.bin/vitest run`: 391 dosyanın 389'u geçti; 4452 testin 4450'si geçti, 2 kapsam dışı hata (56,59 saniye). Mola, pdksTable ve karakterizasyon testleri geçti; hata ayrıntıları aşağıda.

## Bilinçli bırakılanlar

- Aylık raporlar, export düzenleri, mola kesintisi kuralı ve PDKS ekranı kapsam dışı bırakıldı. Yeni Convex fonksiyonu/index/şema veya codegen yok; paket kurulmadı, commit/deploy yapılmadı.
- Başka oturumların değişikliklerine dokunulmadı. `convex/lib/visitorStatus.test.ts:120` zamanlayıcı beklentisi (2 çağrı yerine 0) ve `convex/shiftPlans.test.ts:38` 300 çalışan/6000 izin fixture'ının 5 saniye sınırını aşması ilk tam koşuda ve ayrı tekrar koşusunda kırmızı; ilki değişmiş `convex/visitors.ts` yolunda, ikincisi mola hesaplamasını çağırmayan ölçek fixture'ında. Bu dosyalar değiştirilmedi.

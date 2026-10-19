# C2b-09-ui — Vardiyalar A2 teslim raporu

17.10.2026 · task_44889a6c2931 · dispatch ctx_8a8d0311f01e.

## Teslim

- `src/pages/Shifts.tsx:6`: aktif proje anahtarı ve bölüm sınırı; proje yok/yükleniyor durumları.
- `src/components/shifts/ShiftCalendarView.tsx:43`: PageHeader, StatInline, Türkçe ad/e-posta araması, vardiya filtresi, hafta/ay, tarih atlama, kişi seçimi, BulkBar, 50 kişilik takvim sayfaları. `:128` listAssignments her çağrıda `projectId`, `rangeStart`, `rangeEnd`, görünür en fazla 50 `employeeIds` ve seçiliyse `shiftId` alır; aralıksız atama sorgusu kalmadı. İzin/tatil sorguları aynı aralık/projede; bilinmeyen katmanda atama kilitli. Plan query hatasında tanım Sheet'i bağımsız kalır.
- `ShiftCalendarGrid.tsx:16`: semantik caption/col/row başlıkları, sticky kişi ve üst başlık, adlandırılmış klavye kaydırma alanı, kişi/gün adı içeren gerçek hücre düğmeleri. Ay gerçek gün sayısını kullanır; yatay taşma yalnız takvim bölgesinde.
- `ShiftAgendaView.tsx:4`: 760px altında günlük ajanda; tabloyla aynı `cellData` sonucu. 390px'te geniş tablo oluşturulmaz. `ShiftCalendarCell.tsx:4`: nötr vardiya adı/saat; en fazla iki kayıt + kalan sayısı; gece devamı, izin/tatil ve yalnız gerçek saat kesişmesi rozetleri. Kimlikten renk türetme ve `shiftColor.ts` kaldırıldı.
- `AssignShiftDialog.tsx:45`: tekli/toplu aynı form; seçili kişiler aramadan bağımsız adlarıyla görünür; tekrar günleri, 1–100 kişi ve 365 tarih farkı doğrulaması; alan altı hata/ilk hataya odak, dirty ve eşzamanlı gönderim/kapanma koruması. `:388` salt okunur server preview; çakışma ve izin/tatil için ayrı açık onaylar. `:106` apply MUTLAKA `resultMode: "detailed"` gönderir. Sonuç kapanmadan kişi bazlı kalır; sıfır başarı başarı diye gösterilmez, yalnız atlananlar açık eylemle yeniden seçilir. BulkAssignShiftDialog aynı forma yönlenen export'tur; sessiz retry yok.
- `ShiftDayDetails.tsx:17`: tıklanan kişi/gün ve bütün serilerin saat/aralık/gün ayrıntısı; buradan bilinçli tüm-seri düzenleme. `AssignmentEditDialog.tsx:31`: ortak doğrulama, değiştirilebilir tekrar günleri, alan hataları, dirty/pending koruması, açık tüm-seri kaydet/sil onayı. Tek gün istisnası sunulmaz.
- `ShiftListSidebar.tsx:26`: kalıcı sidebar yerine isteğe bağlı 420px Sheet; görünür RowActions, aktif/pasif durumları. `:156/:181` tüm dönem etkisi `assignmentDeleteImpact` ile gelir; yükleme 0 sayılmaz, truncated "En az" korunur ve tek işlemde büyük silme kapalıdır.
- `definitions/AddShiftDialog.tsx:47` ve `definitions/shiftFormSchema.ts`: eski Ayarlar dosyaları buraya taşındı; ad/saat → mola → brüt/mola/net → mesai/durum → açıklamalı toleranslar. Null temizleme korunur; başarısız mutation alanları açık tutar. `:81` definitionUsage aktif/gelecek kişi/seri etkisi ve geçmişin de değişeceği uyarısı; `:89` İstanbul günü değişince bayat etkiyle kaydetme kilitlenir ve yenileme istenir.
- Koordinatör ask yanıtıyla ek sözleşme: `skippedAssignments > 0` ise kullanım/sayımda proje bilgisi eksik seriler sayım dışında; silme onayında bu seriler silinmeden kalacak; mutation bildiriminde silinen ve atlanan adetler ayrı. API-fix worker'ın rapor ekini koordinatör takip ediyor.
- Atıl `ShiftSettings.tsx`, `ShiftTable.tsx` kaldırıldı; `SettingsTabs.tsx` yalnız vardiya sekmesini `/shifts` bağlantısına dönüştürür. Genel mesai/tatil politikası değiştirilmedi.

## Kapılar (son tur 20:24–20:25)

| Kapı | Sonuç |
|---|---|
| `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | Vardiya/sahiplik dosyalarında **0 hata**; genel komut **1 dış hata**: `src/components/visitors/visitors.test.tsx:19` fixture'da yeni required `sensitiveMasked` eksik. Bu dosyaya dokunulmadı; koordinatöre bildirildi. |
| `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` | **0** |
| `node_modules/.bin/eslint src convex` | **0 hata, 0 uyarı** |
| `npx vitest run` | **93 dosya / 942 test yeşil** |
| `npx vite build` | **Başarılı**; mevcut 500 kB chunk boyutu uyarısı |
| Vardiya testleri | **2 dosya / 16 test yeşil**: takvim yıl/ay/artık yıl ve İstanbul günü; tarih/kişi/gün sınırları; ayrık saatler/gece devamı; tablo/ajanda aynı sunum; semantik başlık ve kişi/gün düğmesi; çoklu kayıt özeti. |

Önceki ara app tsc ve genel test hataları 05/07 backend + 06 frontend çalışanlarının geçişlerinden geliyordu; yukarıdaki son tur bunların yerini alır. Commit/push/deploy/migration, npx convex, DB yazımı ve paket kurulumu yapılmadı. Ownership dışı uygulama/Convex dosyası değiştirilmedi.

## Koordinatörün gerçek oturumda bakacağı kapı

1. 1440'ta hafta/ay ve sticky başlık/kişi; 390'ta günlük ajanda, Sheet ve bütün diyaloglarda yatay taşma. Kodda `min-w-0`, sınırlı native select, sarılan rozet/adlar, `max-h` dialog ve yalnız tablo içi yatay kaydırma var; oturumlu piksel/screenshot doğrulaması yapılmadı.
2. Kişi filtresi/sayfası/dönem değişiminde seçim temizlenmesi; gece devamı ve aynı gün ayrık saatlerin çakışma sayılmaması; 3+ seriden gün ayrıntısına ve oradan tüm-seri düzenlemeye geçiş.
3. Preview → iki bağımsız onay → apply; tüm çakışanlarda sıfır sonuç ve kısmi başarıda yalnız atlananları yeniden seçme. Değişmeyen formu ikinci kez sessiz gönderen akış yok.
4. Tanım güncelleme etki özeti, geçmiş uyarısı, nullable mola/tolerans temizleme, mutation hatasında formun açık kalması ve dirty/pending tüm kapanma yolları; silmede tam/alt-sınır/projesiz-seri metinleri.

## Sınırlar

Backend yayımlaması/indeksleri ve gerçek Convex concurrency/performance bu işte test edilmedi. Çalışan/tanım listesi mevcut proje query'siyle bütünüyle gelir; takvim atamaları ise tarih ve en fazla 50 kişiyle sınırlıdır. Açılan tanım Sheet'inde satır başına bounded etki query'si çalışır. Tek gün bölme, tarihsel vardiya sürümleme ve PDKS hesabı eklenmedi.

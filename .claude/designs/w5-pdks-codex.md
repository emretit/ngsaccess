# W5 — PDKS kuralları tasarımı

21.10.2026 · Salt okunur inceleme; yalnız bu belge yazıldı. Öneriler mevcut özellik iddiası değildir.
Kanıtlar commit'siz W2 değişikliklerini içeren çalışma ağacına aittir; uygulamadan önce satırlar yeniden kontrol edilmeli.
Canlı `notable-tern-4` ortamına bağlanılmadı; canlı ayar/veri dağılımı **[teyit]**. Hik-Connect ayrıntıları görevde verilen referanstır; birebir ürün eşdeğerliği **[teyit]**.

## 1. Esnek vardiya modeli ve hesap kuralları

### Mevcut zemin ve ek alanlar

- Asıl ortak günlük hesap `computePdksDay`: ilk/son izinli okuma, manuel öncelik, mola, gece ve mesai burada; yalnız `pdksCalc` değiştirmek yeterli değil (`convex/lib/pdksDay.ts:47`, `convex/lib/pdksDay.ts:61`, `convex/lib/pdksDay.ts:232`).
- `shifts.startTime/endTime` zorunlu; toleranslar ve mola alanları opsiyonel (`convex/schema.ts:889`). Şema daraltılmayacak, mevcut alanlar silinmeyecek.
- Öneri: `shifts.scheduleType?: "fixed" | "flexible"` ve `flexible?: { requiredNetMinutes, checkInStart, checkInEnd, checkOutStart, checkOutEnd, checkOutEndDayOffset, maxSpanMinutes, breakMode, breakMinutes? }` ekle.
- `scheduleType` yoksa **fixed** ve mevcut hesap birebir çalışır. Flexible seçilirse nesnenin tüm zorunlu iç alanları backend'de doğrulanır; `breakMode="duration"|"existingLegal"`, duration için dakika zorunlu.
- Başlangıç önerisi: net hedef 480 dk; giriş 00:00–23:59; çıkış 00:00–23:59, gün farkı 0; süre molası 60 dk; azami oturum 16 saat. 05:00–22:00 giriş kullanıcı seçimi olabilir. 16 saat teknik eşleme sınırıdır, çalışma süresi önerisi değildir.
- Esnek kayıtta zorunlu eski `startTime/endTime`, giriş penceresi sınırlarını taşıyan uyumluluk değerleri olur; esnek hesap, etiket ve çakışma kontrolü bunları vardiya başlangıç/bitişi saymaz. Eski istemci desteği **[teyit]**; yeni esnek kayıtlar tüm tüketiciler hazır olunca açılmalı.
- Backend/UI doğrulama: dakika tamsayı, hedef >0, 0≤mola<azami süre≤1440, gün farkı 0/1; HH:MM geçerli; giriş penceresi aynı takvim gününde ve başlangıç≤bitiş; hedef+mola azami süreye sığmalı. Her izinli girişten hedefe ulaşılabilen en az bir çıkış olmalı; aksi halde form hata verir.
- Ayrı gece başlangıç pencereleri ilk sürümde tanımlanabilir: ör. giriş 20:00–23:00, çıkış D+1 00:00–12:00, gün farkı 1. 22:00–05:00 gibi geceyi geçen *giriş penceresi* ilk sürümde reddedilir; cross-day çalışma desteklenir.

### Gün, süre ve mesai

1. Yetkili proje/kaynak/check point süzmesi → çalışan eşlemesi → vardiya/gün ve giriş-çıkış çözümü → `employedOn` → günlük hesap → dönem mesaisi sırası kullanılır. Yeni yön kuralları §2'de; fixed+legacy dalı değişmez.
2. Esnek iş günü geçerli girişin İstanbul tarihidir. Çıkış aynı girişin ardından, tanımlı çıkış penceresinde ve `maxSpanMinutes` içinde olmalı; her okuma en fazla bir iş gününe atanır.
3. Önce açık önceki oturumun yönü belli çıkışı eşlenir; yönü belli yeni giriş kendi gününü açar. Bir günün ilk geçerli girişi ve ardından son geçerli çıkışı esas alınır; ara hareketler ayrıca gösterilir. Eksik yön/çakışan oturum keyfi çiftlenmez, inceleme işareti üretir.
4. Oturum çıkışla kapanınca aynı günün yeni girişi, tek günlük ilk-giriş/son-çıkış kapsamını genişletebilir; gece taşan önceki oturumun yeni gün girişini yutması engellenir. Çoklu oturumların ayrı ayrı toplanması ilk sürüm kapsamı değildir.
5. Brüt = gerçek çıkış−giriş; net = max(0, brüt−mola). Süre molası min(brüt, tanımlı mola) bir kez düşer; gerçek ara çıkış boşlukları ayrıca düşülmez. `existingLegal` mevcut `legalBreakMinutes` algoritmasını kullanır; bu belge hukuki uygunluk değerlendirmesi yapmaz.
6. Sabit vardiyanın mevcut saatli mola/otomatik mola yolu korunur (`convex/lib/pdksDay.ts:94`). Esnekte saatli `breakStart/breakEnd` kullanılmaz; süre molası gece/tatil segmentlerine oranlı dağıtılır, yuvarlama sonunda dakika korunur.
7. Esnekte `isLate/isEarlyExit=false`, geç/erken dakika=0. `requiredNetMinutes`, `shortfallMinutes=max(0,hedef−net)`, `excessMinutes=max(0,net−hedef)`, `durationMeasured`, `punchQuality` ayrı sonuç alanlarıdır. Eksik süre **tam gün devamsızlık değildir**; N + “Eksik süre” uyarısıdır, otomatik ücret/SGK kesintisi üretmez.
8. Tek/eksik okutma süresi ölçülemez: mevcut sayısal toplam 0 kalır, `durationMeasured=false`, eksik süre `null`; hedefin tamamı eksik çalışılmış gibi raporlanmaz. Sentetik giriş/çıkış ve sentetik mesai yoktur.
9. `dailyShift`: iş gününde ödenecek aday = max(0,net−hedef−`overtimeStartToleranceMinutes`). Tolerans çıkarılır; 15 dk toleransta 60 dk fazla süre →45 dk mesai. Net zaman çizgisinde hedef+tolerans sınırını geçen segmentlere dağıtılır; `overtimeEnabled=false` ödeme üretmez.
10. `weekly45`: gerçek net süre 2700 dk haftalık havuza gider; günlük hedef aşımı sadece bilgi alanıdır, ayrıca eklenmez. Tatil/hafta tatili premium segmentleri mevcut şekilde ayrı kalır; devre dışı mesai segmentleri haftalık hakkı tüketmeye devam eder (`convex/lib/overtimeCalc.ts:118`, `convex/lib/overtimeCalc.ts:142`).
11. Gece `nightShiftDayMode=shiftStart|splitAtMidnight` ve `nightCombineMode` korunur; günlük hedef gece yarısında sıfırlanmaz. Pazar→Pazartesi ve ay sonu için mevcut genişletilmiş okuma aralığı korunur (`convex/lib/overtimeCalc.ts:99`, `convex/lib/pdksDay.ts:167`, `convex/lib/pdksWorkDay.ts:69`).
12. Esnek günde final devamsızlık/eksik okutma, en geç geçerli çıkış ve azami oturum kapanmadan verilmez; o ana kadar “Devam ediyor”. Mevcut sabit başlangıç+tolerans beklemesi esneğe uygulanamaz (`convex/lib/pdksTable.ts:59`). Yeni polling/cron yok; mevcut abonelik ve ekran etkileşimindeki hesap zamanı kullanılır.
13. Tatil/hafta tatili ve onaylı tam gün izinde zorunlu hedef 0; çalışılmış gerçek süre yine gösterilir. Mevcut ücret katsayıları korunur. Yarım gün tatilde öneri hedef/2; saatli izin veri sözleşmesi **[teyit]**, ilk sürüm yalnız tam gün izinle hedefi kaldırır.
14. Mevcut durum “devam > izin” derken bordro kodu “tatil > hafta sonu > izin > devam” diyor (`convex/lib/pdksCalc.ts:146`, `convex/lib/pdksHelpers.ts:200`). Bu fark legacy'de korunur; yeni modda da izin kodu ve gerçek çalışma ayrı gösterilir, izin+çalışma inceleme uyarısı alır.
15. Esnek molada belirli saat penceresi olmadığı için “mola ihlali” üretilmez. Mevcut kontrol saat penceresi ve 450 dk brüt eşik kullanır (`convex/lib/pdksCalc.ts:94`); süre molasını bu kontrole sokmak yanlış alarm üretir.

### Senaryolar

Ortak: hedef 480, mola 60, giriş 05:00–22:00, çıkış D 05:00–D+1 14:00, azami 16 sa; `dailyShift`, tolerans 0; sıradan iş günü, iki yön zorunlu. Eksik okutma tercihi “İnceleme”.

| Senaryo | Okutma | Net / eksik / günlük mesai (dk) | Sonuç |
|---|---|---|---|
| Normal | 08:00→17:00 | 480 / 0 / 0 | N, tam süre |
| Geç başlayıp tam süre | 12:00→21:00 | 480 / 0 / 0 | N; geç kalma yok |
| Eski plana göre erken çıkış | 05:00→14:00 | 480 / 0 / 0 | N; erken çıkış yok |
| Eksik süre | 09:00→16:00 | 360 / 120 / 0 | N + Eksik süre; DV değil |
| Fazla süre | 08:00→18:00 | 540 / 0 / 60 | N; weekly45'te 60 otomatik ödenmez |
| Pencere dışı giriş | 04:30 giriş, 13:30 çıkış | ölçülemez / — / 0 | Giriş dışlanır, eksik giriş incelemesi |
| Gece geçen | D 21:00→D+1 06:00 | 480 / 0 / 0 | D'ye tek gün; gece neti ayrıca |
| Yalnız giriş | 09:00 giriş | ölçülemez / — / 0 | — + Eksik çıkış; kapanana dek bekler |
| Yalnız çıkış | 17:00 çıkış | ölçülemez / — / 0 | — + Eksik giriş; giriş icat edilmez |
| Hiç okutma | yok | ölçülemez / — / 0 | Bilinen/verisi yeterli tamamlanmış iş gününde DV |
| Tam gün izin | yok | 0 / 0 / 0 | İZN, hedef 0 |
| Tatilde çalışma | 08:00→17:00 | 480 / 0 / 480 | RT; mevcut premium kuralı |

## 2. Giriş/çıkış zorunluluğu

### Varsayılan ve ayar modeli

- **Birebir varsayılan legacy olmalı:** `hasAttendance=!!firstISO||!!lastISO`; tek ham okuma yönü çıkış olsa bile ilk giriş yerine konuyor; tek okuma 0 dakika/N (`convex/lib/pdksDay.ts:65`, `convex/lib/pdksDay.ts:79`, `convex/lib/pdksDay.ts:252`, `convex/lib/pdksPayroll.test.ts:141`). Sadece iki boolean ekleyerek birebir uyumluluk sağlanamaz.
- Ayarlar > Çalışma'ya “PDKS devam kuralları” bölümü: `punchMode="legacy"|"requirements"`, `requireCheckIn`, `requireCheckOut`, `missingRequiredPunch="absent"|"review"`, `noPunch="absent"|"review"`. “Mevcut davranış” başlangıç seçimi; requirements açılırsa öneri ikisi zorunlu, eksik tek yön inceleme, hiç okutma devamsız.
- Opsiyonel `workSettings.pdksRuleVersionId` yalnız güncel ayar başını gösterir. Tarihli kurallar yeni `pdksRuleVersions` tablosunda: `projectId,effectiveFrom,punchMode,requireCheckIn,requireCheckOut,missingRequiredPunch,noPunch,checkpointMode,createdAt,createdBy`; indeks `by_projectId_and_effectiveFrom`.
- Tarihte sürüm yoksa legacy+all kullanılır; eski kayıtlar yazılmaz. Yeni sürüm gün başlangıcından geçerli, geçmişe etkili kayıt ilk sürümde kapalı; eski sürümler değiştirilemez. “Yürürlük tarihi” varsayılan yarın; gece oturumu giriş gününün sürümünü taşır.
- Dönem için başlangıçtaki son sürüm + dönem içi sürümler bir kez yüklenir; ör. 64 sürüm/rapor bütçesi, aşılırsa açık daraltma hatası; çalışan başına query yok. Aynı proje/tarih için tek sürüm transaction kontrolüyle korunur.

### Kombinasyon matrisi

Tamamlanmış, çalışılması beklenen, istihdam/veri kapsamı bilinen günler. **M** = `missingRequiredPunch` seçimine göre DV veya “Eksik okutma / inceleme” (yeni `incomplete` durum, kod —). **H** = `noPunch` seçimine göre DV veya incomplete/—. İnceleme günleri devam/devamsız/SGK gününe kesin olarak eklenmez.

| Giriş zorunlu | Çıkış zorunlu | Geçerli çift | Yalnız giriş | Yalnız çıkış | Hiç |
|---|---|---|---|---|---|
| Evet | Evet | N, ölçülen süre | M, süre belirsiz | M, süre belirsiz | H |
| Evet | Hayır | N, ölçülen süre | N, süre belirsiz | M, süre belirsiz | H |
| Hayır | Evet | N, ölçülen süre | M, süre belirsiz | N, süre belirsiz | H |
| Hayır | Hayır | N, ölçülen süre | N, süre belirsiz | N, süre belirsiz | H |
| Legacy (alanlar yok) | — | Mevcut N/geç ve hesap | Mevcut N/geç, 0 dk | Ham okuma ilk giriş sayılır; N/geç, 0 dk | Mevcut DV/izin/tatil/noData/future |

- Zorunlu olmamak, kanıtsız tam çalışma süresi vermek değildir; ikisi kapalıyken de hiç okutma H'dir. N + ölçülemez süre gün sayımına katılır, saat/mesaiye katılmaz; görünür “Süre hesaplanamadı” uyarısı gerekir.
- Yeni modda açık `direction` esas; en erken giriş ve onu izleyen en son çıkış seçilir. İki giriş çift değildir; çıkış→giriş ters çift değildir. Yönsüz okumalar “Yön belirsiz” incelemesine gider, otomatik devamsızlık sayılmaz.
- Manuel giriş/çıkış alanları kendi yönleriyle geçerli kanıttır; eksik taraf ham kayıttan ancak uygun yönde tamamlanır. Yeni mod legacy'nin yönsüz fallback girişini kullanmaz; düzeltme notu/audit korunur (`convex/lib/pdksDay.ts:69`).
- Öncelik: istihdam dışı/future/veri belirsiz → tatil/izin → seçilen devam kuralı. M/H yalnız beklenen iş gününe DV verebilir; tatilde eksik çıkış kalite uyarısıdır. `incomplete` rapor paydasından çıkarılır ve ayrı sayaçla gösterilir.
- `resolveDayStatus` yalnız durum çözümlesin; yön eşleme ve zorunluluklar ortak saf `resolveAttendanceEvidence` yardımcısında olsun. `computePdksDay` ve tüm tüketiciler aynı `attendanceCredit`/kalite sonucunu kullansın.

## 3. PDKS check point

### Seviye, saklama ve eşleme

- **Öneri: kapı düzeyi, cihaz toplu seçim/fallback düzeyi; okuyucu seçimi ilk sürümde yok.** Tek panelin iç kapısını dışlayabilmek için yalnız cihaz yetersiz; aynı kapıdaki iki yönü kapsamak doğal. Okuyucular N:1 kapıya bağlı, fakat Hik olayları okuyucu numarası taşımıyor (`convex/schema.ts:288`).
- Okuma belgesinde `deviceId`, `ideIoId`, opsiyonel yön var; `doorId/readerId/hikDoorNo` yok (`convex/schema.ts:501`). IDE eşleme `deviceId+ideIoId→door.ioId` olarak zaten yapılıyor (`convex/lib/cardReadingAudit.ts:42`, `convex/lib/cardReadingAudit.ts:76`).
- `checkpointMode="all"|"selected"` sürümün parçası; yoksa all. “Hepsi” mevcut **kaynak uygunluğu** filtresini kaldırmaz: biyometrik/belirsiz kaynak hâlâ hariç (`convex/lib/pdksSource.ts:72`).
- Yeni `pdksCheckpointSelections`: `projectId,ruleVersionId,targetType,deviceId,doorId?,ioId?,eventDoorNo?`; indeks `by_ruleVersionId`. Kapı hedefi seçildiği andaki fiziksel eşlemeyi saklar; ad/değişen güncel kapı ilişkisi geçmiş hesabı değiştirmez. Liste sürüm başına en fazla 500 hedef, yayınlama tek mutation/tek audit; sınırsız array yok.
- IDE kapısı için cihaz+io kimliği; tek kapılı cihaz için yalnız tek kapı olduğunun doğrulanmasıyla cihaz eşleme. Çok kapılı Hik'te kapı numarası kanıtı yoksa kapı seçimi devre dışı; açık “Cihazın tüm geçişleri” hedefi seçilebilir, aksi halde bilinmeyen eşleme dışlanır ve sayısı gösterilir.
- İleride olaydan doğrulanmış `eventDoorNo/readerId` opsiyonel saklanabilir; mevcut rawData'nın güvenilir kapı no içerdiği **[teyit]**. Bu tasarım buna bağımlı değildir. Okuyucu yönünü kimlik yerine kullanmak yasak; iki okuyucu aynı yönde olabilir.
- selected+boş liste kaydetme hatası; projeler arası hedef reddi; cihazı olmayan mobil/QR olay selected modda hariç ve açıklamalı. Onaylı `pdksRecords` manuel düzeltmesi fiziksel check point şartına tabi değildir; yine proje/çalışan/yetki sınırındadır.

### Tek sınır ve tutarlılık

- Tek karar yordamı `pdksSource.ts` içindeki `filterPdksReadings` genişletilerek kurulmalı: proje + kaynak + sürüme göre check point. Çağıranlar önceden yüklenmiş saf eşleme/sürüm resolver'ı verir; okumalar başına DB çağrısı yok (`convex/lib/pdksSource.ts:78`).
- `cardReadings` tablo/bordro/detay sınırları zaten bunu çağırıyor (`convex/cardReadings.ts:468`, `convex/cardReadings.ts:666`, `convex/cardReadings.ts:1323`); rapor yükleyicisi `readReportReadings` üzerinden geçiyor (`convex/lib/reportScope.ts:33`). Hepsi yeni sözleşmeye taşınır.
- `pdksFirstRecordDate` ve `readPdksAvailableDateKeys` bugün doğrudan `isPdksEligibleReading` kullanıyor; aynı karar yordamına bağlanmalı (`convex/lib/pdksAvailability.ts:18`, `convex/lib/pdksAvailability.ts:60`). Aksi halde iç kapı verisi dışlanan günü yanlış DV yapabilir. 20 aday sınırı korunur; kanıt yoksa noData.
- Sürüm iş gününe bağlıdır: önce kaynak/proje adaylarıyla potansiyel günler belirlenir, her aday kendi gününün politikasıyla süzülür, sonra eşlenir; hariç iç-kapı girişi oturum açamaz. Önceki gün çıkışı sürüm sınırında yeni kurala düşmemeli; bu işlem ortak hazırlama yardımcısında tek kez yapılır.
- İstihdam/veri varlığı, check point hariç ve yön belirsiz sayaçları ayrı tutulur. Tamamı dışlanmış proje gününü kesin devamsız yapmak yerine mevcut noData semantiği korunur; neden “Seçilen noktalarda veri yok” olarak gösterilir.
- Ham Okutmalar/Mobil Okutmalar birer denetim raporudur: kayıtlar gizlenmez; opsiyonel “PDKS'e dahil / hariç nedeni” kolonu eklenir. Mevcut ham rapor sınırı sadece biyometriyi saklıyor (`convex/lib/reportAttendance.ts:200`). Hesap raporları ve bordro filtrelenmiş girdiyi kullanır.
- **SGK bugün ortak motor değil:** yalnız çalışan kimliğiyle eşler, takvim tarihini workedDays'e koyar; manuel kayıt/gece eşleme yok (`convex/sgkExport.ts:64`). Yeni kurallı tarihlerde `workedDays`, ortak gün sonucundan üretilmeli; ay sonu+1 gün, kart eşleme, manuel düzeltme, izin ve checkpoint aynı olmalı.
- SGK'nin eksik gün/izin nedenleri ayrı kalır (`convex/lib/sgkEksikGun.ts:40`); eksik **dakika** gün eksiltmez. İnceleme günleri varsa önizleme sebebi gösterir, kesin APHB indirmesi düzeltme tamamlanana kadar açılmaz; belirsizliği sıfır eksik gün kabul etmek yasak.
- Legacy tarihlerde SGK'nin mevcut sonucu korunur; mevcut gece/manüel farkı otomatik “düzeltmek” geriye uyumluluğu bozar. Gelecek kurallı tarihler için ortak motor adaptörü kabul testidir; geçmiş farklar ayrı inceleme konusu olarak görünür.
- Yeniden yazım/backfill/cron gerekmez: sonuçlar sorguda hesaplanıyor. Sürüm öncesi tarih aynı kalır; geçmişe yeniden hesap ilk sürümde kapalı. İndirilen eski dosyalar değişmez. Esnek vardiya düzenlemesi de eski tanımı değiştirmek yerine yeni tanım+gelecek tarihli atama olmalı.
- Bu ayarlar yalnız PDKS hesabıdır; kapı yetkisi veya donanım konfigürasyonu değildir, **cihaz senkronu gerektirmez**. İleride aynı ekranda fiziksel ayar değişirse mevcut birleştirilmiş tek senkron işi kullanılır; W2 kapanış akışı tetiklenmez.

## 4. Özel dışa aktarma

### Ekranlar ve katalog

- `/reports` 16 tanımı kapsıyor (`src/lib/reports/registry.ts:70`). Kolon seçici ve seçilen kolonlarla export **zaten var** (`src/components/reports/ReportPage.tsx:32`, `src/components/reports/ReportPage.tsx:43`); yeni paralel rapor altyapısı gerekmiyor.
- PDKS Dışa aktar paneli Excel/CSV/PDF, ayrı aylık bordro ve APHB sunuyor; genel export sabit fonksiyonlara gidiyor (`src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx:98`, `src/utils/pdksExport.ts:57`). Buraya aynı katalog tabanlı seçim/önizleme eklenmeli.
- Genel PDKS export seçili/filtreli satırlar; aylık bordro tüm proje/aydır; mevcut açıklama korunur (`src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx:171`). APHB XML alanları kurumsal sözleşmedir; kolon seçicisi uygulanmaz.
- `ReportColumn` genişletmesi: kararlı `key,label,value,dataType,sensitivity,requiresPay,defaultExportVisible`; `unknown` doğrulama, typed row union/`FunctionReturnType`, `any` yok. Yeni kolonlar aşağıda **öneri**; mevcut katalog `src/lib/reports/registry.ts:41`.

| Kolon grubu | Örnek kararlı anahtarlar | Varsayılan / kapsam |
|---|---|---|
| Kimlik/organizasyon | name, department, payrollEmployeeCode | Ad/departman açık; sicil isteğe bağlı |
| Gün/plan | date, shift, scheduleType, requiredNetMinutes | Tarih/vardiya açık; hedef esnekte açık |
| Gerçekleşen | firstEntry, lastExit, duration, breakMinutes, nightMinutes | Giriş/çıkış/net açık, diğerleri kapalı |
| Sonuç/istisna | status, payrollCode, shortfallMinutes, punchQuality, durationMeasured | Durum açık; eksik süre/kalite ilgili raporda açık |
| Mesai/ücret | overtime, hourlyRate, overtimePayTRY | Süre açık; parasal kolonlar kapalı + payVisibility |
| Ham geçiş | time, device, door, direction, source, pdksIncluded, exclusionReason | Yalnız ham raporlar; mevcut odak kolonları korunur |
| Hassas | tcNo, cardNo, email, phone | Varsayılan kapalı; tcNo/email/phone genel DTO'da yoksa sunucu izni olmadan eklenmez |
| Aylık | day:01…day:31, workedDays, absentDays, incompleteDays | Gerçek aya göre günler; inceleme ayrı |

- Export kolon sırası değiştirilebilir; en az bir kolon; önizlemede gerçek sıra ve 5 satır. Ekran görünümü başlangıç seçimini verir; export seçimi ekranı değiştirmez. Türkçe etiketler ve hata mesajları.
- CSV ayraç `;` (mevcut varsayılan), `,`, TAB; UTF-8 BOM; quote/newline/seçilen ayraç kaçışları; sayı/süre türü korunur. Formül enjeksiyonu koruması bütün formatlarda sürer (`src/lib/reports/export.ts:20`).
- Excel bugün süre kolonuna otomatik `(dk)` kolonu ekliyor (`src/lib/reports/export.ts:128`); özel export'ta bunun görünür seçeneği olmalı, seçilmeyen kolon sessiz eklenmemeli. PDF 2000 satır limiti ve yatay kolon bölme korunur (`src/lib/reports/export.ts:5`).
- Ham raporda yüklenen sayfa kapsamı açık kalmalı; kolon seçmek yeni “tüm veri” sorgusu başlatmaz. Ayraç/sıra değişiminde Convex çağrısı yok; aylık veri kullanıcı indirmeyi başlattığında mevcut bir query ile alınır.

### Şablon ve KVKK

- İlk sürüm için **yeni Convex export şablon tablosu gerekli değil**. Proje+kullanıcı+rapor bazlı localStorage zaten var (`src/lib/reports/columns.ts:1`); export tercihini ayrı sürümlü anahtarda `{version,orderedColumnKeys,format,delimiter}` olarak tutmak yeterli. Satır/hassas veri saklanmaz.
- Tarih/çalışan filtreleri şablona bağlanmaz; aylık günler anahtar şablonundan o aya üretilir. Bilinmeyen/silinmiş kolonlar elenir; kullanıcı/proje değişince tercihler yeniden çözülür. Hassas kolonlar her indirmede tekrar seçilir, kalıcı tercihten otomatik açılmaz.
- Birden fazla adlandırılmış/paylaşılan/cihazlar arası şablon gereksinimi doğrulanırsa ikinci aşama `reportExportTemplates(projectId,ownerUserId,name,reportKey,columnKeys,format,delimiter,version,updatedAt)`; `by_projectId_and_ownerUserId`, kullanıcı başına ör. 20 şablon, dar okuma ve sahiplik kontrolü. Bu ihtiyaç **[teyit]**.
- T.C. vb. hassas kolonlarda varsayılan kapalı olmak erişim yetkisi değildir: sunucu alanı yalnız yetkili rol ve açık istekle döndürmeli. Genel export için yeni hassas DTO erişimi ayrı test şartıdır; APHB'nin mevcut T.C. alanı özel akışta kalır (`convex/sgkExport.ts:96`).
- Parasal kolon seçimi/kayıtlı tercih hiçbir zaman `canSeePay` sınırını aşamaz; backend maskesi korunur, UI ve serializer ayrıca katalogdaki `requiresPay` kolonlarını eler (`convex/lib/payVisibility.ts:4`, `convex/cardReadings.ts:386`, `convex/cardReadings.ts:1403`).

## 5. Etki analizi ve W2 birleşimi

| Alan / dokunulacak yer | Test ve kırılma riski |
|---|---|
| `schema.ts`, `settings.getWork`, yeni sürüm yayınlama; `pdksHelpers.getEffectiveWorkSettings` | Yeni `pdksRules.test.ts`: alan yok=legacy; yetkisiz/yabancı proje; sürüm tarihi/bütçe. `saveOvertime` kural başını silmemeli (`convex/settings.ts:192`). |
| `shifts.create/update`, `validateShift`, `scheduleIntervals`, `settingsForShift`, atama çakışması | `shiftUx.test.ts`, `shiftAssign.test.ts`; fixed aynı, esnek pencere/azami süre çakışması. Bugün aralık yalnız start/end kullanıyor (`convex/lib/shiftUx.ts:39`); 24 saat esnek pencerede iki atamayı fark etmeden kabul etme riski. |
| `pdksWorkDay/groupPdksWorkDays/manualPdksTimes`, yeni evidence resolver; `computePdksDay` | Yeni `pdksFlexible.test.ts`, `pdksAttendanceRules.test.ts`; 12 senaryo, 4 kombinasyon, aynı okuma iki güne giremez; mola/gece dakikası korunumu. |
| `pdksCalc.resolveDayStatus/computeBreakViolation`, `pdksTable.computePdksTableRow/classifyPdksDay`, `pdksPayroll.computePayrollCell`, `pdksDetail.computeAttendanceDetailDay`, `overtimeCalc.calculatePeriodOvertime` | `pdksCalc.test.ts`, `pdksTable.test.ts`, `pdksDetail.test.ts`, `pdksPayroll.test.ts`, `pdksPayroll.overtime.test.ts`, `overtimeCalc.test.ts`; tek okutma N/0 beklentileri yalnız legacy'de korunmalı. |
| `pdksSource.filterPdksReadings`, `pdksAvailability`, `reportScope.readReportReadings`, 3 cardReadings query'si | `pdksSource.test.ts`, `pdksAvailability.test.ts`, `reportScope.test.ts`; yeni `pdksCheckpoint.test.ts`: IDE, tek kapı, belirsiz Hik, QR, silinen kapı, foreign project, sürüm gecesi. |
| `reportAttendance.loadAttendanceReport/summarizeAttendance`, `sgkExport.buildAphbForMonth` adaptörü | `reportAttendance.test.ts`, `sgkEksikGun.test.ts`, yeni `pdksRules.handlers.test.ts`: aynı çalışan/günde tablo=detay=bordro=devam=kurallı SGK; manuel, kart-only, ay sonu ve incomplete kapsanır. |
| Gece tüketicileri/ayarları | `pdksNight.handlers.test.ts:198`, `pdksNight.handlers.test.ts:265`, `pdksNightSettings.test.ts:65`; weekly45+splitAtMidnight ay/hafta sınırı regresyonu yüksek. Üretim gece kodu ayrı pdksNight dosyasında değil, pdksDay/pdksWorkDay/overtimeCalc içinde. |
| `/shifts` form/etiket/takvim, `WorkAndPayrollSettings`, PDKS durum/sayaçlar ve rapor rows/registry | `src/components/shifts/lib/auditFixes.test.tsx`, `src/components/settings/settings.test.tsx`, `src/lib/reports/rows.test.ts`; esnek “geç/erken” filtresine düşmez, incomplete DV sayılmaz. |
| `PDKSEnhancedExportPanel`, `pdksExport`, `reports/columns/registry/export`, `ReportPage` | `src/lib/reports/{export,excel,pdf,registry}.test.ts`, `src/components/reports/ReportPage.test.tsx`, yeni export panel testi; sıra, CSV escaping, Excel türev dk, boş seçim, hassas/ücret kolon sızıntısı. |

- W2'nin `employedDuring` dönem kadrosu, `employedOn` gün kapsamı korunmalı; son çalışma günü dahil, eski tarihsiz pasifler hariç (`convex/lib/employment.ts:8`). Yeni kural, ayrılmış kişiyi tekrar “aktif” yapamaz.
- Entegrasyon noktaları: `cardReadings.ts:443`, `cardReadings.ts:564`, `cardReadings.ts:738`, `cardReadings.ts:1383`; `reportAttendance.ts:26`, `reportAttendance.ts:76`; `sgkExport.ts:89`. W2'nin değişmiş dosyaları üzerine eski kopya yazılmamalı.
- Önemli sınır: tablo `allCalculations` tarihlerini yeniden kuruyor (`convex/lib/pdksTable.ts:250`); sadece dış `periodDateKeys` süzmesi yetmez. Haftalık mesai ön günleri dahil her hesap gününde `employedOn` uygulanmalı; istihdam dışı okumalar haftalık 45 saati doldurmamalı.
- Son çalışma gününde başlayıp ertesi sabah biten esnek oturum, çalışılan **gün** bakımından son güne dahildir; fiziksel erişim W2 tarafından gece kapanabilir (`convex/employeeTermination.ts:92`). Çıkışın fiziksel olarak engellenip engellenmeyeceği **[teyit]**; W5 cihaz yetkisini uzatmaz, gerekirse manuel düzeltme gerekir.
- W2'nin çalışan bileşenleri ve termination mutation'ları değiştirilmez; cihaz drawer'ına ikinci editör konmaz. Check point seçicisi Çalışma ayarlarında mevcut kapı/cihaz verisini okuyarak çalışır; drawer çalışmasıyla sahiplik çakışmaz (`src/pages/Devices.tsx:43`).
- En büyük üç risk: **(1)** mevcut yönsüz tek okutma/SGK farkını yanlışlıkla geçmişe uygulamak; **(2)** esnek gece eşlemesiyle haftalık havuz veya W2 son gününü kaydırmak; **(3)** Hik kapı/okuyucu kimliğini varsayıp yanlış geçişi saymak.
- Free plan bütçesi: yeni polling/cron yok; proje/dönem/sürüm/cihaz başına toplu yükleme, limit+1 ile taşma algısı ve Türkçe hata; sessiz kesme yok. Mevcut sınırsız yükleyiciler genişletilmemeli (`convex/lib/shiftResolver.ts:36`, `convex/lib/reportScope.ts:32`); touched loader'larda toplam okuma bütçesi ve indeksli sayfalama uygulanmalı.
- İnceleme sırasında test çalıştırılmadı; kod değişmedi. Uygulama kabulü yerel testler + `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` + `node_modules/.bin/eslint src convex`; TS ve no-explicit-any sıfır. Canlı Convex komutu bu tasarımın parçası değildir.

## Uygulama adımları

1. **Uyumluluk sözleşmesi ve fixture'lar (0,5 gün):** fixed/legacy için mevcut çıktı altın örnekleri; W2 son gün ve SGK farkını sabitle. Kabul: mevcut fixture sonuçları değişmez.
2. **Opsiyonel şema + tarihli ayarlar + bütçeli loader (1 gün):** sürüm/selection tabloları ve admin yayınlama; geçmişe etki kapalı. Kabul: legacy fallback, project RBAC, atomik yayın, limit aşımı testleri.
3. **Esnek vardiya ve saf hesap (1,5–2 gün):** form/backend validator, gün/yön eşleme, net hedef ve segment mesaisi; atama çakışması. Kabul: senaryo matrisi, çift tüketim yok, haftalık/gece dakika korunumu.
4. **Check point sınırı ve tüm hesap tüketicileri (1–1,5 gün):** ortak predicate, availability, W2 filtresi, rapor/SGK yeni mod adaptörü. Kabul: beş tüketicide aynı karar; legacy sonuçları sabit; eşlenemeyen Hik görünür.
5. **Türkçe ayar/istisna UI ve ortak export seçici (1–1,5 gün):** mevcut rapor kataloglarıyla sıra/ayraç/local tercih, parasal/hassas alan koruması. Kabul: UI export seçimi ile CSV/XLSX/PDF kolonları aynı; APHB sabit.
6. **Birleşik yerel regresyon ve inceleme (0,5–1 gün):** W2 testleri, gece/mesai, SGK, yetki, büyük veri bütçesi; TS/lint. Kabul: testler yeşil, hiçbir senkron/polling eklenmemiş; kullanıcı onayına hazır değişiklik özeti. Toplam yaklaşık 5,5–7,5 geliştirici-gün.

## Emre'ye açık kararlar

1. **Eksik okutma sonucu:** önerim eski projeler legacy; yeni gereksinim modunda iki yön zorunlu, tek yön “İnceleme”, hiç okutma “Devamsız”; otomatik tam süre üretmeyelim.
2. **Eksik süre ve tatil hedefi:** önerim eksik süreyi dakika uyarısı tutmak, ücret/SGK gününe otomatik çevirmemek; tam tatil/izin hedef 0, yarım tatil hedef yarım.
3. **Tarih ve check point kapsamı:** önerim kuralları yarından geçerli sürümle kaydetmek; ilk sürüm kapı+cihaz, okuyucu seçimini gerçek olay kimliği gelene kadar açmamak; geçmiş yeniden hesap ayrı iş olsun.
4. **Export şablonu:** önerim ilk sürüm yerel son seçim+sıra+ayraç; adlandırılmış/paylaşılan şablon tablosunu somut ihtiyaç oluşunca eklemek.

# Esnek ↔ Sabit vardiya denetimi

Tarih: 2026-10-26. Kapsam: belirtilen commit'lenmemiş diff, yeni sürüm dosyaları ve bunların ilgili okuma çağrıları. Kaynak, test ve şema dosyaları değiştirilmedi; canlı/veritabanı işlemi, kurulum, codegen, migration, commit veya yayın yapılmadı.

**Sonuç: Engel 0 / Önemli 5 / Düşük 2.** Testlerin geçmesi aşağıdaki eksik senaryoları kapsamıyor. Önemli bulgular giderilmeden sürüm davranışının tamamlandığı kabul edilmemeli.

## Önemli

### O1 — Saat düzenlemesi mevcut planları geçersiz hale getirebiliyor

- **Konum:** `convex/shifts.ts:580` (580–582); atama doğrulaması `convex/lib/shiftPlan.ts:69` ve `convex/lib/shiftPlan.ts:98`.
- **Senaryo → yanlış sonuç:** Aynı gün A=09:00–12:00, B=12:30–17:00 içeren geçerli bir haftalık plan var. A'nın bitişini bugünden itibaren 14:00 yapınca `update` başarılı oluyor ve eski sürüm açılıyor; mevcut plan artık 12:30–14:00 arasında çakışıyor. Aynı planı yeni değerlerle `validateShiftPlan` üzerinden göndermek ise “Ardışık vardiyalar arasında en az 30 dakika olmalıdır” hatası veriyor. Güncelleme yalnız tek tanımı `validateShift` ile kontrol ediyor; kişisel/departman planı veya komşu gün doğrulaması yapmıyor. Gece/esnek çıkış penceresi değişikliği de önceden geçerli ardışık günleri bu yoldan bozabilir.
- **Kanıt:** Gerçek `update.handler` ve `validateShiftPlan`, yalnız bellekte tutulan sahte DB bağlamıyla çalıştırıldı: `overlapping update accepted: 14:00 versions: 1`, ardından aynı plan doğrulaması reddedildi. Canlı DB'ye yazılmadı.
- **Önerilen düzeltme:** Sürüm açma ve patch öncesinde bu tanımı kullanan kişisel ve departman planlarını aynı transaction içinde bulup `effectiveFrom` sonrası ve sınırın iki yanındaki günler için tarihli tanımlarla doğrulayın. Aynı gün sıralaması, 30 dakika boşluk, gece taşıması ve esnek→sabit geçişi korunmalı; bozan güncelleme tamamen reddedilmeli. Plan referanslarının değişimini de okuyarak eşzamanlı atama/güncellemenin aynı doğrulamaya tabi olmasını sağlayın.

### O2 — Eski sabit tanımlar yeni formdan kaydedilemiyor

- **Konum:** `convex/shifts.ts:573` ve `convex/shifts.ts:579`; payload kaynağı `src/components/shifts/definitions/AddShiftDialog.tsx:49`.
- **Senaryo → yanlış sonuç:** Eski bir sabit tanımda `scheduleType` yok. Form bunu `"fixed"` olarak açıp tam payload ile gönderiyor. Backend `undefined` ile `"fixed"` değerlerini farklı kural sayıyor ve “Vardiya türünü değiştirmek için yeni tanım oluşturun” diyerek reddediyor. Yalnız ad veya aktiflik değişikliği bile kaydedilemiyor; gerçekte vardiya türü değişmiyor.
- **Kanıt:** `scheduleType` alanı olmayan kayıt için `{ name: "Yeni ad", scheduleType: "fixed" }` ile gerçek handler bellekte çağrıldı ve aynı hata alındı. Mevcut dialog testi yalnız callback'i taklit ediyor, backend ile bu payload birleşimini sınamıyor.
- **Önerilen düzeltme:** Tür karşılaştırmasını her iki tarafta `scheduleType ?? "fixed"` üzerinden yapın; semantik olarak eşdeğer alan normalizasyonu sürüm açmamalı ve tür değişikliği hatası üretmemeli. Eski tanım + gerçek form payload'ı için entegrasyon testi ekleyin.

### O3 — Eski çalışan vardiyası fallback'i tarihli çözümlemeyi atlıyor

- **Konum:** `convex/lib/cardReadingProcess.ts:68`; aynı eksik okuma `convex/lib/pdksManualWrite.ts:61`.
- **Senaryo → yanlış sonuç:** Çalışanın yalnız `employee.shiftId` bağlantısı var, o gün uygulanabilir kişisel/departman planı yok. Tanım 25 Ekim'e kadar 22:00–06:00; 26 Ekim'den itibaren 09:00–17:00. 25 Ekim 22:00 girişinden sonra 26 Ekim 06:00 okutmasında, yüklenen eski sürüme rağmen fallback güncel belgeyi döndürüyor. `resolveDirection` bunu **entry** olarak sınıflandırıyor; korunması gereken eski gece kuralı **exit** üretirdi. Aynı geçmiş günün 22:00→06:00 elle düzeltmesi güncel gündüz tanımı yüzünden reddediliyor.
- **Kanıt:** Gerçek `resolveDirection`, `createShiftResolver`, `manualValidationShift` ve elle doğrulama fonksiyonları bellek verileriyle çalıştırıldı: `old night exit: entry`, `historical manual fallback hours: 09:00 17:00`, `Çıkış saati giriş saatinden sonra olmalı`.
- **Önerilen düzeltme:** Resolver'ın tarihli ID lookup'ını açık bir `shiftAt(id, date)` API'si olarak sunup her iki fallback'te kullanın; yön yolunda zaten yüklenen `versions` verisini fallback'e de uygulayın. Bu değişiklik çalışan fallback'ine PDKS hakedişi kazandırmamalı; yalnız mevcut yön/elle doğrulama sözleşmesi tarihli olmalı.

### O4 — Vardiya takvimi geçmiş günlerde güncel saatleri gösteriyor

- **Konum:** `src/components/shifts/calendar/shiftCalendarModel.ts:34` (ayrıca 36–38, 47–52); veri kaybı noktası `convex/shiftPlans.ts:160`; gösteren bileşen `src/components/shifts/ShiftCalendarCell.tsx:65`.
- **Senaryo → yanlış sonuç:** 26 Ekim'de 09:00–17:00 tanımı 10:00–18:00 olarak güncellendiğinde 24 Ekim PDKS hesabı eski sürümü kullanıyor, fakat vardiya takviminin 24 Ekim hücresi **10:00–18:00** gösteriyor. `planCells` tarihli planı çözüyor ama yalnız `shiftIds` döndürüyor; frontend bu ID'leri güncel `shifts` listesiyle tekrar dolduruyor. Gece→gündüz değişikliğinde eski günün ertesi güne devam işareti de kayboluyor ve çakışma işaretleri güncel saatlerden hesaplanıyor.
- **Kanıt:** Gerçek `resolvedCalendarDay`, geçmiş tarihli hücre ve sürümlenmiş güncel belgeyle bellekte çağrıldı; `resolved.shifts` saatleri `10:00, 18:00` çıktı. API hücresi eski saatleri taşıyamadığı için frontend'in doğru geçmişi üretme olanağı yok.
- **Önerilen düzeltme:** `planCells` yanıtına o güne ait çözülmüş vardiya gösterim/saat alanlarını ekleyin; hücre, önceki gün devamı ve çakışma hesabını bunlarla besleyin. Sadece ID üzerinden güncel listeye yeniden bağlamayın.

### O5 — Esnek vardiya gece yarısında bittiğinde 30 dakika kontrolü atlanıyor

- **Konum:** `convex/lib/shiftPlan.ts:109`.
- **Senaryo → yanlış sonuç:** Esnek tanımın giriş penceresi 05:00–22:00, en geç çıkışı ertesi gün 00:00, `maxSpanMinutes=960`; ertesi gün sabit tanım 00:10–04:00. `flexibleSessionEnd` 1440, `tail` 0 oluyor. `tail > 0` kapısı nedeniyle iki gün arasında yalnız **10 dakika** olmasına rağmen döngü kabul ediliyor. Bir önceki gün 23:50 bitiş ve ertesi gün 00:10 başlangıcı gibi negatif tail senaryoları da aynı nedenle kaçıyor.
- **Kanıt:** Gerçek `validateShiftPlan` iki günlük döngüyle bellekte çağrıldı: `flex midnight -> fixed 00:10 accepted (10 minute gap)`.
- **Önerilen düzeltme:** Saatleri ortak dakika ekseninde karşılaştırıp sabit sonraki gün için `1440 + nextEntry - flexibleSessionEnd(flex) < 30` koşulunu uygulayın; `tail > 0` önkoşulunu kaldırın. 00:00 bitiş ve 23:50 bitiş sınırlarını test edin.

## Düşük

### D1 — Kişi toplamında eksik süre varsa fazla süre gizleniyor

- **Konum:** `src/components/pdks/lib/presentation.ts:70`; çağıran `src/components/pdks/dashboard/PDKSTableView.tsx:164` ve `PDKSMobileCardList.tsx:69`.
- **Senaryo → yanlış sonuç:** İki esnek günün birinde 120 dakika eksik, diğerinde 60 dakika fazla çalışma var; backend toplam satırında her iki alanı da gönderiyor (`convex/lib/pdksTable.ts:467`). Yeni etiket fonksiyonu eksik süreyi görünce erken dönüyor: **“Hedef 16:00 · eksik 02:00”** gösteriliyor, fazla 01:00 görünmüyor. Günlük satırda birbirini dışlayan bu değerler dönem toplamında birlikte bulunabiliyor.
- **Kanıt:** Gerçek `flexibleTargetLabel({ scheduleType: "flexible", requiredNetMinutes: 960, shortfallMinutes: 120, excessMinutes: 60 })` yukarıdaki metni döndürdü.
- **Önerilen düzeltme:** Eksik ve fazla parçalarını bağımsız oluşturup ikisi de pozitifse ikisini de gösterin; dönem toplamı için ayrı bir görünüm de kullanılabilir.

### D2 — Kişi Devam Dökümü Excel'inde esnek fazla süre kayboluyor

- **Konum:** `src/lib/reports/excel/personSheets.ts:66` (günlük hücreler: 81–86).
- **Senaryo → yanlış sonuç:** Esnek günün hedefi 480, net çalışması 540 dakika, fazla süresi 60 dakika; mesai kapalı olduğundan `overtimeMinutes=0`. Kişi toplamında `excessMinutes=60` hesaplanmasına rağmen Kişi Devam Dökümü Excel'i bu değeri ne özette ne günlük dökümde yazıyor. Yeni eklenen özet yalnız eksik süreyi taşıyor. Aylık Özet'in `personBlocks` çıktısı fazla süreyi taşıdığı halde kişi sayfası taşımıyor; fazla mesai sütunu bu verinin yerine geçmiyor.
- **Önerilen düzeltme:** Esnek gün varsa kişi sayfasına eksik/fazla süre alanlarını ekleyin; özellikle `excessMinutes` ayrı gösterilmeli. Günlük döküm isteniyorsa her iki değeri günlük satırlara da koyun. Sabit-yalnız sayfalarda alanlar açılmamalı; ek özet satırları mevcut 9. satırdaki izin başlığına taşmamalı.

## Kontroller ve kapsam sınırı

- `node_modules/.bin/tsc --noEmit -p convex`: başarılı, hata yok.
- İlk Vitest grubu: **11 dosya / 167 test başarılı** — shiftVersions entegrasyonu ve birim testleri, shifts, pdksFixedRules, pdksFlexible, shiftPlan.review, AddShiftDialog, shiftFormSchema, personMonth, registry, rows.
- İkinci Vitest grubu: **12 dosya / 132 test başarılı** — auditLogQuery, cardReadingProcess, shiftResolver, reportAttendance, reportScope, pdksManual, presentation, ShiftTree, assignmentPlans ve Excel testleri; verilen `pdksDay.test.ts` filtresi için ayrıca dosya bulunmadı, motor davranışı diğer testlerde kapsanıyor.
- **Toplam 23 dosya / 299 test başarılı.** İlave karşı örnekler kaynak TypeScript'i bellekte derleyen Node çağrılarıyla çalıştırıldı; test/kaynak dosyası oluşturulmadı, gerçek DB bağlantısı kullanılmadı.
- Sürüm sıralaması, dahil `validUntil` sınırı, önceki alanların temizlenerek snapshot uygulanması, aynı başlangıçta ikinci düzenlemenin yeni snapshot açmaması ve geçersiz/gelecek/önceki sınır tarihinin reddi incelendi. Snapshot + patch aynı mutation içinde; ayrı transaction kaynaklı bir yarım güncelleme tespit edilmedi. Eşzamanlı işlemler canlı sistemde koşturulmadı.
- Ana PDKS tablo/detay/bordro, mobil, dashboard/rapor ve geç e-postası yolları resolver üzerinden tarihli tanıma ulaşıyor; somut bypass bulguları O3 ve O4'te. `versionedUntil` ile `hasFixedShiftRules` keşif kapısının açık kalması kaldırılmış eski kuralların geçmişte hesaplanmasını sağlıyor; bu kapıda ayrıca kanıtlanmış bir hata bulunmadı.
- Esnekte minimum net çalışma eşiği ve tatil zorunluluğu mevcut yeni testlerde doğru sonuç veriyor. Ters sabit→esnek geçişte sabit gece bitişi ile esnek giriş başlangıcı mevcut dalda kontrol ediliyor; çok vardiyalı günler normalize edilip ilk/son tanıma göre kontrol ediliyor. O1 bu kontrolleri güncelleme sırasında bütünüyle atlıyor.
- Renk argümanları geçişte kabul edilip yazılmıyor; şema eski rengi kabul ediyor. `clearShiftColors` tanımlı rengi siliyor, silinmiş kaydı atlıyor ve sayfalayarak devam ediyor; idempotans açısından hata görülmedi. Migration çalıştırılmadı.
- Sabit-yalnız aylık raporda yeni esnek kolonlar varsayılan kapalı; `personBlocks` esnek kolonları veri varlığına göre açıyor. Bu koşulda ayrıca boş kolon hatası bulunmadı.
- Kapsam dışı `DeviceAddMenu.tsx`, `PageHeader.tsx` ve diğer oturum değişiklikleri denetlenmedi veya değiştirilmedi. Tarayıcı turu ve tam proje test paketi çalıştırılmadı; sonuçlar belirtilen statik inceleme, testler ve bellek karşı örnekleriyle sınırlı.

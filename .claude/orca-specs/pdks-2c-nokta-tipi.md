# PDKS 2c — PDKS noktası tipi (Giriş+Çıkış / Yalnız giriş / Yalnız çıkış) + Hik okuyucu no

ÖNCE `.claude/orca-specs/akis-ortak.md` dosyasını oku: YASAK + repo kuralları + kapılar + rapor biçimi aynen geçerli.
EK YASAK: `git add`, `git commit`, `git stash/checkout/reset/restore` — HİÇBİR git yazma komutu yok (geçmişte worker commit attı).

## Bağlam
- Hikvision PDKS'te her "attendance check point" bir tipe sahip: Check-In & Out / Check-In Only / Check-Out Only; kapı seçilince okuyucu
  bazında ayarlanır (dış okuyucu giriş, iç okuyucu çıkış). Kaynak: `docs/hikconnect-audit/PDKS_KIYAS.md` §2.1 + §3 P1-1.
- Bizde: `pdksRuleVersions.checkpointMode` ("all"|"selected") + `pdksCheckpointSelections` (targetType device|door, ioId) var,
  TİP YOK. Eşleşme `convex/lib/pdksRules.ts` `matchesPdksCheckpoint`. Yön bugün okuma anında `resolveDirection`
  (`convex/lib/cardReadingProcess.ts:64`) ile sıradan tahmin edilip `cardReadings.direction`'a yazılıyor; PDKS hesabı
  (`convex/lib/pdksDay.ts`, `convex/lib/pdksWorkDay.ts`, `convex/lib/pdksEvidence.ts` vb.) `reading.direction` okuyor.
- Hik olayı `cardReaderNo` taşıyor (canlı rawData'da `"cardReaderNo":1,"doorNo":1`), ama kayda yazılmıyor. `readers` tablosu
  `hikReaderNo` tutuyor (kapı N için giriş=2N-1, çıkış=2N; `convex/lib/hikReaderNumbers.ts`).
- UI: PDKS ayarları sayfası `/pdks-records/settings` → `PdksRulesSettings` → `src/components/settings/sections/components/pdksRulesCheckpointFields.tsx`.

## Hedef (test edilebilir)
"Seçilenler" modundaki her PDKS noktasına tip verilebilir; PDKS hesabı okumanın yönünü HESAP ANINDA noktanın tipinden alır
(Yalnız giriş → entry, Yalnız çıkış → exit, Giriş+Çıkış → bugünkü davranış = `reading.direction`), Hik okumaları okuyucu bazında
eşleşir; "Tüm" modu ve eski kural sürümleri birebir aynı sonucu verir.

## Yapılacaklar
1. Şema (yalnız opsiyonel alan ekle, mevcutları değiştirme):
   - `pdksCheckpointSelections`: `pointType: v.optional(v.union(v.literal("both"), v.literal("entry"), v.literal("exit")))` (yok = "both"),
     `targetType`'a `"reader"` ekle + `readerId: v.optional(v.id("readers"))`.
   - `cardReadings`: `hikCardReaderNo: v.optional(v.number())`.
2. Hik okuyucu no kaydı: canlı yol (`convex/http.ts` → `processCardReading` → `convex/lib/processCardReadingCore.ts`) ve günlük
   backfill (`convex/cardReadings.ts` `backfillHikEventRow` + çağıran `convex/lib/gateway/events.ts`) `cardReaderNo`'yu
   `hikCardReaderNo`'ya yazsın. Parse: `convex/lib/cardReaderParse.ts`.
3. Eşleşme + etkin yön (saf fonksiyon, `convex/lib/pdksRules.ts`): okuma için en özel hedef seçilir: reader (deviceId + hikCardReaderNo
   = readers.hikReaderNo, ya da IDE için mevcut io eşleşmesi) > door > device. `effectiveDirection(reading, policy)` döner:
   entry/exit/`reading.direction`. "all" modunda ve tipi "both" olanlarda `reading.direction` aynen kalır.
   Readers'ı hesapta okumak gerekiyorsa `loadPdksRulePolicy` hedefleri çözerken readerId→(deviceId, hikReaderNo) önceden yüklensin
   (okuma başına sorgu YOK).
4. PDKS hesabına bağla: `reading.direction` okunan HER PDKS yolunda (gün ataması, ilk giriş/son çıkış, esnek, gece, kanıt, rapor
   tabanları — `grep -rn "\.direction" convex/lib/pdks* convex/lib/report* convex/lib/legacyOvertime.ts convex/cardReadings.ts convex/mobileAttendance.ts`)
   politika uygulandıktan sonra etkin yön kullanılsın. En temiz yol: `filterPdksReadings` (`convex/lib/pdksSource.ts`) filtreledikten
   sonra okumaları etkin yönle kopyalayıp aşağıya o diziyi vermek — tek noktada uygula, yolları tek tek yamalama.
5. Backend: `convex/pdksRules.ts` yayınlama (publish) arg'ları + `listCheckpointTargets` okuyucuları da döndürsün (kapı altında,
   ad + yön + hikReaderNo). Doğrulama: aynı hedef iki kez yok; reader hedefi kendi kapısıyla birlikte seçilemez (en özel kazanır
   kuralı yeterliyse bunu açıkla). 500 hedef sınırı aynen.
6. UI (`pdksRulesCheckpointFields.tsx` + `pdksRulesModel.ts` + `PdksRulesSettings.tsx` + `pdksRulesConfirmation.tsx`):
   seçili her hedefin yanında tip seçimi (Giriş ve çıkış / Yalnız giriş / Yalnız çıkış, varsayılan Giriş ve çıkış); kapı altında
   okuyucular (varsa) seçilebilir; özet/onay metninde tipler görünsün. Türkçe metin. Mobil/QR notu korunur.

## Ownership (yalnız bunlara yaz)
`convex/schema.ts` (yalnız yukarıdaki alanlar) · `convex/pdksRules.ts` · `convex/lib/pdksRules.ts` · `convex/lib/pdksSource.ts` ·
PDKS hesabında `.direction` okuyan `convex/lib/pdks*.ts`, `convex/lib/report*.ts`, `convex/lib/legacyOvertime.ts` (gerekirse) ·
`convex/http.ts` · `convex/cardReadings.ts` (yalnız `backfillHikEventRow` + gerekirse çağrı yerleri) · `convex/lib/processCardReadingCore.ts` ·
`convex/lib/cardReaderParse.ts` · `convex/lib/gateway/events.ts` · `src/components/settings/sections/components/pdksRules*.ts(x)` +
`PdksRulesSettings.tsx` · bunların testleri + yeni test dosyaları.
DOKUNMA: `src/components/pdks/settings/**`, `src/pages/**`, `convex/settings.ts`, `generalSettings` (başka worker/koordinatör).

## Kapsam dışı
Kart Okumaları/Canlı İzleme'deki "Yön" kolonu (ekran `cardReadings.direction` göstermeye devam eder) · `resolveDirection` değişikliği ·
cihazın ekran durum modu (attendanceStatus) · "her giriş/çıkışı topla" hesap modu (ayrı iş 2d) · eski veriyi geri doldurma (backfill migration).

## Testler (zorunlu)
- Saf: en özel hedef seçimi (reader > door > device), tip → etkin yön, "all" ve tipsiz hedefte `reading.direction` aynen.
- Geriye uyum: mevcut PDKS golden/eşdeğerlik testleri (`convex/w5aLegacyEquivalence.test.ts`, `convex/lib/pdksFlexible.test.ts` vb.) DEĞİŞMEDEN yeşil.
- Entegrasyon: "Yalnız çıkış" noktasından gelen ve `direction:"entry"` yazılmış okuma o gün çıkış sayılır; gece vardiyasında
  önceki güne bağlanır.
- Hik: canlı + backfill `hikCardReaderNo` yazılır.
- UI: tip seçimi publish payload'ına gider; özet metni tipleri gösterir.

## Rapor
`/tmp/pdks-2c-rapor.md` (ortak rapor biçimi). Davranış değişikliği bölümünde: hangi projede ne değişir (yalnız "Seçilenler" + tip ≠ both).
Kademe: K3. Model `gpt-6-astra` effort `high`.

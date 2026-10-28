# Hik rapor Faz 1 (Mola) — denetim

**Sonuç: ENGEL 0.** 2 ÖNEMLİ, 3 DÜŞÜK. Süre hesabı regresyonu yok.

## Kapılar (kendi koşum)
- tsc app: 0 hata · tsc convex: 0 hata · find-node-leak: temiz
- vitest (pdksPunchPairs, pdksTable, src/lib/reports, src/components/reports): 13 dosya / 126 test yeşil
- vitest convex/lib: 1451 yeşil, 1 kırık = `visitorStatus.test.ts` "expiry cron…" (visitors.ts, başka oturumun işi; bu diff'le ilgisiz)

## 1. Süre hesabı: temiz
`pdksDay.ts`: `resolvedPairReadings` ifadesi eski `eachPunch` ifadesiyle birebir (flexibleConflict→[], aynı manual/minPunchInterval); `pairResult` yalnız `eachPunch` iken. `includePunchSegments` sadece ek `punchSegments` alanı döndürür; totalMinutes/rawTotalMinutes/mola kesintisi/OT/durum/breakViolation'a dokunmaz. `breakViolation` hesabı (pdksTable.ts:419) değişmedi.

## 2. Mola doğruluğu
- Çok vardiyalı gün: `dayKind`, `manualForSegment`, `manualExitNextDay` pdksMultiShift.ts:120-129 ile birebir tutarlı; parça arası boşluk mola sayılmıyor (kasıtlı, doğru).

**ÖNEMLİ-1** `convex/lib/pdksPunchPairs.ts:70-90` — Eksik uçlu ziyaret komşuluğu bozuyor. Girdi: 09:00 giriş, 12:00 çıkış, 12:30 tek başına çıkış (yönsüz okutma yanlış yöne düştü), 13:00 giriş, 17:00 çıkış → pairs: [09-12], [null-12:30], [13-17] → komşu tam ziyaret çifti yok → `breaks=[]`, 12:00-13:00 molası görünmez. Aynı gün rapor "mola yok" der ama `breakViolation` ayrı hesaplandığı için çelişebilir. Öneri: boşluk hesabını yalnız tam çiftler listesi üzerinde yap (eksik uçluları atla), ya da bu davranışı testle ve kolon metniyle belgele (kasıtlıysa).

**ÖNEMLİ-2** `convex/lib/pdksTable.ts:331-342` — `includePunches` açıkken çok vardiyalı günde hesap iki kez: `day` (merge içinde her parça `includePunchSegments` ile) + `punchDays` (her parça tekrar). Convex CPU maliyeti ~2x yalnız o günlerde (okutma-karti ve mola raporları). Kabul edilebilir ama gereksiz; öneri: `computePdksPlannedDay`'e `includePunchSegments` verme (`day` yalnız merged alanlar için), punchSegments'i sadece `punchDays`'ten al. Tek vardiyada `[day]` yeniden kullanımı ise ek maliyetsiz — oraya `includePunchSegments` yine gerekli, yani koşullu geçir: `includePunchSegments: params.includePunches && !(çok vardiya)`.

## 3. Convex
Yeni import döngüsü yok: pdksDay/pdksMultiShift/pdksPunchPairs pdksTable'ı import etmiyor. `"use node"` sızıntısı yok. `punchSegments` yalnız `detail.pairs/breaks/breakMinutes` olarak dışarı çıkıyor, ham alan sızmıyor.

## 4. Web
- Yönlendirme (Reports.tsx:34): döngü yok (hedef slug `mola`), arama parametreleri korunuyor, `ihlal=1` ekleniyor. **DÜŞÜK-1:** yol sabit `/reports/gunluk/mola` — `reportGroupPath` + `REPORTS_BASE_PATH` kullanılsa grup yolu değişirse kırılmaz. Ayrıca yönlendirme `reports.view` ve grup kontrolünden sonra olduğu için sorun yok.
- "Yalnız ihlaller" (rows.ts) eski predicate ile aynı (`breakViolation`). Temizle (`ihlal` silinir, hasFilters'a dahil) doğru. Excel `minutesValue` breakMinutes ile tutarlı.
- **DÜŞÜK-2:** localStorage'da eski `mola-ihlalleri` kolon seçimi yetim kalır, yeni slug varsayılanla açılır — kabul edilebilir (veri kaybı yok).
- **DÜŞÜK-3:** Varsayılan (ihlalsiz) görünüm predicate'i `breaks.length>0 || breakViolation`; molası olmayan ve ihlali olmayan gün listede yok, boş durum metni "mola kaydı yok" buna uyuyor. Sorun yok; yalnız "Tüm molalar" seçeneği adı "okutma arası molası olan günler" anlamına geliyor — etiket netleştirilebilir.
- `ihlal` URL değeri `'1'` dışındakiler `all`'a düşüyor; `violationsOnly` `breakViolation` filtresi olmayan raporlarda `false`.

## 5. Repo kuralları
`any`, `!`, `filter(Boolean)` yok; metinler Türkçe. `emptyTitle` içinde `as Record<string,string>` mevcut kalıp (any değil).

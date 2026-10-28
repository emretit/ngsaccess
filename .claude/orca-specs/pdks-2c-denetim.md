# PDKS 2c — DENETİM (SALT-OKUMA)

ÖNCE `.claude/orca-specs/akis-denetim-ortak.md` dosyasını oku: YASAK + kapılar + rapor biçimi aynen geçerli.
EK YASAK: `git add`, `git commit` ve HİÇBİR git yazma komutu yok. Rapor dosyası dışında dosya yazma yok.

## Ne denetleniyor
Codex worker'ın 2c işi: PDKS noktası tipi (Giriş+Çıkış / Yalnız giriş / Yalnız çıkış) + okuyucu hedefi + Hik `cardReaderNo` saklama +
hesap anında "etkin yön". Spec: `.claude/orca-specs/pdks-2c-nokta-tipi.md`. Yazar raporu: `/tmp/pdks-2c-rapor.md` (rapora değil DIFF'e güven).
Koordinatör ek kararı: legacy ilk/son da yön duyarlı → giriş = Yalnız giriş + G/Ç noktalarındaki İLK okuma, çıkış = Yalnız çıkış + G/Ç
noktalarındaki SON okuma; checkpointMode=all veya tüm noktalar G/Ç iken sonuç bugünküyle BİREBİR aynı.

## Dosyalar (yalnız bunların farkı)
convex/schema.ts · convex/pdksRules.ts · convex/lib/pdksRules.ts · convex/lib/pdksSource.ts · convex/lib/pdksWorkDay.ts · convex/lib/pdksDay.ts ·
convex/lib/pdksEvidence.ts · convex/lib/pdksTable.ts · convex/lib/pdksPayroll.ts · convex/lib/pdksTableQuery.ts · convex/lib/pdksPayrollQuery.ts ·
convex/lib/reportScope.ts · convex/lib/reportAttendance.ts · convex/http.ts · convex/cardReadings.ts · convex/mobileAttendance.ts ·
convex/lib/mobileAttendance.ts · convex/lib/processCardReadingCore.ts · convex/lib/cardReaderParse.ts · convex/lib/gateway/events.ts ·
src/components/settings/sections/components/{pdksRulesModel.ts,pdksRulesCheckpointFields.tsx,pdksRulesConfirmation.tsx,PdksRulesSettings.tsx}
Yeni testler: convex/pdksCheckpointTypes.test.ts · convex/lib/gateway/events.checkpoint.test.ts ·
src/components/settings/sections/components/pdksRulesCheckpointTypes.test.tsx
Not: aynı ağaçta başka işler de var (PDKS ayarları sayfa taşıması, `convex/settings.ts` çalışma günleri, audit etiketleri). Bu dosyalardaki
2c dışı farkları denetleme kapsamına alma; emin değilsen NOT olarak yaz.

## Özellikle bak (öncelik sırası)
1. Geriye uyum: checkpointMode=all, tipsiz eski hedefler ve tamamı G/Ç olan politikalarda tablo/detay/bordro/rapor/mobil sonucu bit bit aynı mı?
   Eski golden testler (`convex/w5aLegacyEquivalence.test.ts`, `convex/lib/pdksFlexible.test.ts`) gerçekten değişmemiş mi (`git diff` boş mu)?
2. Etkin yön tek kaynak mı: tüm hesap yolları (tablo, detay, bordro, rapor, SGK, mobil özet, gece/esnek gün ataması) aynı fonksiyonu mu
   kullanıyor; ham `reading.direction` okuyan ve atlanan hesap yolu kaldı mı? (`grep -rn "\.direction" convex/lib convex/*.ts`)
3. Gece vardiyası: gün ataması etkin yönle mi, sürüm sınırında (dün eski kural, bugün yeni kural) doğru sürüm mü?
4. Eşleşme önceliği reader > door > device; yabancı proje/cihaz/silinmiş reader yanlış eşleşmesi; okuma başına DB sorgusu (N+1) var mı?
5. Yetki/doğrulama: `convex/pdksRules.ts` publish'te hedef aidiyeti (proje/cihaz/kapı/reader) sunucuda doğrulanıyor mu; `any`/`as any`/`!` yok mu.
6. Hik taşıma: `cardReaderNo` canlı HTTP + backfill + XML/JSON parse; eksik/0/string değer davranışı; şema alanları opsiyonel mi
   (canlı veriyle şema doğrulaması kırılmamalı).
7. UI: varsayılan tip G/Ç, publish payload'ı, onay/özet metni Türkçe ve doğru.

## Kapılar (kendin koş)
tsc app + convex · `node_modules/.bin/eslint` yukarıdaki dosyalar · `node_modules/.bin/vitest run convex/pdksCheckpointTypes.test.ts
convex/lib/gateway/events.checkpoint.test.ts src/components/settings/sections/components/pdksRulesCheckpointTypes.test.tsx
convex/w5aLegacyEquivalence.test.ts convex/lib/pdksFlexible.test.ts`.

## Rapor
`/tmp/pdks-2c-denetim.md` — ortak biçim (ENGEL / DÜZELTİLMELİ / NOT, file:line + somut senaryo + öneri). `worker_done`'da ≤10 satır + rapor yolu.
Kademe: Claude sonnet medium.

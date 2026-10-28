# PDKS 2d — DENETİM (SALT-OKUMA)

ÖNCE `.claude/orca-specs/akis-denetim-ortak.md` dosyasını oku: YASAK + kapılar + rapor biçimi aynen geçerli.
EK YASAK: `git add`, `git commit` ve HİÇBİR git yazma komutu yok. Rapor dosyası dışında dosya yazma yok.

## Ne denetleniyor
Codex worker'ın 2d işi: kural sürümünde `calculationMode: "firstLast" | "eachPunch"` + `minPunchIntervalMinutes`; eachPunch'ta çalışma süresi =
giriş→çıkış çiftlerinin toplamı (ara çıkış düşülür). Spec: `.claude/orca-specs/pdks-2d-her-giris-cikis.md`. Yazar raporu: `/tmp/pdks-2d-rapor.md`
(rapora değil DIFF'e güven). 2c (nokta tipi / etkin yön) önceden denetlendi ve kabul edildi; 2c'yi yeniden denetleme, yalnız 2d'nin onu bozup
bozmadığına bak.

## Dosyalar
Yeni: convex/lib/pdksPunchPairs.ts (+test) · convex/pdksEachPunch.test.ts · src/components/settings/sections/components/pdksRulesPunchFields.tsx ·
src/components/settings/sections/components/pdksRulesEachPunch.test.tsx
Değişen (2c farkıyla iç içe; 2d kısmına odaklan — calculationMode/eachPunch/punchPairs/minPunchInterval geçen hunk'lar):
convex/schema.ts · convex/pdksRules.ts · convex/lib/pdksRules.ts · convex/lib/pdksDay.ts · convex/lib/pdksPayroll.ts · convex/lib/pdksEvidence.ts ·
convex/lib/pdksTable.ts · convex/lib/reportAttendance.ts · src/components/settings/sections/components/{pdksRulesModel.ts,pdksRulesConfirmation.tsx,PdksRulesSettings.tsx}

## Özellikle bak (öncelik sırası)
1. Geriye uyum: alan yok / firstLast iken süre, mola, fazla mesai, gece, devam kararı bit bit eskisi gibi mi? Golden testler
   (`convex/w5aLegacyEquivalence.test.ts`, `convex/lib/pdksFlexible.test.ts`, `convex/pdksCheckpointTypes.test.ts`) değişmemiş mi (`git diff` boş)?
   Eski payload'a (alanlar yokken) fazladan alan eklenmiyor mu?
2. Eşleştirme doğruluğu (`pdksPunchPairs.ts`): 08G 12Ç 13G 17Ç=480; tekrar okutma tekilleştirme sınırı; açık giriş/yetim çıkış; yönsüz dönüşüm;
   saniye yuvarlama; manuel giriş/çıkışın uç okumayı değiştirmesi; okumalar sırasız gelirse sıralanıyor mu? Kendi uç vakalarını üret (ör. G G Ç Ç,
   Ç G, tek okuma, aynı saniyede G+Ç, min aralık 0).
3. Mola: eachPunch'ta mola İKİ KEZ düşülmüyor mu; firstLast'ta mola davranışı değişmedi mi? Fazla mesai tabanı ve gece segmentleri çift
   toplamından mı geliyor, ara çıkış gece/fazla mesai dakikası üretiyor mu?
4. Devam kararı: legacy + eachPunch'ta "eksik çift → İnceleme, hiç okuma → Devamsız" — legacy firstLast'taki karardan sapma var mı ve yalnız
   eachPunch seçilince mi? Tek okuma (yalnız giriş) olan gün legacy firstLast'ta ne oluyordu, eachPunch'ta ne oluyor? Somut tablo yaz.
5. Sürüm sınırı + gece: eski gün firstLast / yeni gün eachPunch; gece vardiyasında çiftler doğru güne; tablo/detay/bordro/rapor/SGK aynı süre.
6. Sunucu doğrulaması: publish'te mod + 0–60 aralık (NaN/kesirli/negatif); `any`/`as any`/`!` yok.
7. UI: varsayılan "İlk giriş–son çıkış" / 1 dk, payload, özet/onay Türkçe, 0–60 doğrulama.

## Kapılar (kendin koş)
tsc app + convex · `node_modules/.bin/eslint` 2d dosyaları · `node_modules/.bin/vitest run convex/lib/pdksPunchPairs.test.ts convex/pdksEachPunch.test.ts
src/components/settings/sections/components/pdksRulesEachPunch.test.tsx convex/pdksCheckpointTypes.test.ts convex/w5aLegacyEquivalence.test.ts
convex/lib/pdksFlexible.test.ts`.

## Rapor
`/tmp/pdks-2d-denetim.md` — ortak biçim (ENGEL / DÜZELTİLMELİ / NOT, file:line + somut senaryo + öneri). `worker_done`'da ≤10 satır + rapor yolu.
Kademe: Claude sonnet medium.

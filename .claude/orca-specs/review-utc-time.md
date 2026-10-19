# Görev: SALT-OKUMA denetim — cihaz zamanı UTC normalizasyonu + yön toggle gün sınırı

Repo: /Users/emreaydin/ngsaccess (Convex backend). Önce `convex/_generated/ai/guidelines.md` oku.

## Bağlam
`cardReadings.accessTime` ve `deviceEvents.eventTime` string olarak index'te sıralanıyor ve `trDayRangeISO` (UTC `…Z`) sınırlarıyla string karşılaştırılıyor. Hikvision backfill yolu cihaz zamanını ham (`2026-10-16T22:30:00+03:00`) yazıyordu → TR 21:00–23:59 okumaları ertesi güne düşüyordu. `resolveDirection` de `…Z` accessTime ile `…+03:00` gün başını string kıyaslıyordu → TR 00:00–02:59 son okuma "önceki gün" sayılıp yön yanlış "entry" oluyordu. Canlı veride (278 okuma) ham offset'li accessTime YOK; `deviceEvents` 89 satır `+03:00` (yalnız `by_device_and_event_time` desc sıralamada kullanılıyor, aralık sorgusu yok) — backfill yapılmadı.

## İncelenecek değişiklik (`git diff -- convex`; `convex/lib/cardReadingAudit.ts` başka işe ait, kapsam dışı)
1. `convex/lib/trDate.ts#toUtcISO` + `trDate.test.ts`: offset'li → UTC Z; offset'siz → TR (+03:00) kabul; geçersiz → undefined.
2. `convex/cardReadings.ts#backfillHikEventRow`: `eventTime = toUtcISO(event.time)`, geçersizse `{ inserted: false, reason: "invalid-time" }`; accessTime/createdAt/updatedAt + deviceEvents eventTime normalize; `hikDateTime` ham kalır.
3. `convex/deviceEvents.ts#recordHikDeviceEvent`: `eventTime: toUtcISO(args.eventTime) ?? now`.
4. `convex/lib/cardReadingProcess.ts#startOfTurkeyDayISO` artık `trDayRangeISO(...).startISO` (UTC Z) döner; `resolveDirection` string kıyası buna dayanıyor; testler güncellendi.

## Kontrol et
- `toUtcISO` regex'i: `+0300`, `-05:00`, `z` küçük harf, milisaniye, tarih-only (`2026-10-16`), boşluklu biçim — yanlış offset veya yanlış gün üreten girdi var mı?
- `startOfTurkeyDayISO`'nun başka tüketicisi var mı (`grep -rn startOfTurkeyDayISO convex src mobile`)? `+03:00` biçimine bağımlı kod/test kalmış mı?
- Hikvision'dan zaman alan başka yazma yolu kaldı mı (`grep -rn 'insert("cardReadings"' convex`, `http.ts` `hikDateTime`, ISUP/gateway yolları)? Normalize edilmeyen accessTime/eventTime yazımı var mı?
- `backfillHikEventRow` çağıranları `reason: "invalid-time"` dönüşüyle bozuluyor mu (sayaç, cursor ilerletme, sonsuz retry)?
- Dedup (`by_device_hik_serial`, `by_device_and_hik_serial`) zaman biçiminden etkileniyor mu?

## Ownership
HİÇBİR dosyaya yazma. Salt okuma + komut koşma.

## YASAK
Dosya düzenleme / commit / push / deploy / migration / canlı DB erişimi (Convex/Supabase MCP, `npx convex run/data` dahil) YOK.

## Kapılar (kendin koş, sonucu raporla)
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint convex   (0 error)
npx vitest run

## Rapor
worker_done özetinde ≤10 satır: her bulgu için şiddet (kritik/yüksek/orta/düşük) + file:line + somut başarısızlık senaryosu (girdi → yanlış çıktı); yoksa "temiz" + kapı sonuçları. `--outcome succeeded` = denetim tamamlandı (bulgu olsa da).

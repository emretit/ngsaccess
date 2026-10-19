# FIX-C — Alarm: denetim bulguları D1 + D2 (kısmi) + D3 + D4 + N2-N6 + N8

Kaynak: `docs/hikconnect-audit/review-wave1.md` — D1, D2, D3, D4, N2, N3, N4, N5, N6, N8 bölümlerini OKU. Bu bulguları kapat; başka şeye dokunma.

## Hazır (Faz 0 eki): `deviceEvents.alarmNotifiedAt?: string` şemaya eklendi (schema'ya DOKUNMA).

## Ownership
`convex/alarms.ts` (+`convex/alarms.test.ts`), `convex/deviceEvents.ts`, `convex/actions/sendAlarmEmail.ts` (+ YENİ `convex/actions/sendAlarmEmail.test.ts`), `convex/lib/alarmNotify.ts` (+test), `src/pages/Alarms.tsx`, `src/components/alarms/**`. **`convex/cardReadings.ts` YAZMA** (UI audit PDKS worker'ı aynı dosyada çalışıyor — D2'nin o yoldaki kısmı sonraya bırakıldı).

## Yapılacaklar
1. **D1:** Debounce "gönderime" baksın: e-posta planlandığı an olaya `alarmNotifiedAt` damgası (mutasyon içinde, atomik) ve karar "son 10 dk'da aynı cihaz+label için `alarmNotifiedAt` dolu olay var mı". Zincirleme bastırma ve eşzamanlı iki olay → ikisi de bastırılma sorunları kapanmalı (aynı mutasyonda önce damga/karar, sonra `runAfter`). `alarmNotify.ts` saf karar fonksiyonunu buna göre güncelle. Testler: bastırma, 11. dakikada yeniden gönderim, eşzamanlı iki olay → tam 1 planlama, `sentRecently` yolu (gerçek `withIndex` koşulunu yok sayan mock'u düzelt).
2. **D2 (kısmi):** tetik mantığını `notifyAlarmIfNeeded(ctx, eventId, …)` yardımcısına al ve `deviceEvents.ts` içindeki TÜM insert yollarında kullan. `cardReadings.ts` insert'ine DOKUNMA; raporda "cardReadings.ts:~1743 çağrı eklenmeli (koordinatör sonra ekler)" diye bildir.
3. **D3:** `saveSettings` `writeAudit` (`targetTable: "alarmSettings"` — etiket gerekli, raporda belirt; değerler: `{ emailEnabled, minSeverity, recipientCount }`, adresleri YAZMA).
4. **D4:** `alarms.summary` `projectId` arg'ı alsın (yetki kontrolüyle), yalnız o projeyi okusun; `Alarms.tsx` aktif projeyi geçirsin. Test: başka proje sayılmaz.
5. **N2:** yerel `escape` yerine `convex/lib/escapers.ts` `escapeHtml`. **N3:** alıcı başına ayrı `try/catch`. **N4:** `runAfter` hatasında olay kaydı kaybolmasın (`try/catch` + `console.error` olaysız). **N5:** `from/to` → `new Date(x).toISOString()` normalizasyonu. **N6:** `acknowledge` sayacı yalnız gerçekten onaylananları saysın, `category` alarm/exception doğrulansın. **N8:** `sendAlarmEmail.send` testi (fetch mock: kaçışlama, alıcı döngüsü, Resend anahtarı yok/hata); UI'da `scanLimitReached` durumunda "Olay bulunamadı" yerine "Daha fazla yükle" ipucu.

## Kural
Test deseni: convex-test YOK; vitest + `vi.mock("./lib/customFunctions")` passThrough + sahte ctx. Doğrudan auditLog insert YASAK (`writeAudit`). `emailEnabled` varsayılanı `false` KALIR. Kapı: kendi dosyalarında tsc 0, eslint 0, `npx vitest run convex/alarms.test.ts convex/lib/alarmNotify.test.ts convex/actions src/components/alarms convex/lib/auditLogQuery.test.ts` yeşil. Testler yeşil olmadan worker_done gönderme.

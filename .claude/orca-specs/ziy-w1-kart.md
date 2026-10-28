# W1 — Ziyaretçi kart yakalama (Z-O1, Z-O2, Z-O3, Z-D3)

## Hedef
Ziyaretçi formunda "Kayıt okuyucusu" ile kart okutma; cihaz veya tarayıcı saati geride/ileride olsa da, kart iade edilmemiş pasif bir ziyaretçiye ait olsa da kartı forma düşürür. Okuyucu listesi kart okuyabilen tüm cihazları gösterir.

## Ownership (yalnız bunlar)
- `convex/cardReadings.ts` — YALNIZ `getLastUnknownByDevice` ve gerekirse yanına eklenecek yeni yakalama sorgusu/mutation'ı. Dosyanın geri kalanına dokunma.
- `convex/cardReadings.readingAccess.test.ts` + yeni test dosyası `convex/visitorCardCapture.test.ts`
- `src/components/visitors/VisitorCardCapture.tsx`, `src/components/visitors/cardCaptureSession.ts`, `src/components/visitors/cardCaptureSession.test.ts`
- `src/components/visitors/lib/readerCapability.ts` + yeni `src/components/visitors/lib/readerCapability.test.ts`
- `src/components/employees/import/BatchCardAssignDialog.tsx` (yalnız Z-O1 saat düzeltmesi)
- Salt okuma: `convex/lib/hikModels.ts`, `convex/lib/processCardReadingCore.ts`, `convex/schema.ts`, `src/hooks/useDevices.ts`

## Değişiklikler
1. **Z-O1 (saat):** Bugün `sinceTime` tarayıcı saatinden geliyor (`VisitorCardCapture.tsx:101`) ve cihazın olay zamanı `accessTime` ile karşılaştırılıyor (`cardReadings.ts:78-82`). Hik cihaz saati 7 güne kadar geride kabul ediliyor (`processCardReadingCore.ts:172-176`). Okumayı sunucunun kaydı aldığı zamana (`createdAt`) göre seç. Başlangıç anını sunucudan al: örneğin yazma yapmayan küçük bir mutation sunucu zamanını döner, ya da sorgu içinde güvenli bir pencere kullanılır. Index'i değiştirmeden sınırlı bir tarama yap (örnek: `accessTime > since − 15 dk`, `take(≤50)`, sonra `createdAt > since` süzgeci). Okuma sınırlı kalmalı. Aynı düzeltmeyi `BatchCardAssignDialog.tsx`'e de uygula, mevcut davranışını başka yönde değiştirme.
2. **Z-O2 (iade edilmemiş kart):** Ziyaretçi yakalamasında, okunan kart AYNI projedeki pasif ziyaretçiye (`isVisitor && isActive === false`, kartı `IADE:` değil) aitse okuma "bilinmeyen" sayılmadığı için bugün yakalanmıyor. Bu okumaları yalnız ZİYARETÇİ yakalamasında kabul et (yeni opsiyonel argüman ya da ayrı sorgu). `BatchCardAssignDialog` (kişi kartı atama) bu kartları kabul ETMEMELİ. Aktif ziyaretçi ya da personel kartı hiçbir zaman yakalanmaz. `convex/visitors.ts` `create` (W2'nin dosyası, dokunma) bu kartı zaten geri alıyor (`visitors.ts:345-360`).
3. **Z-O3 (okuyucu listesi):** `readerCapability.ts` serbest metin `deviceType`'a bakıyor. NGS0001 ve NGS0002 aynı model (DS-K1T807) olduğu halde yalnız NGS0002 listede. Hikvision cihazında modeli `convex/lib/hikModels.ts` model kataloğundan çöz; kart okuyucusu olan aileleri (terminal vb.) kabul et. Tip metni yalnız yedek olsun. QR okuyucu ve sanal okuyucu hariç kalsın. Cihaz alan adlarını `convex/schema.ts`'te doğrula. hikModels'i src'den içe aktarmak uygun değilse saf bir yardımcıyla çöz; Node modülü çekme.
4. **Z-D3:** Okuyucu değişince `timedOut` sıfırlansın (`VisitorCardCapture.tsx:85-95`).

## Kabul
- Testler: cihaz saati 2 dk geride iken yeni okuma yakalanır; `sinceTime` öncesi okuma yakalanmaz; pasif ziyaretçi kartı ziyaretçi yakalamasında döner, kişi toplu atamasında dönmez; aktif ziyaretçi/personel kartı dönmez; başka projenin okuması dönmez; yetki (`CARD_CAPTURE_PERMISSIONS`) korunur.
- `readerCapability` testi: deviceType "Yüz Tanıma" olan DS-K1T807 listelenir; QR ve sanal okuyucu listelenmez.
- Bileşen props'u (`onCapture`, `currentCard`) DEĞİŞMEZ; `VisitorFormFields.tsx` W3'ün dosyası.

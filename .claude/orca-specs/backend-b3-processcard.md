# Backend B3 — processCardReading (CANLI kart geçiş kararı)

Hedef: `convex/cardReadings.ts:443-854` `processCardReading` (internalMutation, 412 satır) ÖNCE karakterizasyon testleriyle dondurulur, SONRA fazlara bölünerek lib'e taşınır; registered internalMutation aynı ad/args/returns ile ince sarmalayıcı kalır; tüm yollar için çıktı (dönüş değeri + yazılan cardReadings/audit satırları + scheduler çağrıları) birebir.

Bu dosya kart okutulunca kapının açılıp açılmayacağına karar veren CANLI yoldur. Şüphe varsa taşıma yapma, rapora yaz.

Adım 1 — Karakterizasyon testi (taşımadan ÖNCE, HEAD koduna karşı yeşil olmalı):
- YENİ `convex/processCardReading.characterization.test.ts` (convex-test kalıbı: convex/akisFaz1.authz.test.ts ve convex/employeeCheckIn.test.ts processCardReading'i zaten çağırıyor — oradaki kurulum yardımcılarını örnek al).
- En az şu yolları kapsa (koddaki gerçek dallara göre genişlet): bilinmeyen cihaz · token ile sabitlenen cihaz vs serial/IP lookup (body serial'e güvenilmemesi) · bilinmeyen kart · pasif/işten çıkmış çalışan · başka projenin kartı (cross-tenant) · kurala göre izin · kural yok/plan dışı saat → ret · yön çözümü (in/out/both okuyucu) · varsa tekrar/debounce · scheduler çağrısı (alarm/sync vb.).
- Her testte: dönüş değeri, eklenen satır(lar)ın ilgili alanları, scheduler etkisi assert edilir.
- Adım 1 bitince `node_modules/.bin/vitest run convex/processCardReading.characterization.test.ts` yeşil olmalı (HEAD koduyla). Çıktıyı rapora yaz.

Adım 2 — Taşıma:
- YENİ `convex/lib/processCardReadingCore.ts` (ve gerekirse faz dosyaları): ör. resolveReadingDevice → resolveReadingEmployee → decideReadingAccess → persistReading. ctx.db okuma/yazma SIRASI ve SAYISI, index kullanımı, `ctx.scheduler` çağrıları, audit, dönüş şekli BİREBİR.
- Mevcut `convex/lib/cardReadingProcess.ts`, `accessDecision.ts`, `accessGraph*.ts`, `cardReaderAuth.ts`: DEĞİŞTİRME, yalnız import et.
- Adım 1 testleri + mevcut testler değişmeden yeşil.

Ownership:
- convex/cardReadings.ts (YALNIZ processCardReading gövdesi + import satırları; diğer handler'lar aynı)
- YENİ: convex/lib/processCardReadingCore.ts (+ gerekiyorsa convex/lib/processCardReading*.ts), convex/processCardReading.characterization.test.ts
- DOKUNMA: convex/http.ts, devices.ts, schema.ts, deviceCenter.ts, deviceEvents.ts, adminDevices.ts, lib/deviceConnection.ts, employeeBiometrics.ts, _generated (başka oturumun commit'siz işi), convex/accessRules.ts (B2b worker'ının)

Vitest (Adım 2 sonu): `node_modules/.bin/vitest run convex/processCardReading.characterization.test.ts convex/akisFaz1.authz.test.ts convex/employeeCheckIn.test.ts convex/lib/cardReading convex/lib/accessDecision.test.ts convex/lib/cardReaderAuth.test.ts convex/mobileAccess convex/w5 convex/w53Integration.test.ts`
Rapor yolu: /tmp/backend-b3-rapor.md (karakterizasyon test listesi + HEAD'e karşı yeşil kanıtı dahil)

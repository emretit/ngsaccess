# DENETİM — Faz 2A Hik'te erişimi geri alma (GÜVENLİK)
ÖNCE oku: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-denetim-ortak.md`. Spec: `.claude/orca-specs/akis-faz2a-geri-alma.md`. Yazar raporu: `/tmp/akis-faz2a-rapor.md`.
Rapor: `/tmp/akis-faz2a-denetim.md`.
Dosyalar: convex/lib/employeeCardChange.ts, convex/lib/peopleHikSnapshot.ts, convex/actions/hikvisionSync.ts, convex/hikvisionSync.ts, convex/actions/hikQueueWorker.ts, convex/deviceSyncRuns.ts, convex/accessRules.ts (yalnız silme/ilişki kaldırma hunk'ları; rol kontrolleri Faz 1'in — onlar ayrıca denetlendi), convex/hikRevocation.test.ts (yeni), convex/orphanGuards.test.ts.
## Odak
1. Her 4 olayda (kart değişimi, kural/ilişki kaldırma, kişi silme, silme tekrarı) eski `employeeNo` (= eski kart no) için silme işi, kişinin ÖNCEDEN yetkili olduğu TÜM Hik cihazlarına (gateway/ISAPI + localBridge) gidiyor mu; hedefler ilişki silinmeden ÖNCE aynı transaction'da sabitleniyor mu.
2. Yanlış silme riski: kişinin aynı cihazda başka geçerli kuralı varken silme gidiyor mu (erişim kaybı); kart değişiminde silme ile yeni kart ekleme arasında sıra/yarış (yeni kişi silinebilir mi — aynı employeeNo?); başka projenin cihazına iş gitmesi.
3. Silme tekrarı kişi silinmişken eski kart/hedefle çalışıyor mu; 5 deneme sonrası "başarısız silme" sessizce kapanmıyor, görünür mü; sonsuz retry/çoğalma yok mu.
4. Parmak izi akışıyla (1f213ede `scheduleFingerprintPurge`, deviceFingerprintEnrollments) çakışma/çift silme.
5. Maliyet: kural silmede etkilenen kişi×cihaz sayısı büyükse (ör. 500 kişi) tek mutation okuma/yazma sınırları; işler parçalı mı.
6. Testler gerçek davranışı mı doğruluyor (orphanGuards'ta kaldırılan beklentinin yerine yeni mekanizma assert'i var mı).

# DENETİM — Faz 5A alarm zinciri + Faz 5B kurulum listesi
ÖNCE oku: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-denetim-ortak.md`. Spec'ler: `.claude/orca-specs/akis-faz5a-alarm.md`, `akis-faz5b-kurulum.md`. Yazar raporları: `/tmp/akis-faz5a-rapor.md`, `/tmp/akis-faz5b-rapor.md`.
Rapor: `/tmp/akis-faz5-denetim.md`.
Dosyalar 5A: convex/alarms.ts, convex/lib/alarmNotify.ts, convex/actions/sendAlarmEmail.ts, convex/lib/deviceConnection.ts, convex/schema.ts (yalnız 5A hunk'ları), src/components/settings/sections/NotificationSettings.tsx, src/pages/Alarms.tsx, src/components/alarms/AlarmEmailStatus.tsx, src/components/audit/auditLabels.ts + testler (convex/deviceConnectivity.test.ts, convex/lib/alarmNotify.test.ts, convex/actions/sendAlarmEmail.test.ts, convex/alarmDelivery.test.ts, src/components/alarms/AlarmEmailStatus.test.tsx, src/components/audit/auditLabels.test.ts).
Dosyalar 5B: convex/projects.ts, convex/lib/hikModels.ts, convex/projectSetup.test.ts, src/pages/Index.tsx, src/pages/Index.test.tsx, src/components/dashboard/SetupChecklist.tsx (+test).
NOT: Aynı ağaçta Faz 2A ve 3A-fix worker'ları çalışıyor; onların dosyalarını denetleme.
## Odak 5A
1. Hik gateway (periyodik heartbeat'siz) cihazda yanlış "çevrimdışı" arızası üretilebilir mi; IDE/ESP32'de kesinti başına TEK arıza; yeniden bağlanma sırasında yarış (iki heartbeat aynı anda) çift kayıt üretir mi.
2. E-posta: tek retry gerçekten tek mi (sonsuz döngü/çoğalma yok); hata metninde alıcı adresi/kişi verisi saklanıyor mu; "Test e-postası" yetki (project_user ret) + oran sınırı; Resend anahtarı yokken davranış.
3. Şema eklemeleri yalnız opsiyonel/yeni (mevcut veriyi bozmaz, migration gerekmez); indeks gerekiyorsa var mı.
4. Kota: yeni reaktif sorgu/abonelik heartbeat başına yeniden koşuyor mu (Convex Free kota geçmişi: IDE poll, Hik köprü roster); AlarmEmailStatus ne okuyor.
5. Tek ayar kaynağı: eski ayarı kullanan proje bozulmadı mı (geri uyum).
## Odak 5B
6. `projects.getSetupStatus`: yetki (project_user / başka proje reddi), okuma maliyeti (eşleşme yoksa tüm proje aralığı), reaktif abonelik — cihaz `lastSeen` patch'i (heartbeat) her seferinde sorguyu yeniden koşturur mu; complete olduktan sonra da sorgu çalışmaya devam ediyor mu (öneri: tamamlanınca istemci sorguyu atlasın / tek seferlik sorgu).
7. UI: 360 px taşma, klavye, Türkçe metin, gizleme proje başına, project_user görmez.
8. DS-K1T804 katalog eklemesi cihaz formunda/kapı üretiminde doğru (tek kapı + tek okuyucu).

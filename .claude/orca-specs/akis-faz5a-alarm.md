# FAZ 5A — Alarm zinciri: cihaz çevrimdışı alarmı + e-posta gönderim durumu + tek bildirim ayarı

ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Kanıt: `docs/genel-akis-audit/C-kurulum-cihaz-yonetim.md` (bulgu 4, C3/C4 tabloları).
Rapor: `/tmp/akis-faz5a-rapor.md`.

## Hedef (test edilebilir)
(a) Periyodik heartbeat'i olan bir cihaz çevrimdışına düşünce alarm merkezinde "Arıza: cihaz çevrimdışı" kaydı oluşur, geri gelince kapanır/işaretlenir; Hik gateway cihazında (yalnız kart okutunca sinyal) yanlış alarm ÜRETİLMEZ (`hasPeriodicHeartbeat` + `hikOfflineHint` kuralı, `convex/lib/deviceConnection.ts`). (b) Alarm e-postası başarısız olursa yönetici alarm merkezinde/ayarda görür; tek seferlik gecikmeli yeniden deneme var. (c) Bildirim ayarlarında alarm e-postasının hangi ayardan yönetildiği tek ve açık.

## İşler
5.1 Çevrimdışı → alarm: bağlantı kesintisi şu an `deviceEvents` `status` kategorisi yazıyor, alarm sorguları yalnız alarm/exception okuyor (`convex/alarms.ts` ~:10). Yeni polling/cron EKLEME: kesinti tespitinin zaten olduğu yerde (deviceConnection akışı) alarm akışına da düşür (ör. exception kategorisinde ayrı etiket) — mevcut olay tablosu ve bildirim debounce'u (`convex/lib/alarmNotify.ts`) kullanılır. Kesinti tespiti şu an yalnız yeniden bağlanma anında yazılıyorsa (W6: "yeniden bağlanma anında tek status kaydı") bunu raporda net yaz; "düşme anında" tespit cron gerektiriyorsa YAPMA, sadece yeniden bağlanınca "X saat çevrimdışıydı" arızası üret ve raporda sınırı belirt.
5.2 E-posta durumu: `alarmNotify.ts` (~:45) bildirim zamanını gönderimden önce yazıyor, `convex/actions/sendAlarmEmail.ts` (~:16,:23) hatayı yalnız logluyor. Gönderim sonucunu (ok/hata kısa metni, zaman) kaydet; hata olursa `runAfter` ile TEK yeniden deneme (ör. 5 dk); alarm merkezinde/ayarda son gönderim durumu + "Test e-postası gönder" (yönetici, oran sınırlı). Alıcı adresleri loglanmaz.
5.3 Ayar tek kaynak: `src/components/settings/sections/NotificationSettings.tsx` (~:25) ile `convex/alarms.ts` (~:111) farklı ayar kaynakları. Alarm e-postası tek yerden (alarm ayarı) yönetilsin; diğer ekranda açıklama + bağlantı. Veri taşıma YOK.
5.4 Testler: periyodik cihaz offline→online alarm; Hik gateway'de alarm yok; e-posta hata → durum + tek retry (sonsuz değil); test e-postası yetki (project_user reddedilir).

## Ownership
`convex/alarms.ts`, `convex/lib/alarmNotify.ts`, `convex/actions/sendAlarmEmail.ts`, `convex/lib/deviceConnection.ts`, `convex/deviceEvents.ts` (yalnız alarm/kesinti hunk'ları), `convex/schema.ts` (YALNIZ bu faz: alarm/gönderim durumu için opsiyonel alan veya yeni tablo/indeks; mevcut alanları değiştirme), `src/components/settings/sections/NotificationSettings.tsx`, alarm merkezi sayfası/bileşenleri (`src/pages/Alarms*` / `src/components/alarms/**`) + testleri.
## Kapsam dışı
`convex/cardReadings.ts` (Faz 1 sahibi; oradaki alarm tetik çağrısı imzası değişmesin) · `convex/http.ts` IDE olay sınıflandırması (raporda öner, yapma) · Windows köprüsü · kurulum sihirbazı (Faz 5B) · SMS/push bildirimi.

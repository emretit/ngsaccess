# P1 — Alarm merkezi (v1)

## Hedef
Yönetici `/alarms` sayfasında kendi projesinin alarm/arıza olaylarını listeler, filtreler, onaylar (acknowledge); `minSeverity` üstündeki yeni olaylarda ayarlı alıcılara e-posta gider. (Hik-Connect: Alarm Center + Basic Alarm Settings'in v1 karşılığı.)

## Hazır olanlar (Faz 0, schema'ya DOKUNMA)
- `deviceEvents`: `category` (access|alarm|exception|operation|status|unknown), `severity` (info|warning|critical), `label`, `eventTime` (ISO), `deviceId`, + yeni `ackedAt/ackedBy/ackNote`; yeni index `by_project_category_event_time` [projectId, category, eventTime].
- `alarmSettings` tablosu: projectId, emailEnabled, recipients[], minSeverity (warning|critical), updatedBy, updatedAt; index `by_project`.
- Boş stub: `convex/alarms.ts`, `convex/actions/sendAlarmEmail.ts`; placeholder `src/pages/Alarms.tsx` (route + admin menü kaydı hazır).
- Olay yazanlar: `convex/deviceEvents.ts` (`recordHikDeviceEvent`, `recordSystemOperation`), `convex/http.ts:187` çağırır.

## Ownership (yalnız bunlara yaz)
`convex/alarms.ts`, `convex/actions/sendAlarmEmail.ts`, `convex/deviceEvents.ts` (yalnız bildirim tetiği için), `convex/lib/alarmNotify.ts` (yeni, saf mantık), `src/pages/Alarms.tsx`, `src/components/alarms/**` (yeni), testler: `convex/alarms.test.ts`, `convex/lib/alarmNotify.test.ts`, `src/components/alarms/*.test.tsx`.

## Backend
1. `alarms.list` — authedQuery, `paginationOpts` ile sayfalı. Arg: `category: "alarm" | "exception"`, `status: "open" | "acked" | "all"`, `severity?`, `deviceId?`, `from?/to?` (ISO). `by_project_category_event_time` index'iyle, en yeni önce. Proje kapsamı `getProjectIdsForUser` ile (başka projenin olayı asla dönmez). Cihaz adını döndür (`db.get` + null-daraltma; N+1'i cihaz id'lerini tekilleştirerek sınırla).
2. `alarms.summary` — son 7 günde onaysız `critical`/`warning` sayısı (üst sınır `take(200)`, "200+" göster). Sidebar rozeti için DEĞİL, sayfa üst özeti için.
3. `alarms.acknowledge` — adminMutation, `ids: v.array(v.id("deviceEvents"))` (en çok 50), `note?` (≤200). Yalnız erişilebilir proje olayları; zaten onaylıysa dokunma (idempotent). Mevcut `auditLog` yardımcısıyla (diğer admin mutation'lara bak) kayıt düş.
4. `alarms.getSettings` / `alarms.saveSettings` — adminMutation/Query. Alıcı: en çok 8, geçerli e-posta, tekilleştir; `minSeverity`. Proje başına tek satır (upsert).
5. E-posta tetiği: `recordHikDeviceEvent` (ve `recordSystemOperation` değil) event eklendikten sonra: `category` alarm|exception, severity ≥ settings.minSeverity, `emailEnabled` ise `ctx.scheduler.runAfter(0, internal.actions.sendAlarmEmail.send, { eventId })`. DEBOUNCE: aynı cihaz + aynı `label` için son 10 dk içinde bildirim gittiyse gönderme (kararı `convex/lib/alarmNotify.ts` içindeki SAF fonksiyonda ver; `by_device_and_event_time` ile son olaylara bak, `take` ile sınırlı).
6. `sendAlarmEmail.send` — internalAction. E-posta gönderimi için `convex/actions/sendEmail.ts` içindeki Resend desenini izle (aynı env anahtarı; anahtarı ASLA logla). Türkçe konu/gövde: cihaz adı, olay (`label`), önem, zaman (Europe/Istanbul), "Alarmlar sayfasına git" bağlantısı (mevcut uygulama URL'si nasıl üretiliyorsa o). Hata: yut + `console.error` (olay adı olmadan kişi verisi yok); retry yok.

## Frontend (`/alarms`)
- `PageHeader` "Alarmlar". Üstte özet (onaysız kritik/uyarı sayısı).
- Sekmeler: "Alarm" (category alarm) | "Arıza / İstisna" (exception). Her sekme kendi sayfalı sorgusu.
- Filtre çubuğu: Durum (Açık/Onaylı/Tümü; varsayılan Açık), Önem, Cihaz, Tarih aralığı.
- Tablo: zaman (TR), cihaz, olay, önem rozeti (critical=danger, warning=warning, info=muted — `src/lib/statusTone.ts` desenini izle), durum, "Onayla". Satır seçimi + toplu "Seçilenleri onayla" (not alanı opsiyonel diyalog). Onaylı satırda kim/ne zaman.
- "Bildirim ayarları" diyaloğu: e-posta aç/kapa, alıcı listesi (chip girişi), minimum önem. Kaydet → toast.
- Boş/yükleniyor/hata durumları mevcut kalıpla. Polling YOK (Convex reaktif sorgu yeterli). Sidebar rozeti kapsam dışı.

## Testler
- `alarms.list`: başka proje olayı görünmez; status/severity filtresi; sayfalama.
- `alarms.acknowledge`: project_user reddedilir; başka proje id'si reddedilir; çift onay idempotent; 50+ id reddedilir.
- `saveSettings`: alıcı doğrulama/tekilleştirme/limit.
- `alarmNotify` saf fonksiyonu: debounce penceresi, minSeverity eşiği, emailEnabled=false.
- Bileşen: onay akışı + filtre değişince sorgu argümanı.

## Kapsam dışı
Alarm kuralı oluşturma/ses/pop-up, alarm arama-arşiv, harita, push bildirim, çevrimdışı tespiti için yeni cron (kota!), sidebar rozeti, schema değişikliği.

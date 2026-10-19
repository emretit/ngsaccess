# P1b — Alarm merkezi: kalan iş (önceki worker kısmi bıraktı)

Mevcut durum: `convex/alarms.ts` (list, summary, acknowledge, getSettings, saveSettings, emailPayload), `convex/lib/alarmNotify.ts`, `convex/actions/sendAlarmEmail.ts`, `convex/deviceEvents.ts` tetiği, temel `src/pages/Alarms.tsx` (sekmeler, durum/önem filtresi, tablo, toplu onay) VAR; gates tsc/eslint temiz, `alarmNotify` testi geçiyor. İlk spec: `.claude/orca-specs/kiyas-p1-alarm.md` (gereksinim kaynağı).

## EKSİKLER (hepsini bitir)
1. **Durum filtresi sayfalama sorunu:** `status` ("open"/"acked") sayfalamadan SONRA filtreleniyorsa sayfalar seyrek/boş gelir. Repoda çözülmüş desene bak (`filterWith` + satır bütçesi: `convex/cardReadings.ts`, `convex/projects.ts`, `convex/adminDevices.ts`) ve aynısını uygula; "Daha fazla yükle" boş sayfada takılmamalı.
2. **Cihaz ve tarih aralığı filtresi** (arayüz + `alarms.list` argümanları `deviceId?`, `from?/to?` ISO).
3. **Bildirim ayarları diyaloğu** (e-posta aç/kapa, alıcı chip girişi ≤8, minimum önem) → `getSettings/saveSettings`; kaydedince toast; yalnız admin.
4. **Sayfa üst özeti** `summary` zaten var; "+" (capped) gösterimi doğru mu kontrol et.
5. **Testler (HİÇ YOK):** `convex/alarms.test.ts` — list proje izolasyonu (başka projenin olayı görünmez), status/severity filtresi + sayfalama, acknowledge (project_user reddedilir, başka proje id reddedilir, çift onay idempotent, 50+ id reddedilir), saveSettings (alıcı doğrulama/tekilleştirme/≤8), emailPayload; bileşen testi `src/components/alarms/*.test.tsx` (en az filtre değişince sorgu argümanı + onay akışı). Gerekirse `Alarms.tsx` içindeki mantığı `src/components/alarms/**` bileşenlerine ayır (tek dosyada 36 satırlık yoğun JSX okunmaz; okunur biçimde böl).
6. `acknowledge` zaten `writeAudit` kullanıyor — doğrudan `ctx.db.insert("auditLog")` YASAK, öyle kalsın. Yeni `targetTable` değeri yazarsan raporda belirt.

## Ownership
Önceki spec'teki aynı küme: `convex/alarms.ts`, `convex/actions/sendAlarmEmail.ts`, `convex/deviceEvents.ts`, `convex/lib/alarmNotify.ts`, `src/pages/Alarms.tsx`, `src/components/alarms/**`, ilgili testler. Diğer dosyalara YAZMA.

Testler yeşil olmadan `worker_done` GÖNDERME; kodu düzeltip tekrar koş. Kapı: kendi dosyalarında tsc 0, eslint 0, vitest yeşil.

# Session 2026-06-01 — Reader fix (WIEGAND) + live-monitoring kapı kolonu

Üç iş yapıldı: (1) QR okuyucu erişim düzeltmesi, (2) IDE Smart kart okuma tıkanması
teşhisi + fiziksel fix, (3) live-monitoring'e "Okuyucu / Kapı" kolonu.

---

## 1. QR okuyucu — Gökçe Şekem reddediliyordu → düzeltildi

**Belirti:** QR/mobil okutmalar (kart `0008219041`, Gökçe Şekem) sürekli `reddedildi`.

**Kök neden:** QR cihazı (`deviceSerial 3506556215854224`, deviceId `jn7cf91v330ckrbgkb6w4sp5ws85rr9t`)
**hiçbir erişim grubunda değildi** → `processCardReading` `deviceGroups.length === 0` dalında direkt
reddediyordu ([convex/cardReadings.ts](../../convex/cardReadings.ts) ~1812). Gökçe zaten "NGS"
accessRule'unun (`j57073hh66p7a3rr5zvf8zczzs821f93`, isActive, 7/24) üyesiydi; eksik olan tek halka
cihaz↔grup bağıydı.

**Fix:** `seedTestCardAccess:setupCardAndDevice` ile QR cihazı "NGS" grubuna eklendi (yeni kişi/kural
yaratılmadı, sadece `groupDevices` satırı):
```bash
npx convex run seedTestCardAccess:setupCardAndDevice \
  '{"cardNo":"0008219041","deviceSerial":"3506556215854224","ruleName":"NGS"}'
# groupDeviceCreated: true, diğer hepsi false (mevcutlar kullanıldı)
```

Not: QR okuyucu **broker'a değil** Hetzner nginx HTTP köprüsüne bağlı ([HETZNER_CARD_READER_BRIDGE.md](../HETZNER_CARD_READER_BRIDGE.md));
broker yalnızca IDE Smart paneli içindir. Köprü sağlıklıydı, sorun salt yetkiydi.

---

## 2. IDE Smart — kart okutma canlıya düşmüyordu → reader WIEGAND fix

**Belirti:** Panelden (`289833329732592`) kart okutuluyor, `cardReadings`/live-monitoring'e hiç düşmüyor.
Panel online (heartbeat akıyor).

**Teşhis (geriye doğru zincir):** Convex/bridge/broker hepsi sağlam çıktı; tıkanma en uçtaydı.
- Broker `event/#` 60–120s dinlendi (`mosquitto_sub`, `ngs-mqtt` container) → **sadece heartbeat,
  hiç `access_event`**. Panel kart olayını yayınlamıyor.
- Panel WIEGAND sayaçları LAN'dan okundu (`/tmp/ide-wiegand-probe.mjs`, login admin/admin →
  `parameter_read`): okutma öncesi/sonrası **bit bit aynı** (`STATS={}`, `SAMPLE_CARD_DATA` boş).
  Panel kartı **elektriksel olarak hiç algılamıyordu** = reader→panel WIEGAND sinyali yok
  (31 May'daki `irq_edges=0` kök nedeni tekrarı).
- `WIEGAND2.LEARN_STATE=1` (profil öğrenilmiş) → bağlantı geçmişte çalıştı, sonradan koptu = fiziksel.

**Fix (kullanıcı):** Reader **WIEGAND0** portuna takıldı. Sonra sayaç doldu:
`WIEGAND0.STATS.irq_edges=136`, `accept_ok=4`, `FORMAT_GUESS=W34-RAW`. Tüm zincir çalıştı —
okumalar `cardReadings`'e düştü (Emre Aydın/Talip Elaman `izin_verildi`, yetkisiz kart `reddedildi`).

**Teşhis yöntemi runbook'u memory'de:** `ide_smart_reader_wiegand_diagnosis`. WIEGAND port ↔
panel `actuator`/io_id eşleşiyor (W0 → actuator 0). 34-bit kart WIEGAND2'ye, 26-bit WIEGAND0'a düşer.

---

## 3. Live-monitoring — "Okuyucu / Kapı" kolonu eklendi

**İhtiyaç:** Kullanıcı her okumanın hangi okuyucu/kapıdan (WIEGAND/io) geldiğini live-monitoring'de
görmek istiyor ("kapıları buradan görüyoruz").

**Veri:** Panel `access_event` payload'ı WIEGAND port adını değil `actuator` (=io_id) gönderiyor →
`cardReadings.ideIoId`. `doors` tablosu `ioId` (0–3) ile her kapıyı tutuyor (bu panelde io 0–3 =
"Kapı 1–4").

**Değişiklikler:**
- [convex/cardReadings.ts](../../convex/cardReadings.ts) `list` query: sayfadaki IDE panelleri için
  `doors` bir kez toplanıp (`by_device` index, N+1 yok) her okumaya `ideIoId → doors.ioId` ile `door`
  `{name, readerName, readerDirection}` eklendi.
- [src/types/access-control.ts](../../src/types/access-control.ts): `CardReading`'e `ideIoId?` + `door?`.
- [src/components/access-control/CardReadingsTable.tsx](../../src/components/access-control/CardReadingsTable.tsx):
  "Okuyucu / Kapı" kolonu (`readerName` → kapı `name` → `IO {ideIoId}` → `-`).
- [src/pages/AccessControl.tsx](../../src/pages/AccessControl.tsx): sidebar/tab kaldırıldı; CardReadings
  artık ayrı live-monitoring sayfasında.

Deploy: `npx convex dev --once` (notable-tern-4). tsc 0, eslint 0. Code-review + security-review temiz.

---

## Açık / sonraki

- **WIEGAND→actuator eşlemesi doğrulaması:** W0→Kapı 1 canlı doğrulandı. Diğer portları (W2 vb.)
  takıp okutunca actuator'ın beklenen kapıya denk geldiğini teyit et; denk gelmezse panelin
  WIEGAND→actuator ayarına bak.
- **Reader bağlantısı dalgalı:** D0/D1 terminali sağlam oturduğundan emin ol (söküp takıldıkça kopuyor).
- **Dashboard parity (opsiyonel):** "Son Kart Okutmaları" özet tablosu (`RecentReadingsTable` /
  `dashboard.getRecentReadings`) kapı kolonunu içermiyor; istenirse aynı enrichment oraya da eklenir.

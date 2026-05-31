# IDE Smart Panel — Event Entegrasyonu Oturum Özeti

> **Tarih:** 2026-05-29 · Tüm timestamp'ler UTC+3 (Türkiye).
> **Hedef:** IDE Smart okuyucudan okutulan kart bilgisini sisteme/ekrana düşürmek — QR/Hikvision nasıl yapıyorsa öyle.
> **Sonuç:** ✅ Uçtan uca çalışıyor. Panel → relay → Convex → `cardReadings` → ekran.

---

## 1. Asıl Hedef ve Neden Önemli

Kullanıcının net isteği: **"okutulan kart bilgisini önümüze düşürmek"** — access/permission kararı veya panel↔Convex kullanıcı senkronu DEĞİL. Tıpkı mevcut QR reader / Hikvision okuyucusunun yaptığı gibi.

**İyi haber (keşifle doğrulandı):** Hikvision, QR ve IDE Smart üçü de aynı zinciri kullanıyor:
```
POST /card-reader → processCardReading → cardReadings tablosu → aynı ekranlar
  (Dashboard "son okutmalar" + AccessControl "PDKS Kayıtları")
```
Tanınmayan kart bile `cardReadings`'e yazılıyor (employee yoksa isim boş, ama cardNo+zaman+cihaz dolu). Yani "kartı ekrana düşürme" için permission/grup kurulumu **gerekmez.**

**Tek gerçek darboğaz:** Panelin kart event'ini `/card-reader`'a ulaştırması + parse dalının gerçek event şekline kalibresi.

---

## 2. Doğrulanmış Panel Bilgileri (canlı test)

| Bilgi | Değer |
| :-- | :-- |
| Panel IP | `192.168.1.4` (Ethernet — WiFi modülü yok) |
| HTTP port | `80` |
| UUID (`SYSTEM.UUID`) | `289833329732592` (15 hane, numeric) |
| Cihaz adı | "4 Output DC" → 4 aktüatör/kapı |
| Login | `admin` / `admin` (Level 1) ✓ + **L3** kullanıcı `3` (IDE Smart verdi) |
| Okuyucu kanalı | **WIEGAND2** (W34-RAW, 34-bit) — her iki fiziksel okuyucu da bu kanalda |
| Test makinesi | `192.168.1.245` (relay burada) |
| Convex deployment | `dev:notable-tern-4` → `notable-tern-4.convex.site` |

---

## 3. 🔴 KRİTİK: Doküman ↔ Firmware Çelişkileri (canlı test edildi)

Resmi doküman (`docs/ide-smart/03`, `10`) ile gerçek firmware **uyuşmuyor.** Bunlar bu oturumda panele canlı `parameter_write` atılarak keşfedildi:

### 3.1 Yazma yetki seviyeleri
| Parametre | Doküman | GERÇEK firmware cevabı |
| :-- | :-- | :-- |
| `HTTPCLIENT.HOST` | L1 | **"requires level 99"** (reddedilir) |
| `HTTPC.HOST` (gerçek modül adı!) | — (yok) | **L1 ile `success`** ✅ |
| `MQTT.BROKER/PORT/USERNAME` | L3 read | **L3 write** |
| `LOGGER.PROTOCOL/AC_LOG_PATH/HB_*` | L3 | **L2 write** |
| `REPO.*` | L1 | L1 ✓ |
| `get_data {data_type:"log"}` | L1 | L1 ✓ (ama liste boş — aşağıya bak) |

### 3.2 En kritik keşif: `HTTPC` vs `HTTPCLIENT`
Dokümanda parametre adı `HTTPCLIENT.HOST` yazıyor ama **gerçek yazılabilir modül `HTTPC.*`.** `HTTPCLIENT.*` bir alias ve L99 ile kilitli. **Bu ipucu IDE Smart'tan geldi** ("HTTPCLIENT yerine HTTPC dener misin?") ve çözümün anahtarı oldu.

### 3.3 Bu donanımda OLMAYAN doküman parametreleri
- `SYSTEM.PID` → "Unknown parameter on module"
- `AUTH.TOKEN_TTL` → "unknown parameter"
- Tüm `WIFI.*` → "no Params class" / "getter failed" (panel Ethernet, WiFi yok)

### 3.4 Loglama davranışı
- `LOG.PROTOCOL` default **MQTT** (panel bir broker'a bağlı: `MQTT.STATUS=Connected`).
- `LOG.SAVE_AFTER_LIVE_SEND=0`, `KEEP_SENT_RECORDS_N=0` → event gönderilince **cihazda saklanmıyor**. Bu yüzden `get_data log` boş döner (`access_logs_unsent.bin = 0 byte`).
- Mevcut HTTP hedefi `HTTPC.HOST=192.168.1.147:8080` → **ölü adres** (ağda yok).

---

## 4. Çözüm Yolu (adım adım, nasıl çalıştırıldı)

Engeller ve nasıl aşıldı:

1. **HTTP event hedefini değiştirme** → `HTTPC.HOST/PORT` admin (L1) ile yazıldı (`HTTPCLIENT` değil).
2. **Transport MQTT→HTTP** → `LOGGER.PROTOCOL=HTTP` + `AC_LOG_PATH=/card-reader` (L2 gerektirir) → **L3 şifresiyle** yazıldı.
3. **Değişiklik aktifleşmiyordu** → `LOG.PROTOCOL` değişikliği boot'ta okunuyor → **panel reboot** (graceful, L1) → HTTP modu aktifleşti, heartbeat gelmeye başladı.
4. **Okuyucu "çalışmıyor" sanıldı** → ilk testlerde `WIEGAND0`'a bakıldı; meğer okuyucu **WIEGAND2** kanalındaymış. `STATS.accept_ok` ve `last_card_id` kart okutunca arttı → okuyucu sorunsuz.
5. **Convex cloud LAN'a giremez** → test makinesinde (`192.168.1.245`) **relay** çalıştırıldı: panel → relay (8090) → Convex `/card-reader` (apiToken header enjekte).
6. **Panel `ideUuid`'i Convex'te boştu** → `setIdeUuid` ile `289833329732592` set edildi → `processCardReading` paneli `by_ide_uuid` ile buluyor.

---

## 5. GERÇEK Event Şekli (canlı yakalandı)

Dokümanda access event'in JSON şekli **yoktu** — capture ile çıkarıldı:

```json
// Heartbeat (15sn'de bir, HB_ENABLED=1)
{ "payload": { "TIME": "2026-05-29 15:08:14", "IP": "192.168.1.4", "WIFI_RSSI": null },
  "transaction": { "type": "heartbeat", "src-id": 289833329732592, "dst-id": 0 } }

// Access event (kart okutunca)
{ "payload": { "result": 0, "time": "2026-05-29 15:18:19", "user_id": 4240722371, "actuator": 2 },
  "transaction": { "type": "access_event", "src-id": 289833329732592, "dst-id": 0 } }
```

**Alan eşlemeleri (parse):**
| Event alanı | Tip | → parse çıktısı | Not |
| :-- | :-- | :-- | :-- |
| `payload.user_id` | number | `user_id` (string'e) | Kart no. W34 max ~17 milyar < 2^53, precision güvenli |
| `payload.actuator` | number | `ideIoId` | Kapı/aktüatör (doküman "io_id" diyordu — gerçek `actuator`) |
| `payload.result` | number | `ideResult` | **0=reddedildi, 1=izin_verildi** (number, string değil) |
| `payload.time` | string | `ideTime` | "YYYY-MM-DD HH:MM:SS", panel TZ UTC+3 |
| `transaction.src-id` | number | `ideUuid` | Panel UUID (doküman "uuid/dst-id" diyordu) |
| `transaction.type` | string | dal seçimi | "access_event" / "heartbeat" |

Heartbeat'te `user_id` yok → IDE dalına girmez → `http.ts` heartbeat olarak sessizce atlar (sadece lastSeen güncellenir). ✓

---

## 6. Yapılan Kod Değişiklikleri

### Backend (Convex)
- **`convex/lib/cardReaderParse.ts`** — IDE dalı gerçek şekle kalibre edildi: `actuator`→`ideIoId`, `src-id`→`ideUuid`, yeni `ideResult`/`ideTime` alanları. Hikvision dallarından önce, `user_id && (type===access_event || actuator var)` koşuluyla.
- **`convex/cardReadings.ts`**:
  - IDE brand-dispatch bloğu eklendi (Hikvision deseninin eşi): erişim kararını **panel verir** (`ideResult`), employee `by_card` ile bulunur (sadece isim/ilişki), `resolveDirection` io_id ile çözer. Kayıtsız kart da yazılır.
  - `ideTimeToISO()` helper: panel zamanını (UTC+3) UTC ISO'ya çevirir → offline-flush event'leri **gerçek okutma anını** korur (sunucu alış anı değil).
  - `resolveDirection`'a IDE io_id dalı (io 0→entry, 1→exit, sonrası toggle).
- **`convex/http.ts`** — `ideResult`/`ideTime` parse→processCardReading geçişi; cross-tenant guard'a `ideUuid`; lastSeen'e `ideUuid`.
- **`convex/devices.ts`** — `createIdePanel` (bölge+cihaz+N kapı atomik), `getByIdeUuid`, `setIdeUuid`, `markIdeOnline`, `getPanelZoneIds`, `getPanelDoorByIo`; `remove`'da IDE cascade; `updateLastSeen`'e ideUuid.
- **`convex/actions/ideGatewayDevice.ts`** — `registerIdePanel` (login + UUID oku + forwarding), `openIdeDoor` (door→ioId, panel-zone yetki kontrolü), `loadIdePanel`. **Düzeltildi:** `HTTPCLIENT`→`HTTPC`, LOGGER ayrı best-effort write.
- **`convex/schema.ts`** — `devices.brand` union'a `ide_smart`; IDE alanları (`ideUuid/ideUser/idePassword/ideHttpPort/ideDoorCount`) + `by_ide_uuid` index; `zones.ideDeviceId` + `by_ide_device`; `doors.ioId`.

### Frontend (src/)
- **`DeviceTableRow.tsx` + `DeviceList.tsx`** — IDE cihazlarda "Seri No" yerine **UUID** gösteriliyor; başlık "Seri No / UUID".
- IDE form: `DeviceIdeSmartSection.tsx`, `DeviceNameSection.tsx`, `DeviceForm.tsx` IDE dalı, `useDeviceFormSchema.ts`, `useDeviceFormSubmission.ts` (createIdePanel + registerIdePanel), `BrandPickerStep.tsx`, `ZoneDoorTree.tsx` (panel zone + "Kapıyı Aç").

### Scriptler (scripts/)
- **`ide-smart-probe.mjs`** — login + parameter_read + opsiyonel kapı aç (teşhis).
- **`ide-smart-capture.mjs`** — 8090'da ham event yakalayıcı (sadece logla).
- **`ide-smart-set-http-target.mjs`** *(YENİ, doğru)* — L3 ile HTTPC.HOST + LOGGER ayarla; `REVERT=1` ile fabrika MQTT'ye dön; read-back doğrulama.
- **`ide-smart-relay.mjs`** *(YENİ)* — panel → Convex köprüsü: event'i loglar, `/card-reader`'a forward eder (apiToken enjekte), panele zarf döner. **Düzeltildi:** sadece Convex 2xx'te "success" döner (aksi halde "fail" → panel retry).
- **`ide-smart-point-here.mjs`** — ⚠️ **DEPRECATED** (HTTPCLIENT yazıyor, L99 reddediyor). Yerine `set-http-target.mjs`.

---

## 7. Çalışan Uçtan Uca Akış (mevcut durum)

```
Kart → Okuyucu (WIEGAND2, W34)
  → Panel (192.168.1.4) HTTP POST
  → Relay (192.168.1.245:8090, ide-smart-relay.mjs)  [apiToken header ekler]
  → Convex /card-reader (notable-tern-4.convex.site)
  → parseCardReaderBody (IDE dalı)
  → processCardReading (ide_smart dispatch, by_ide_uuid lookup)
  → cardReadings insert (accessTime = panel zamanı, accessStatus = panel result)
  → Dashboard / PDKS Kayıtları ekranı
```

**Kanıt (canlı):** Kart `4240722371` okutuldu → `cardReadings`'e düştü, `accessTime: 2026-05-29T12:34:35.000Z` (panel 15:34:35 UTC+3), `employeeName: "İrem Peker"`, `accessStatus: "reddedildi"` (panel `result:0` — panelde kullanıcı kayıtlı değil).

---

## 8. Güvenlik & Kod Review Sonuçları

- **security-review:** Yeni güvenlik açığı yok. 3 potansiyel bulgu elendi (cross-tenant: pre-existing webhook deseni; SSRF: admin-trusted config; plaintext şifre: exclusion).
- **code-review (9 angle + verify):** 5 gerçek bug düzeltildi — `ideTime` kullanımı, `registerIdePanel` HTTPC, relay ACK, dead code temizliği, point-here deprecated. Detay yukarıda §6.
- **Doğrulama:** `tsc` 0 hata (supabase pre-existing hariç), `eslint` 0, `vitest` 28/28.

---

## 9. Açık İşler / Sonraki Adımlar

1. **(Kalıcılık) Relay'i Hetzner köprüsüne taşı** — şu an event akışı test makinesindeki relay üzerinden gidiyor (bilgisayar kapanırsa durur). Production için `docs/HETZNER_CARD_READER_BRIDGE.md` deseniyle nginx'e taşınmalı. Not: panel `AC_LOG_PATH` L2 olduğu için path'i `/card-reader`'a çevirebildik (L3 ile); aksi halde nginx rewrite gerekirdi.
2. **"İzin verildi" akışı** — şu an panel `result:0` (deny) gönderiyor çünkü panelde kayıtlı kullanıcı yok. Kartı panele `create_data` ile kaydedersek panel `result:1` döner ve `izin_verildi` düşer. (Convex tarafı zaten panel kararını aynalıyor.)
3. **(Faz 2) Çok kapılı yön tutarlılığı** — 4 kapılı panelde actuator 2/3 toggle history'si actuator 0/1 ile karışabilir. Şu an her iki okuyucu da WIEGAND2 (actuator 2), tek kanal → sorun değil. Gerçek çok-aktüatörlü kurulumda door bazlı toggle gerekir.
4. **(Faz 2) Kullanıcı/permission senkronu** — Convex çalışanlarını panele `create_data user` ile yazma (panel kendi kararını verebilsin).
5. **Panel ayarlarını fabrikaya döndürme** — test bitince: `REVERT=1 node scripts/ide-smart-set-http-target.mjs` (LOGGER.PROTOCOL=MQTT, HTTPC=147:8080).

---

## 10. Kimlik Bilgileri & Referanslar

- **Secret'ler `.env.local`'da** (gitignore'da, koda yazılmaz): `IDE_IP`, `IDE_USER`, `IDE_PASS`, `IDE_L3_USER`, `IDE_L3_PASS`.
- IDE Smart destek: ismail.tural@idesmart.com (L3 şifresini ve HTTPC ipucunu verdi).
- Doküman-firmware uyumsuzlukları + sorular: `docs/ide-smart/IDESMART_SORULAR_VE_UYUMSUZLUKLAR.md`.
- IoT reference (15 bölüm): `docs/ide-smart/01..15-*.md`.
- Hetzner card-reader bridge runbook: `docs/HETZNER_CARD_READER_BRIDGE.md`.
- Önceki devir notu: `docs/ide-smart/SESSION_HANDOFF.md` (DİKKAT: o notta "HTTPCLIENT L99, çözülemez" yazıyor — bu oturumda `HTTPC` ile çözüldü).

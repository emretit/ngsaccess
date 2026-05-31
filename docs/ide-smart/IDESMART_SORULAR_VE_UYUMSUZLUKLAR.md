# IDE Smart'a İletilecek: Doküman ↔ Cihaz Uyumsuzlukları + Sorular

> **Cihaz:** UUID `289833329732592`, DEVICE_NAME "4 Output DC", bağlantı **Ethernet** (192.168.1.4).
> Tüm aşağıdaki gözlemler bu panele **canlı `parameter_read`/`parameter_write`/`get_data`** çağrılarıyla,
> `admin` (Level 1) token'ı ile doğrulandı. Token formatı: `1.<iat>.<exp>.289833329732592.<sig>`.
> Tarih: 2026-05-29.

Bizim hedefimiz: kart okutma (access) event'lerini kendi sistemimize almak. Aşağıda hem
**dokümanla çelişen davranışlar** hem de bunları aşmak için **sizden ihtiyacımız olanlar** var.

---

## 🔑 Kimlik bilgileri (secret — kodda/git'te DEĞİL)

IDE Smart panel login bilgileri ve **Level 3 şifresi** (IDE Smart tarafından 2026-05-29'da verildi)
`.env.local` dosyasında saklanıyor (gitignore'da): `IDE_IP`, `IDE_USER`, `IDE_PASS`,
`IDE_L3_USER`, `IDE_L3_PASS`. Scriptler bu env değişkenlerini okur. Gerçek şifre değeri buraya yazılmaz.
L3 ile `MQTT.*` (write L3) ve `LOGGER.*` (write L2) parametreleri yazılabilir → event transport'unu
HTTP'ye çevirme engeli kalktı.

## 🔴 GÜNCELLEME (2026-05-29, sizin `HTTPC.HOST` öneriniz sonrası)

**1) `HTTPC.HOST` öneriniz ÇALIŞTI — teşekkürler.** `HTTPCLIENT.HOST` yazma "level 99"
reddediyordu; ama gerçek modül adı **`HTTPC`** imiş. `parameter_write {"HTTPC.HOST":..., "HTTPC.PORT":...}`
**admin (L1) ile `success` döndü** ve `HTTPCLIENT.HOST` okuması da yeni değeri gösterdi (ikisi aynı
parametre, sadece yazma yolu `HTTPC.` üzerinden açık). → **Dokümanda parametre adı `HTTPCLIENT.*`
olarak yazılmış ama yazılabilir gerçek ad `HTTPC.*`.** Lütfen dokümanı düzeltin.

**2) Ama tek başına yetmiyor:** `parameter_read {module:"LOG"}` (L1 ile okunabildi) gösterdi ki
**`LOG.PROTOCOL = "MQTT"`** — yani panel access event'leri **MQTT broker'a** gönderiyor, HTTP'ye değil.
`HTTPC.HOST` (HTTP hedefi) sadece `LOG.PROTOCOL=HTTP` iken kullanılır. Bu yüzden HTTPC hedefini
değiştirsek bile, panel MQTT modunda olduğu sürece bize HTTP POST atmıyor.
- `LOG.PROTOCOL` yazma (`LOGGER.PROTOCOL` alias) → **"requires level 2"**.
- `LOG.PROTOCOL` (kısa ad) yazma → **"requires level 99"** (bu alias da kilitli).

**→ Soru (en kritik, çözümün önündeki TEK engel): `LOG.PROTOCOL`'ü `HTTP` yapmak için bize
`USER2` (Level 2) şifresi verir misiniz?** Onunla:
`LOGGER.PROTOCOL=HTTP` + `LOGGER.AC_LOG_PATH=/card-reader` (L2) **+** `HTTPC.HOST/PORT` (L1, zaten
yapabiliyoruz) → panel event'i doğrudan bizim sunucuya HTTP POST'lar. MQTT broker'a hiç ihtiyaç kalmaz.

**3) DAHA ÖNEMLİ — okuyucu hiç kart okumuyor olabilir (donanım):** `WIEGAND0.ENABLED=1` ama:
- `WIEGAND0.STATS = {}` (boş — hiç frame istatistiği yok)
- `WIEGAND0.LEARN_STATE = 0` ve `FORMAT_GUESS = ""` (öğrenilmiş kart profili yok)
- `WIEGAND0.AUTO_DETECT = "ONCE"` (ilk kart okutulunca öğrenmeli)

Karta okuyucuya **defalarca okuttuk**, 30+ saniye `STATS`/`LEARN_STATE`/`FORMAT_GUESS`/`app_log`
hiç değişmedi. `WIEGAND0.LAST_CARD`, `reject_parity`, `reject_bits_too_*`, `debounce_drops` gibi
diagnostik sayaçları cihaz **"Unknown parameter on module"** diyor (dokümanda §10.17 troubleshooting'de
geçiyor ama panelde okunamıyor).

**→ Soru (donanım): Okuyucu kart okuduğunda `WIEGAND0.STATS`/`LEARN_STATE` değişmeli mi?
Wiegand okuyucunun fiziksel olarak kart frame'i ürettiğini panel üstünden nasıl doğrularız?
`reject_*` / `LAST_CARD` gibi diagnostik sayaçları bu firmware'de hangi parametre adıyla okunur?
Okuyucu kablosu (D0/D1/GND/12V) doğru bağlı mı diye panel tarafında bakabileceğimiz bir gösterge var mı?**

---

## A. KRİTİK: Yetki seviyeleri doküman ile uyuşmuyor (parameter_write)

`docs §3.3 Authorization Matrix` "Min Write Level" tablosu ile cihazın gerçek reddetme mesajları çelişiyor.
Aşağıdakiler hepsi `admin`/Level 1 token ile denendi; cihazın döndürdüğü ham mesaj sağ sütunda.

| Parametre | Doküman (§3.3 / §10) | Cihazın GERÇEK cevabı |
| :-- | :-- | :-- |
| `HTTPCLIENT.HOST` / `HTTPCLIENT.PORT` | **HTTPCLIENT → Min Write Level 1** | `forbidden: HTTPCLIENT.HOST write requires level **99**, you are 1` |
| `MQTT.BROKER` / `PORT` / `USERNAME` / `SSL_ENABLED` | MQTT → Level 3 (read), write belirsiz | `forbidden: MQTT.BROKER write requires level **3**` (tutarlı) |
| `LOGGER.PROTOCOL` / `AC_LOG_TOPIC` / `AC_LOG_PATH` | LOGGER → Level 3 | `requires level **2**` (doküman 3 diyor, cihaz 2) |
| `LOGGER.HB_ENABLED` / `SAVE_AFTER_LIVE_SEND` | §6 tablo, write belirsiz | `requires level **2**` |
| `REPO.HOST` (ve diğer REPO.*) | REPO → Level 1 | **success** (tutarlı, L1 yazıyor) ✓ |
| `NTP.SERVER`, `AC.ANTI_PASSBACK`, `ACTUATOR0.PULSE_TIME`, `WIEGAND0.ENABLED` | L1 | **success** (tutarlı) ✓ |

**→ Soru A1:** `HTTPCLIENT.HOST` yazmanın **Level 99** olması kasıtlı mı? Bu seviye dokümanda
"effectively internal/factory" olarak geçiyor. Entegratör olarak HTTP event hedefini (HTTPCLIENT.HOST)
**hiçbir** USER1–USER5 şifresiyle değiştiremiyor muyuz? Eğer değiştirilebiliyorsa hangi seviye gerekir?

**→ Soru A2:** `LOGGER.*` write gerçekte **Level 2** (doküman 3 diyor). Doğru olan hangisi —
USER2 mi USER3 mü ile yazabiliriz?

---

## B. Event almak için ihtiyacımız (asıl amacımız)

Panelin kart event'lerini bize ulaştırmasının önündeki tüm admin-only yollar kapalı çıktı:
HTTPCLIENT.HOST = L99, MQTT.* = L3, LOGGER.* = L2. Üç olası çözümden birini açmanız gerekiyor:

### Seçenek 1 — Kendi MQTT broker'ımıza geçiş (tercihimiz)
- **İhtiyaç: USER3 (Level 3) şifresi.** Bununla `MQTT.BROKER`, `MQTT.PORT`, `MQTT.USERNAME`,
  `MQTT.PASSWORD`, `MQTT.SSL_ENABLED` ve `LOGGER.PROTOCOL=MQTT` + `LOGGER.AC_LOG_TOPIC`'i kendi
  broker'ımıza çeviririz.
- **→ Soru B1:** USER3 şifresini bize tek seferlik verebilir misiniz? (Sonrasında kendi broker'ımız
  bağımsız çalışır.)

### Seçenek 2 — Sizin broker'ınızı dinleme (şifresiz)
- Panel şu an **bir MQTT broker'a bağlı** (`MQTT.STATUS = "Connected"`, app_log: `[MQTT] Connected`).
  Ama `MQTT.BROKER`/`USERNAME`/`TOPIC_PUBLISH` okuma Level 3 olduğu için **hangi broker'a bağlı
  olduğunu L1 ile göremiyoruz** (cevapta omit ediliyor).
- **→ Soru B2:** Panel şu an hangi broker'a bağlı (host/port)? Bu broker'a **read-only abonelik**
  verebilir misiniz? Kart event'leri hangi **topic**'e yayınlanıyor
  (`LOGGER.AC_LOG_TOPIC`, default `event/access/online` mı)?

### Seçenek 3 — Cihazda log saklama + L1 ile çekme
- `get_data {data_type:"log", page, page_len}` **Level 1 ile çalışıyor** (`result:"success"`),
  ama liste **boş** dönüyor. Sebep: `LOGGER.SAVE_AFTER_LIVE_SEND=0` ve `KEEP_SENT_RECORDS_N=0`
  (retain kapalı) → event broker'a gönderilince cihazda **saklanmıyor**.
  `SYSTEM.STORAGE_FILES` çıktısı bunu doğruluyor: `access_logs_unsent.bin = 0 byte`, `event_log2.bin = 0`.
- **→ Soru B3:** `LOGGER.SAVE_AFTER_LIVE_SEND=1` + `KEEP_SENT_RECORDS_N>0` yazmak için **USER2**
  şifresi verebilir misiniz? Bununla event'ler cihazda kalır, biz L1 `get_data log` ile periyodik çekeriz.

---

## C. KRİTİK: Access event payload şekli dokümanda YOK

- `§6.3 Access Event Logging` sadece **topic/path/QoS** veriyor; **gönderilen JSON'un alan
  isimlerini vermiyor.** `§5.4 Log Record` ise "detay için 0.1.1 Release Notes" Google Docs linkine
  yönlendiriyor (entegratör için yetersiz).
- `§4.4.1`'e göre her `update_actuator` bir access log üretmeli (LATCH_ON=type 4, LATCH_OFF=type 5).
  Ama biz `update_actuator {io_id:0, keep:1}` (latch on, "Actuator latched" döndü) ve `keep:0`
  (latch off) yaptıktan sonra `get_data log` **yine boş** geldi — latch event'leri loglanmadı/saklanmadı.

- **→ Soru C1 (en önemli):** Bir kart okutulduğunda panelin yayınladığı **access event'in tam JSON
  örneğini** paylaşır mısınız? Özellikle:
  - Kart numarası hangi alanda? (`user_id`? `card`? `id`? — int mi string mi)
  - Hangi aktüatör/kapı bilgisi var? (`io_id`? `actuator`?)
  - Erişim sonucu/durum kodu var mı? (granted/denied, ya da type 1/2/3/4/5)
  - Zaman damgası alanı ve formatı? (unix epoch mı `NTP.TIME` gibi string mi?)
  - Panel kimliği event'e ekleniyor mu? (`dst-id`/`uuid`/envelope `transaction` var mı, yoksa düz obje mi?)
  - online (`event/access/online`) ve offline event payload'ları aynı mı?

---

## D. Bu donanımda OLMAYAN doküman parametreleri (bilgi amaçlı, kritik değil)

`parameter_read` ile denendiğinde cihazın "yok" dediği, dokümanda ise tanımlı olanlar:

| Parametre | Doküman | Cihaz cevabı |
| :-- | :-- | :-- |
| `SYSTEM.PID` | §10.1 (exactly 16 chars, L5) | `Unknown parameter on module` |
| `AUTH.TOKEN_TTL` | §10.3 (default 600) | `unknown parameter` |
| `WIFI.SSID` ve WIFI.* | §10.14 (tüm modül) | `no Params class for module` / `getter failed` (panel **Ethernet**, WiFi modülü yok) |

**→ Soru D1:** Bu panel (4 Output DC) Ethernet-only mi? `AUTH.TOKEN_TTL` yoksa token ömrü neye göre
belirleniyor (gözlemde ~600 sn)? `SYSTEM.PID` bu modelde neden tanımlı değil?

---

## E. Doğru çalışan, doğrulanmış kısımlar (referans)

Bunlar dokümanla **uyumlu**, sorun yok — sadece neyin çalıştığını görün diye:
- `login` (admin/Level 1) → token alınıyor ✓
- `parameter_read` (L1 görünür alanlar) ✓
- `update_actuator {io_id, keep:1/0}` → röle latch/release ✓ (kapı açma çalışıyor)
- `get_data {data_type:"user"/"log", page, page_len}` (L1) → success (içerik boş, panelde 0 kullanıcı) ✓
- `parameter_write` REPO.* / NTP.* / AC.* / ACTUATOR0.* / WIEGAND0.* (L1) → success ✓
- `SYSTEM.METRICS`, `SYSTEM.STORAGE_FILES`, `get_app_logs` (L1) → çalışıyor ✓

---

## Özet — sizden net olarak ihtiyacımız (öncelik sırası)
1. **(C1)** Kart okutunca yayınlanan access event'in **örnek JSON'u** (alan isimleri). — Hangi yolu
   seçersek seçelim bu şart.
2. **(B1)** Kendi broker'ımıza geçmek için **USER3 (Level 3) şifresi.** — Tercih ettiğimiz çözüm.
3. Alternatif: **(B2)** mevcut broker bilgisi + read-only abonelik, **VEYA** **(B3)** USER2 ile log-retain.
4. **(A1)** `HTTPCLIENT.HOST`'un Level 99 olması kasıtlı mı, entegratör hiç değiştiremez mi?

# Ne Yapmalıyım, Nasıl Test Ederim? – Kart okuyucu akışı

Adım adım: önce veriyi hazırla, sonra endpoint’i test et, sonra cihazdan dene.

---

## A. Ne yapman lazım (sırayla)

### 1. Cihazı Convex’e bağla

- Hikvision cihazda **Event → Linkage Method → HTTP** (veya **httpHosts**) bölümünde **Server URL** şu olsun:
  - `https://<senin-deployment>.convex.site/card-reader`
- Örnek: `https://notable-tern-4.convex.site/card-reader`
- Convex Dashboard → **Settings** → **URL** kısmından deployment URL’ini al.

### 2. Cihazı ngsaccess’e kaydet

- **Cihazlar** sayfasından **Yeni cihaz** ekle.
- **Seri numarası** alanına, Hikvision cihazın **tam seri numarasını** yaz (cihazdan veya curl ile aldığın değer).
  - Örnek: `DS-K1T343MFWX20240702V032100ENFT9649880`
- Cihazı ilgili **erişim grubuna** (access rule / group) bağla; aksi halde okuma “reddedildi” olur.

### 3. Çalışan ve kart no

- **Çalışanlar** sayfasında en az bir çalışanın **kart numarası** (card number) alanı dolu olsun.
- Bu numara, Hikvision’ın event’te göndereceği **kart no** ile **birebir aynı** olmalı (boşluk, büyük/küçük harf dahil).
- Bu çalışanı, cihazın bağlı olduğu **erişim grubuna** dahil et.

### 4. Convex’i çalıştır

- Terminalde: `npx convex dev`
- Deploy bitene kadar bekle; sonra HTTP endpoint’ler (örn. `/card-reader`) kullanılabilir olur.

---

## B. Nasıl test edeceksin (adım adım)

### Test 1: curl ile “düz” JSON (en basit)

Aşağıdakinde:

- `CARD_NO`: Bir çalışanın kart numarası (employees tablosundaki `cardNumber`).
- `DEVICE_SERIAL`: Cihazın seri numarası (devices tablosundaki `deviceSerial`).

```bash
export URL="https://notable-tern-4.convex.site/card-reader"   # kendi deployment URL’in
export CARD_NO="12345678"
export DEVICE_SERIAL="DS-K1T343MFWX20240702V032100ENFT9649880"

curl -s -w "\nHTTP: %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{\"cardNo\":\"$CARD_NO\",\"serialNumber\":\"$DEVICE_SERIAL\"}"
```

**Beklenen:**

- HTTP **200**
- Body: `{"cevap":"ok"}` (izin verildi) veya `{"cevap":"error"}` (reddedildi; çalışan/cihaz/grup ayarını kontrol et).

**Hata alırsan:**

- `user_id missing` → JSON’da kart no yok veya farklı isimde; `cardNo` veya `user_id` kullan.
- `serial missing` → Cihaz seri no yok; `serialNumber` veya `deviceSerial` kullan.
- HTTP 500 → Convex Dashboard → **Logs**; hata mesajına bak.

---

### Test 2: Hikvision tarzı sarmalayıcı (EventNotificationAlert)

```bash
curl -s -w "\nHTTP: %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{\"EventNotificationAlert\":{\"cardNo\":\"$CARD_NO\",\"serialNumber\":\"$DEVICE_SERIAL\"}}"
```

Yine **200** ve `cevap: ok` veya `error` beklenir.

---

### Test 3: Kaydın tabloya düştüğünü kontrol et

1. Convex Dashboard → **Data** → **cardReadings** tablosunu aç.
2. Son eklenen kayda bak:
   - `cardNo`, `accessTime`, `accessStatus` (izin_verildi / reddedildi), `deviceId`, `employeeId` dolu mu?
3. Uygulama tarafında **Erişim kontrolü** / kart okuma listesi sayfasında da aynı kaydı görmelisin.

---

### Test 4: Cihazdan gerçek okuma

1. Cihazda **HTTP Host** URL’inin `https://<deployment>.convex.site/card-reader` olduğundan emin ol (Adım A.1).
2. Cihazda kart veya parmak izi okut.
3. Hemen sonra:
   - Convex Dashboard → **Logs** → `POST /card-reader` satırına bak; istek gelmiş mi?
   - **Data** → **cardReadings** → yeni satır eklenmiş mi?

Cihazdan istek gelmiyorsa:

- Cihaz ağından bu URL’e erişim var mı (DNS, firewall)?
- Cihazda httpHosts / Event URL ayarı doğru mu? (curl ile kontrol: `scripts/cihaz-ayar-kontrol.sh`, `scripts/cihaz-event-endpointleri.sh`)

---

## C. Hızlı kontrol listesi

| # | Kontrol | Nasıl |
|---|--------|--------|
| 1 | Deployment URL | Convex Dashboard → Settings → URL |
| 2 | Cihaz seri no | Cihaz web arayüzü veya `scripts/cihaz-ayar-kontrol.sh` (deviceInfo) |
| 3 | Cihaz kayıtlı mı? | ngsaccess Cihazlar → Seri no eşleşiyor mu? |
| 4 | Çalışan kart no | ngsaccess Çalışanlar → Kart numarası = event’teki kart no |
| 5 | Erişim grubu | Cihaz ve çalışan aynı erişim grubunda mı? |
| 6 | curl testi | Yukarıdaki curl ile 200 + cevap alıyor musun? |
| 7 | cardReadings tablosu | Test sonrası yeni kayıt görünüyor mu? |

---

## D. Sık hatalar

| Belirti | Olası sebep | Ne yapmalı |
|----------|-------------|------------|
| `user_id missing` | Body’de kart no yok veya farklı alan adı | Log’da gelen JSON’u incele; gerekirse `convex/lib/cardReaderParse.ts` içinde `CARD_FIELDS`’a alan ekle |
| `serial missing` | Body’de cihaz seri no yok | Aynı şekilde `SERIAL_FIELDS` ve gelen JSON’u kontrol et |
| `cevap: error` (200) | İzin reddedildi | Çalışan/cihaz/grup eşleşmesini kontrol et; Convex Data’da son cardReadings kaydında `accessStatus: reddedildi` sebebini incele |
| HTTP 500 | Parse veya mutation hatası | Convex Logs’ta “Card reader error” satırına bak; body geçerli JSON mı? |
| Cihazdan istek yok | Ağ veya cihaz ayarı | httpHosts URL’i doğru mu? DNS açık mı? Cihaz bu URL’e erişebiliyor mu? |

Bu adımları takip ederek hem “ne yapmalıyım” hem de “nasıl test ederim” kısmını adım adım uygulayabilirsin. İstersen bir sonraki adımda sadece curl komutlarını tek script’te toplayalım (farklı formatlar için).

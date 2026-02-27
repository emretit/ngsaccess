# Başlangıç – Şu ana kadar yapılanlar ve sıradaki adımlar

## ✅ Yapılanlar

1. **Cihaz kontrolü** – 192.168.1.212 erişilebilir, seri no: `DS-K1T343MFWX20240702V032100ENFT9649880`
2. **HTTP Host** – Cihaz event’leri `notable-tern-4.convex.site/card-reader` adresine gönderecek şekilde ayarlı
3. **Endpoint testi** – curl ile 3 format da **HTTP 200** döndü; body `{"cevap":"error"}` (izin reddedildi)

`cevap: error` = Endpoint ve parse doğru çalışıyor; reddetme sebebi veritabanında cihaz/çalışan veya erişim grubu eşleşmesinin olmaması.

---

## Sıradaki adımlar (sırayla)

### 1. Cihazı uygulamaya ekle

- Uygulamada **Cihazlar** → **Yeni cihaz**
- **Seri numarası:** `DS-K1T343MFWX20240702V032100ENFT9649880` (tek karakter bile farklı olmasın)
- İsim, bölge/kapı vs. doldur, kaydet
- Bu cihazı bir **erişim kuralı grubuna** (access rule) bağla

### 2. Çalışan ve kart no

- **Çalışanlar**’da test için bir çalışan seç (veya yeni ekle)
- **Kart numarası** alanına örn. `12345678` yaz (veya cihazda okutacağın kartın numarası)
- Bu çalışanı, cihazın bağlı olduğu **erişim grubuna** ekle

### 3. Tekrar curl testi

```bash
# Aynı kart no ve seri ile
CARD_NO=12345678 DEVICE_SERIAL=DS-K1T343MFWX20240702V032100ENFT9649880 ./scripts/test-card-reader-curl.sh
```

- Beklenen: HTTP 200 ve `{"cevap":"ok"}`
- Hâlâ `error` ise: Convex Dashboard → **Data** → **cardReadings** son kayda bak; **devices** ve **employees**’ta ilgili kayıtların ve **groupMembers** / **groupDevices** ilişkilerinin doğru olduğundan emin ol

### 4. Cihazdan gerçek okuma

- Cihazda kart veya parmak izi okut
- Convex **Logs**’ta `POST /card-reader` isteğini gör
- **Data** → **cardReadings**’te yeni kayıt oluştuğunu kontrol et

---

## Hızlı test komutları

```bash
# Cihaz ayarı kontrolü
HIKVISION_IP=192.168.1.212 ./scripts/cihaz-ayar-kontrol.sh

# Endpoint testi (varsayılan kart: 12345678, seri: DS-K1T343MFWX...)
./scripts/test-card-reader-curl.sh

# Kendi kart/seri ile
CARD_NO=98765432 DEVICE_SERIAL=DS-K1T343MFWX20240702V032100ENFT9649880 ./scripts/test-card-reader-curl.sh
```

Bu sırayla ilerlediğinde önce curl’den `ok`, sonra cihazdan gelen event’lerin de kayda düşmesi gerekir.

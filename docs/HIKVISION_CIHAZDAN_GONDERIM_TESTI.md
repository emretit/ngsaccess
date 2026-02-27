# Hikvision: Cihazın Kendisinin Convex’e Göndermesini Test Etme

## Durum

- **Bizim curl ile Convex’e istek atmak** = Bizim bilgisayar Convex’e gidiyor → Cihazı test etmiyor.
- **İstediğimiz** = Cihazda kart okutulunca **cihazın** Convex’e POST atması.

Bu cihazda (DS-K1T807EBFWX-E1) **“test gönder”** gibi bir ISAPI yok; event sadece **gerçek okuma** (kart/parmak izi) olduğunda gidiyor. Bu yüzden test için cihazda **gerçekten okutma** yapıp Convex log’unu kontrol etmek gerekiyor.

---

## Adım adım: Cihazdan giden isteği kontrol etme

### 1. Convex Logs’u aç

- Convex Dashboard → **Logs**
- Filtre: `card-reader` veya `istek alındı` yazın

### 2. Cihazda okut

- **192.168.1.27** adresindeki Hikvision cihazın başına git
- Geçerli bir **kart** veya **parmak izi** okut

### 3. Log’a bak

- Birkaç saniye içinde yeni bir satır gelmeli:
  - **Function:** `POST /card-reader` veya `H POST /card-reader`
  - **Status:** 200 veya 400

- Bu satır **varsa** → Cihaz Convex’e istek atıyor, entegrasyon çalışıyor.
- Bu satır **yoksa** → İstek Convex’e ulaşmıyor (DNS, ağ, httpHosts URL’i vb. kontrol edin).

### 4. (İsteğe bağlı) Body’yi incele

- Log’da ilgili `POST /card-reader` satırına tıkla
- **Execution** / **Logs** çıktısında `[card-reader] istek alındı` ile gelen **JSON body** görünür
- Bu body’deki alan adları (örn. `cardNo`, `serialNumber`) parser ile uyumlu mu diye kontrol edebilirsin

---

## Hızlı kontrol listesi

| Kontrol | Nerede | Beklenen |
|--------|--------|----------|
| Cihaz IP | 192.168.1.27 | Erişilebilir |
| httpHosts URL | Cihaz / ISAPI veya arayüz | `https://notable-tern-4.convex.site/card-reader` |
| DNS | Cihaz ağ ayarları | Açık (hostname çözülsün) |
| Gerçek okuma | Cihazda kart/parmak | Convex Logs’ta `POST /card-reader` görünmeli |

---

## Neden “cihazdan curl” yok?

- Cihazda **curl** veya benzeri bir araç yok; sadece HTTP Listening (httpHosts) ile event’leri POST’luyor.
- ISAPI’de `POST .../httpHosts/1/test` bu modelde **methodNotAllowed** veriyor; yani “test gönder” tetikleyemiyoruz.
- Bu yüzden **cihazın göndermesini** kontrol etmenin tek yolu: **cihazda kart okutup** Convex Logs’ta isteği görmek.

Özet: Cihaz adına kendimiz göndermiyoruz; cihazda okutma yapıp cihazın gönderdiği isteği Convex’te log’dan kontrol ediyoruz.

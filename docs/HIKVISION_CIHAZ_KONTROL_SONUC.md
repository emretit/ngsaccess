# Hikvision Cihaz Kontrolü – Curl ile Yapılan İnceleme

**Cihaz:** 192.168.1.27 (DS-K1T807EBFWX-E1)  
**Tarih:** 27 Şubat 2026

---

## 1. httpHosts Yapılandırması (Tamam)

| Ayar | Değer | Durum |
|------|-------|-------|
| URL | `https://notable-tern-4.convex.site/card-reader` | ✅ Doğru |
| Protokol | HTTPS | ✅ |
| Format | JSON | ✅ |
| Hostname | notable-tern-4.convex.site | ✅ |
| Event | AccessControllerEvent, eventMode: all | ✅ |

**Sonuç:** HTTP Listening doğru yapılandırılmış. Cihaz event’leri bu adrese göndermesi gerekiyor.

---

## 2. Tespit Edilen Sorun: DNS Kapalı

| Interface | IP | Gateway | DNS Sunucular | DNSEnable |
|-----------|-----|---------|---------------|-----------|
| 1 | 192.168.1.27 | 192.168.1.1 | 8.8.8.8, 8.8.4.4 | **false** |

Cihaz **hostname** kullanıyor: `notable-tern-4.convex.site`  
DNS devre dışı olduğu için cihaz bu hostname’i IP’ye çeviremiyor → Convex adresine bağlanamıyor.

---

## 3. Çözüm: DNS’i Etkinleştirin

### Yöntem: Web Arayüzü

1. Tarayıcıda: **https://192.168.1.27**
2. Giriş: admin / ngs05278
3. **Configuration** → **Network** → **Basic Settings**
4. **DNS** bölümünde **Enable** işaretleyin
5. Primary DNS: 8.8.8.8 (zaten tanımlı olabilir)
6. **Save** ile kaydedin

Veya menü benzeriyse:
- **System** → **Network** → **TCP/IP** → DNS Enable

---

## 4. API ile DNS Açma Denemesi (Başarısız)

`PUT /ISAPI/System/network/interfaces/1` ile `DNSEnable: true` gönderildi.  
Cihaz `badXmlContent` / `DNSEnable` hatası döndü – bu modelde ISAPI üzerinden değişiklik desteklenmiyor olabilir.

---

## 5. Test Endpoint (Kullanılamıyor)

```
POST /ISAPI/Event/notification/httpHosts/1/test
```

Yanıt: `methodNotAllowed` – Bu modelde test endpoint’i farklı çalışıyor veya desteklenmiyor.

---

## 6. Doğrulama Adımları

DNS’i web arayüzünden açtıktan sonra:

1. Cihazda kart veya parmak izi okutun
2. Convex Dashboard → Logs → `http/card-reader` bölümünde istek gelip gelmediğini kontrol edin
3. `cardReadings` tablosunda kayıt oluşup oluşmadığına bakın

---

## 7. Curl ile Manuel Test (Referans)

```bash
# Convex endpoint testi (cihaz dışında, kendi makinenizden)
curl -X POST "https://notable-tern-4.convex.site/card-reader" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"12345678","serial":"DS-K1T807EBFWX-E120250619V042400ENGB8172365"}'
```

Bu komut `200` dönerse Convex tarafı çalışıyordur.

---

## 8. İlgili Dosyalar

- `scripts/check-hikvision-httpHosts.sh` – httpHosts kontrolü
- `scripts/test-card-reader-curl.sh` – Convex endpoint testi
- `docs/HIKVISION_HOST1_ALAN_ESLEMESI.md` – Alan eşlemesi

# Hikvision – Kişi Senkronizasyonu (Cihazla Eşitleme)

Bu dokümanda Hikvision cihazına kişi/kart verisi gönderme yöntemi anlatılır. Cihaz **yerel doğrulama** (local verification) yapıyorsa – yani önce kendi veritabanına bakıyorsa – kişileri cihaza senkronize etmek gerekir.

---

## İki Yaklaşım

| Yaklaşım | Cihazda kişi | Ne yapılır |
|----------|--------------|------------|
| **Remote Verification** | Gerekmez | Cihaz bize sorar; cevaba göre kapı açılır. Cihazda "Remote Verification" modu açık olmalı. |
| **Kişi Senkronizasyonu** | Gerekir | ngsaccess'teki çalışanları ISAPI ile cihaza göndeririz. Cihaz kendi listesinde kontrol eder. |

Senin cihazın "invalid card" gösteriyorsa muhtemelen **yerel doğrulama** yapıyor. Bu durumda kişileri cihaza senkronize etmek gerekir.

---

## ISAPI Kişi Yönetimi API'leri

Kaynak: `HIKVISION_ISAPI_FINGERPRINT_TERMINALS_DETAYLI.md` Bölüm 9.1

| İşlev | API | Method |
|-------|-----|--------|
| Destek kontrolü | `GET /ISAPI/AccessControl/UserInfo/capabilities?format=json` | — |
| Kişi ekleme | `POST /ISAPI/AccessControl/UserInfo/Record?format=json` | JSON body |
| Kişi düzenleme | `PUT /ISAPI/AccessControl/UserInfo/Modify?format=json` | JSON body |
| Kişi silme | `PUT /ISAPI/AccessControl/UserInfoDetail/Delete?format=json` | JSON body |

---

## Kişi Ekleme – Örnek JSON (cardNo ile)

```json
{
  "UserInfo": {
    "employeeNo": "EMP001",
    "employeeNoString": "EMP001",
    "name": "Emre Aydın",
    "userType": "normal",
    "gender": "male",
    "doorRight": "1",
    "RightPlan": [
      { "doorNo": 1, "planTemplateNo": "1" }
    ],
    "cardNo": "0108372442",
    "Valid": {
      "enable": true,
      "beginTime": "2025-01-01T00:00:00",
      "endTime": "2035-12-31T23:59:59",
      "timeType": "local"
    }
  }
}
```

**Önemli alanlar:**
- `employeeNo` / `employeeNoString` – Benzersiz person ID
- `name` – Görünen ad
- `cardNo` – Kart numarası (ngsaccess `employees.cardNumber` ile aynı olmalı)
- `userType` – `normal`, `blocklist`, `visitor` vb.
- `doorRight` – Kapı yetkisi (1 = açabilir)
- `RightPlan` – Kapı ve zaman planı
- `Valid` – Geçerlilik süresi

---

## Kimlik Doğrulama

Hikvision ISAPI **Digest Authentication** kullanır:

```bash
curl -s -k -u admin:şifre --digest -X POST \
  -H "Content-Type: application/json" \
  -d '{"UserInfo":{...}}' \
  "http://192.168.1.34/ISAPI/AccessControl/UserInfo/Record?format=json"
```

---

## ngsaccess → Hikvision Eşlemesi

| ngsaccess | Hikvision UserInfo |
|-----------|---------------------|
| `employees._id` veya `cardNumber` | `employeeNo` / `employeeNoString` |
| `employees.cardNumber` | `cardNo` |
| `employees.firstName` + `lastName` | `name` |
| `devices.deviceIp` | Cihaz IP (API hedefi) |

**Cihaz bilgisi:** `devices` tablosunda `deviceIp` var; kişi senkronu için cihaz kullanıcı adı ve şifresi de gerekir (ngsaccess'te henüz yok).

---

## Yapılacaklar (ngsaccess Tarafı)

1. **Cihaz kimlik bilgileri:** `devices` tablosuna `deviceUsername`, `devicePassword` (veya env/ayar) eklenebilir.
2. **Convex action:** Hikvision'a HTTP isteği atacak (mutation değil; HTTP dışarı çıkıyor).
3. **Senkron mantığı:**
   - Bir cihaz için: O cihaza erişimi olan tüm çalışanları al
   - Her biri için `POST .../UserInfo/Record` çağır
   - Hata yönetimi: Cihaz meşgul, JSON format hatası vb.
4. **Batch API:** Dokümanda "How to Send Person Data in Batch" geçiyor – tek istekte çoklu kişi gönderilebilir (model/firmware'e göre).

---

## Hikvision TPP Kaynakları

- **ISAPI:** How to Send Person Data in Batch
- **ISAPI:** How to Achieve Remote Verification by HTTP Listening
- Portal: https://tpp.hikvision.com

---

## Özet

- Cihaz yerel doğrulama yapıyorsa → **kişi senkronizasyonu** gerekir.
- ISAPI `UserInfo/Record` ile kişi + kart eklenir.
- ngsaccess'te: çalışan listesi → cihaz IP + auth → ISAPI POST.
- İleride: toplu gönderim (batch) ve cihaz credential yönetimi eklenebilir.

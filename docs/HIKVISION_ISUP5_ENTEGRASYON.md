# Hikvision ISUP 5.0 ile Convex Entegrasyonu

Bu doküman, Hikvision cihazlarını **ISUP 5.0** (Intelligent Security Unified Platform) protokolü üzerinden ngsaccess Convex backend’e nasıl bağlayacağınızı açıklar.

---

## ISUP 5.0 vs ISAPI (HTTP Callback)

| Özellik | ISAPI (HTTP) | ISUP 5.0 |
|--------|---------------|----------|
| **Bağlantı yönü** | Cihaz → HTTP POST → Sunucu | Cihaz → TCP (7660) → Sunucu |
| **Protokol** | HTTP/HTTPS, JSON/XML | Özel binary protokol (Hikvision SDK) |
| **Convex doğrudan dinler mi?** | Evet (`/card-reader`) | Hayır; Convex sadece HTTP sunar |
| **Kullanım** | Cihazda “HTTP Listening” / Event URL | Cihazda “ISUP” > Sunucu IP, Port 7660, Cihaz ID |

**Özet:** Convex yalnızca HTTP endpoint’leri sunar. ISUP 5.0 cihazı **TCP 7660** üzerinden bağlanır; bu yüzden arada **ISUP Gateway** adında bir ara sunucu gerekir. Gateway, ISUP bağlantısını kabul eder ve olayları Convex’e HTTP ile iletir.

---

## Mimari

```
[Hikvision Cihaz]  --ISUP 5.0 (TCP 7660)-->  [ISUP Gateway]
                                                    |
                                                    | HTTP POST
                                                    v
                                            [Convex /card-reader]
                                                    |
                                                    v
                                            [cardReadings, erişim kontrolü]
```

1. **Cihaz:** ISUP’u açıp Sunucu IP (Gateway’in IP’si), Port **7660**, Cihaz ID (isteğe bağlı şifreleme anahtarı) girer.
2. **Gateway:** 7660’ı dinler, cihazı kabul eder, erişim olaylarını (kart okuma vb.) alır.
3. **Gateway → Convex:** Her olayı `POST https://<deployment>.convex.site/card-reader` ile JSON gövdeyle gönderir.
4. **Convex:** Mevcut `/card-reader` endpoint’i ile kart okumayı işler, izin/red kaydı oluşturur.

---

## Cihazda Yapılacak Ayarlar (Ekran Görüntüsüne Göre)

Cihazda **Configuration > ISUP** ekranında:

| Alan | Değer | Açıklama |
|------|--------|----------|
| **Etkinleştir** | Açık | ISUP kullanılacak |
| **Protokol Sürümü** | ISUP 5.0 | Sabit |
| **Sunucu IP Adresi** | Gateway’in IP’si | Gateway’in dinlediği makinenin IP’si (yerel ağ veya public) |
| **Bağlantı Noktası** | 7660 | Varsayılan ISUP portu |
| **Cihaz Kimliği** | (Boş bırakılabilir veya anlamlı ID) | Gateway/Convex tarafında cihaz eşlemesi için kullanılabilir |
| **Şifreleme Anahtarı** | İsteğe bağlı | Cihaz ve gateway aynı anahtarı kullanmalı |

Kayıt durumu **Çevrimdışı** ise: Gateway’in çalıştığından, firewall’da 7660’ın açık olduğundan ve IP’nin doğru olduğundan emin olun.

---

## Convex Tarafı

Convex’te ek bir endpoint yazmaya gerek yok. Gateway, mevcut **`POST /card-reader`** endpoint’ini kullanır.

**Convex URL örneği:**
```text
https://<sizin-deployment>.convex.site/card-reader
```
(Deployment URL: Convex Dashboard > Settings > URL)

**Gönderilmesi gereken body (Gateway’in Convex’e POST ettiği):**

Gateway, ISUP’tan gelen olaydan `cardNo` ve `deviceSerial` (veya eşdeğer alanları) çıkarıp aşağıdaki formatlardan birini kullanmalıdır:

```json
{
  "cardNo": "KART_NO",
  "serialNumber": "CIHAZ_SERI_NO"
}
```

veya

```json
{
  "user_id": "KART_NO",
  "serial": "CIHAZ_SERI_NO"
}
```

`devices` tablosundaki **deviceSerial** ile cihazın seri numarası **birebir aynı** olmalıdır (Hikvision’dan gelen değer veya Gateway’in eşlediği ID).

---

## ISUP Gateway Nasıl Çalıştırılır?

Convex doğrudan TCP dinlemediği için ISUP 5.0 sunucusunu **ayrı bir sunucuda** (VPS, şirket içi makine, Docker) çalıştırmanız gerekir.

### Seçenek 1: Hikvision resmi SDK (C++ / Windows)

- Hikvision’dan **Device Gateway** veya ilgili ISUP SDK dokümantasyonunu edinin.
- `NET_ECMS_StartListen` benzeri dinleme API’si ile 7660’ı dinleyin.
- Gelen erişim olaylarını parse edip yukarıdaki JSON formatında Convex `POST /card-reader`’a iletin.

### Seçenek 2: Üçüncü parti / açık kaynak

- Örn. [QuickNV.HikvisionISUPSDK](https://github.com/QuickNV/QuickNV.HikvisionISUPSDK) (.NET) veya [hikvision_isup](https://github.com/135356/hikvision_isup) (C++) gibi projeler ISUP tarafını uygulayabilir.
- Bu yazılımı bir sunucuda çalıştırıp, olayları Convex URL’inize HTTP POST ile iletecek şekilde yapılandırın.

### Seçenek 3: ISAPI kullanmak (Gateway istemiyorsanız)

Cihazda ISUP yerine **HTTP event / Notify Surveillance Center** kullanırsanız, cihaz doğrudan Convex’e istek atar; arada gateway gerekmez. Bu durumda:

- Cihazda **Event > HTTP** (veya HTTP Listening) ayarında **Server URL** olarak doğrudan  
  `https://<deployment>.convex.site/card-reader`  
  verin.
- Detaylar için: [HIKVISION_ENTEGRASYON.md](./HIKVISION_ENTEGRASYON.md).

---

## Özet Kontrol Listesi (ISUP 5.0 ile Convex)

1. [ ] **Gateway kuruldu:** ISUP 5.0’ı dinleyen yazılım (Hikvision SDK veya 3. parti) çalışıyor, port 7660 açık.
2. [ ] **Cihaz ayarı:** ISUP açık, Sunucu IP = Gateway IP, Port = 7660, Cihaz ID (ve gerekirse şifreleme) doğru.
3. [ ] **Convex’te cihaz kayıtlı:** Devices’ta bu cihazın `deviceSerial` değeri, Gateway’in Convex’e gönderdiği seri/ID ile aynı.
4. [ ] **Gateway → Convex:** Her erişim olayında `cardNo` + `deviceSerial` (veya `user_id`/`serial`) ile `POST /card-reader` çağrılıyor.
5. [ ] **Kayıt durumu:** Cihazda “Kayıt Durumu” çevrimiçi görünüyorsa ISUP bağlantısı kurulmuştur.

Bu adımlarla Hikvision cihazınız ISUP 5.0 üzerinden Convex ile entegre edilmiş olur; erişim olayları Convex’te işlenir ve mevcut erişim kurallarınız geçerli olur.

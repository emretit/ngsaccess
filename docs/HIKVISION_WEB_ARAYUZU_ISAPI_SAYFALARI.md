# Hikvision: ISAPI Ayarları Hangi Sayfada?

Cihaz: **192.168.1.27** (DS-K1T807EBFWX-E1)

---

## 1. Web arayüzünde nereye bakılır?

Tarayıcıda **https://192.168.1.27** açıp giriş yaptıktan sonra (admin / ngs05278) şu menü yollarına bakın:

| Aradığınız ayar | Olası menü yolu |
|------------------|------------------|
| **HTTP event / Convex’e gönderim** | **Configuration** → **Event** → **Normal Event** → **Linkage Method** → **Notify Surveillance Center** veya **HTTP** |
| Alternatif | **Configuration** → **Alarm** → **Event** → **HTTP** |
| Alternatif (erişim kontrolü) | **Event** → **Access Control** → **Linkage** |
| Kart okuma event’i | **Event** → **Smart Event** → **Card Swiped** → **HTTP Notification** |

Bu modelde (DS-K1T807) **HTTP Listening (httpHosts)** bazen web arayüzünde görünmüyor; sadece ISAPI ile yapılandırılabiliyor. Menüde yoksa aşağıdaki “Tarayıcıdan ISAPI” yolunu kullanın.

---

## 2. Tarayıcıdan doğrudan ISAPI “sayfası” (XML)

Tarayıcıda aşağıdaki adreslere gittiğinizde, cihaz sizden kullanıcı/şifre isteyip sonra XML döner. Böylece ISAPI ayarlarını sayfa gibi görüntüleyebilirsiniz.

**Giriş:** admin / ngs05278 (cihaz sormadan açmazsa önce https://192.168.1.27 ile giriş yapıp sonra bu linklere tıklayın)

| Ne görmek istiyorsunuz? | Tarayıcıda açılacak adres |
|--------------------------|----------------------------|
| **HTTP Hosts** (Convex URL, event nereye gidiyor) | https://192.168.1.27/ISAPI/Event/notification/httpHosts |
| **Host 1 tek** | https://192.168.1.27/ISAPI/Event/notification/httpHosts/1 |
| **httpHosts yetenekleri** | https://192.168.1.27/ISAPI/Event/notification/httpHosts/capabilities |
| **Cihaz bilgisi** | https://192.168.1.27/ISAPI/System/deviceInfo |
| **Ağ (Interface 1)** | https://192.168.1.27/ISAPI/System/network/interfaces/1 |

Bunlar bir “sayfa” değil, ISAPI endpoint’i; tarayıcıda açınca **XML** içeriği görürsünüz. İstediğiniz ISAPI ayarının hangi “sayfada” (hangi URL’de) olduğu bu tablodaki adreslerdir.

---

## 3. Özet

- **“ISAPI ayarları hangi sayfada?”** → Web’de: **Configuration → Event → Normal Event → Linkage / HTTP**; bazen bu modelde yok.
- **Ayarları doğrudan görmek** → Tarayıcıda yukarıdaki ISAPI URL’lerini açın (ör. httpHosts için `/ISAPI/Event/notification/httpHosts`); XML olarak ISAPI ayarlarını görürsünüz.

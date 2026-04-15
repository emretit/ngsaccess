# Çalışan Cihaz — Anlık Konfigürasyon

> Son güncelleme: 2026-04-15  
> Çekme yöntemi: ISAPI curl (admin:ngs05278)

---

## Cihaz Kimliği

| Alan | Değer |
|------|-------|
| Model | DS-K1T807EBFWX-E1 |
| Seri No | DS-K1T807EBFWX-E120250619V042400ENGB8172365 |
| MAC | A4:D5:C2:6A:9D:C3 |
| Firmware | V4.24.0 (build 250619) |
| Hardware | V1.0.3 |
| Encoder | V2.9 (build 241008) |
| BSP | v1.0.0_S2025061900007 build 250619 |
| Üretim Tarihi | 2025-06-19 |
| Cihaz Tipi | ACS / accessControlTerminal |
| Röle Sayısı | 2 |
| Elektrikli Kilit | 1 |
| RS485 | 1 |

---

## Ağ Ayarları

| Alan | Değer |
|------|-------|
| IP | 192.168.1.34 |
| Subnet | 255.255.255.0 |
| Gateway | 192.168.1.1 |
| Primary DNS | 192.168.1.1 |
| Secondary DNS | 0.0.0.0 |
| DNS Aktif | true |
| IP Tipi | DHCP (dynamic) |
| Hız | 100 Mbps / full duplex |
| MTU | 1500 |

> DHCP kullandığı için IP değişebilir. Modemdeki DHCP rezervasyonuna bak.

---

## httpHosts Push Konfigürasyonu (slot 1)

| Alan | Değer |
|------|-------|
| URL | /card-reader |
| Protocol | HTTPS |
| Hostname | notable-tern-4.convex.site |
| Port | 443 |
| Format | JSON |
| Auth | none |
| Heartbeat | 30 saniye |
| Event Mode | list |

**Aktif Push:** DeployList size=1 → `192.168.1.6` (cihaz bu IP'ye push başlatıyor)

Subscribed event kodları (hex):
- **minorAlarm:** 0x40a, 0x40b, 0x40c, 0x404, 0x405, 0x408, 0x409
- **minorException:** 0x26, 0x27, 0x400, 0x407, 0x408, 0x428, 0x429, 0x409, 0x40a, 0x40f, 0x410
- **minorOperation:** 0x50, 0x5a, 0x5d, 0x5e, 0x70, 0x71, 0x76, 0x77, 0x79, 0x7a, 0x7b, 0x7e, 0x86, 0x87, 0xf0, 0xf1, 0x137, 0x138, 0x400–0x407, 0x40a, 0x40c, 0x40e, 0x419, 0x41a, 0x421, 0x422, 0x42f–0x433, 0x2601
- **minorEvent (kart):** 0x75 (Card Verification) dahil tüm kart event'leri

---

## Saat Ayarı

| Alan | Değer |
|------|-------|
| Zaman Modu | manual |
| Yerel Saat | 2026-04-15T21:10:42+03:00 |
| Zaman Dilimi | CST-3 (Türkiye) |

> NTP kullanmıyor, saat kayabilir. Gerekirse ISAPI ile senkronize et.

---

## Convex Bağlantısı

| Alan | Değer |
|------|-------|
| Site URL | https://notable-tern-4.convex.site |
| Endpoint | POST /card-reader |
| Deployment | dashing-elk-819 |
| DB Device ID | jn79jv8bh0j5c0gmwbe4j2gyds83wdz3 |
| Project ID | mn7cd3v776f5b3hks5qerwzpz581x3r8 |

---

## Bridge Scripti

Cihaz direkt Convex'e httpHosts üzerinden push yapıyor (DNS çalışıyor).  
Ek olarak subscribeEvent bridge da kullanılabilir:

```bash
HIK_IP=192.168.1.34 \
HIK_USER=admin \
HIK_PASS=<SIFRE> \
CONVEX_URL=https://notable-tern-4.convex.site/card-reader \
node scripts/hikvision-bridge.mjs
```

veya:

```bash
npm run bridge:hikvision
```

---

## Önemli Notlar

- **Şifre:** `.env` dosyasında sakla, bu dosyaya yazma
- **DHCP:** IP sabit değil, modem rezervasyonu önerilir
- **DeployList size=1:** httpHosts aktif ve push gidiyor (192.168.1.6 hedef)
- **Heartbeat:** Her 30 saniyede bir cardNo'suz event geliyor → Convex'te sessizce atlanıyor
- **WiFi:** Cihazda WiFi yok (Ethernet only)
- **Kart format:** multipart/form-data, JSON içinde `cardNo` alanı
- **Event geçmişi:** Cihazda 146 kayıt var (2026-02-27'den itibaren)

# Hik-Connect for Teams (HCT) OpenAPI — Yedek Plan / İleride Premium Tier

> **Durum (2026-05-17)**: ngsaccess **birincil yol olarak Device Gateway**'i seçti ([HIK_DEVICE_GATEWAY.md](HIK_DEVICE_GATEWAY.md)). Bu doküman, HCT'yi ileride **premium tier** veya **alternatif adapter** olarak değerlendirmek için referans olarak saklanır.
>
> **Kaynak**: Hik-Connect for Teams (HikCentral Connect) OpenAPI Developer Guide V2.15.0 (2026-03-06) — `Downloads/Hik-Connect for Teams OpenAPI Developer Guide_V2.15.0_20260306.pdf`. Hikvision TPP partner portal'dan ücretsiz indirilir.

---

## 1. HCT Nedir, Device Gateway'den Farkı

| | **HCT (bu doc)** | **Device Gateway** |
|---|---|---|
| Mimari | Hikvision'ın **bulut servisi** (Hikvision sunucusunda) | Senin **self-hosted yazılımın** (Hetzner) |
| Cihaz nereye bağlanır | Hik-Connect bulutuna (P2P) | Senin Hetzner sunucuna (ISUP 5.0) |
| Senin altyapı | Sıfır | Hetzner VPS €15-30/ay |
| Auth | AK/SK + Token | HTTP Digest |
| Limit | 10 cihaz free, sonra lisans | 10.000 cihaz / 200 ISAPI passthrough |
| Veri lokasyonu | Hikvision (Europe için `ieu.hikcentralconnect.com`) | Senin Hetzner (KVKK/GDPR kontrol sende) |
| Multi-tenancy | Müşteri başına ayrı HCT account (temiz) | Tek instance + areaId/permission ile böl |
| Cihazda ne değişir | Hiçbir şey (zaten Hik-Connect'e bağlı) | ISUP server IP/port'u Hetzner'e yönlendir |
| Webhook event | ✅ HCT bulutundan Convex'e push | Gateway → Convex POST |
| Geliştirme süresi | 1-2 hafta + AK/SK bekleme süreci | 1-2 hafta + sunucu yönetimi |
| SPOF | Hikvision (sen kontrol etmiyorsun) | Senin tarafın |

---

## 2. Lisans / Fiyatlandırma

**Free tier (self-registered HCT account):**
- 100 user + 10 cihaz/kapı
- Tüm modüller: video management + access control + attendance + intercom
- OpenAPI dahil

**10 cihaz aşıldığında:**
- "Service limit exceeded" → tüm feature'lar devre dışı
- Lisans alımı gerekli (ProLink MX'de örnek: 10 kapı / 50K kişi / 1 yıl)
- TR distribütöre fiyat sorulmalı

**Service Provider modeli (NGS için fırsat):**
> "You can invite a service provider to manage your system. You can purchase licenses from your service provider."

NGS, müşteriye **HCT lisans satıcısı** olarak konumlanabilir — Verkada/Brivo MSP modeli. Müşteri kendi HCT hesabını açar, NGS'i invite eder, NGS yönetir + lisans satar.

---

## 3. Server Adresleri (Region Bazlı)

| Region | Server |
|---|---|
| Russia | `https://hikcentralconnectru.com` |
| Singapore / India | `https://isgp.hikcentralconnect.com` |
| **Europe (TR dahil)** | `https://ieu.hikcentralconnect.com` |
| South America | `https://isa.hikcentralconnect.com` |
| North America | `https://ius.hikcentralconnect.com` |

> Yeni HCT portal: `https://www.hik-connect.com` — eski HikCentral Connect (`isgp.hikcentralconnect.com` vb.) **31/12/2025'te kapanıyor**.

---

## 4. Auth Akışı

**Çok basit — HMAC signature scheme yok.**

```
1. Hikvision'dan AK + SK al (Online Case ile, TPP portal üzerinden)

2. Token al (7 gün geçerli, refresh edilebilir):
   POST https://ieu.hikcentralconnect.com/api/hccgw/platform/v1/token/get
   Body: { "appKey": "<AK>", "appSecret": "<SK>" }

   Response:
   {
     "data": {
       "accessToken": "hcc.vh5hb9q495qjjei71g3pdmrjslo5wyti",
       "expireTime": 1655193135,
       "userId": "8a7485aa7f209dd5017f2141adff0019"
     },
     "errorCode": "0"
   }

3. Diğer tüm çağrılar:
   Headers:
     Token: <accessToken>
     Content-Type: application/json
```

**API rules:**
- HTTPS zorunlu
- POST/GET
- JSON, UTF-8
- **Rate limit: 5 req/sec** (bulk sync için throttle gerek)
- Token TTL 7 gün, refresh ile uzar
- Response format: `{ "errorCode": "0", "message": "...", "data": {...} }`

---

## 5. Kritik Endpoint Haritası

```
Server: https://ieu.hikcentralconnect.com (Europe)

Auth
────
POST /api/hccgw/platform/v1/token/get          → AK+SK → token

Kişi Yönetimi
─────────────
POST /api/hccgw/person/v1/groups/add           → Departman (accessGroups karşılığı)
POST /api/hccgw/person/v1/groups/delete
POST /api/hccgw/person/v1/persons/add          → Kişi ekle
POST /api/hccgw/person/v1/persons/update       → Güncelle (cihazda da)
POST /api/hccgw/person/v1/persons/delete

Credential
──────────
POST /api/hccgw/person/v1/persons/cardcollect   → Karttan no oku
POST /api/hccgw/person/v1/persons/updatecards   → Kart no güncelle
POST /api/hccgw/person/v1/persons/photo         → Yüz foto
POST /api/hccgw/person/v1/persons/updatepincode → PIN

Yetki (Access Level — accessRules karşılığı)
────────────────────────────────────────────
POST /api/hccgw/acspm/v1/access/level/add       → Yetki tanımla
POST /api/hccgw/acspm/v1/accesslevel/person/add → Kişiye yetki ata

Kapı Kontrolü & Event Sorgula
─────────────────────────────
POST /api/hccgw/acs/v1/remote/control                  → Kapıyı uzaktan aç ⭐
POST /api/hccgw/acs/v1/event/certificaterecords/search → Kart okutma geçmişi

🎯 Webhook (event push)
──────────────────────
POST /api/hccgw/webhook/v1/config/save     → Webhook URL kaydet
POST /api/hccgw/webhook/v1/config/query    → Mevcut webhook'lar
```

---

## 6. Person Add Örnek (`persons/add`)

```http
POST /api/hccgw/person/v1/persons/add
Token: <accessToken>
Content-Type: application/json

{
  "groupId": "<departman-id>",
  "personCode": "1001",          // employeeNo, 1-16 char, unique
  "firstName": "Ahmet",
  "lastName": "Yılmaz",
  "gender": 2,                   // 0=female, 1=male, 2=unknown
  "phone": "+905551234567",
  "email": "ahmet@example.com",
  "startDate": "2026-01-01T00:00:00+03:00",
  "endDate": "2035-12-31T23:59:59+03:00"
}

Response:
{
  "data": {
    "personId": "379224379437087745",
    "personCode": "1001"
  },
  "errorCode": "0"
}
```

> Person eklendikten sonra ayrı API'lerle kart/yüz/parmak izi atanır.

---

## 7. Door Open Örnek

```http
POST /api/hccgw/acs/v1/remote/control
Token: <accessToken>

{
  "remoteControl": {
    "actionType": 1,              // 1=open
    "elementlist": [],            // boş = areaId'ye göre
    "direction": 0,
    "areaId": "<area-uuid>",
    "depthTraversal": 0
  }
}
```

---

## 8. Webhook (Event Push)

🎯 **HCT'nin en büyük avantajı**: cihazın LAN'da DNS sorununa girmeden, **HCT bulutu Convex'e webhook ile push eder**.

```http
POST /api/hccgw/webhook/v1/config/save
Token: <accessToken>

{
  "url": "https://notable-tern-4.convex.site/card-reader",
  "eventTypes": ["access.control.event"],
  "secret": "<hmac-secret>"
}
```

HCT bulutundan webhook geldiğinde Convex `/card-reader` endpoint'i webhook formatını parse eder. Mevcut `cardReaderParse.ts`'e HCT webhook adapter eklenir.

---

## 9. ngsaccess Schema (HCT için)

```ts
devices: defineTable({
  // ... mevcut alanlar
  hikIntegrationType: v.union(v.literal("hct"), v.literal("gateway")),

  // HCT için
  hctDeviceId: v.optional(v.string()),         // HCT'deki cihaz UUID
  hctOrgId: v.optional(v.string()),            // HCT account/team ID

  // Device Gateway için (HIK_DEVICE_GATEWAY.md'de)
  hikDevIndex: v.optional(v.string()),
  ehomeID: v.optional(v.string()),
})

employees: defineTable({
  // ... mevcut alanlar
  hctPersonId: v.optional(v.string()),         // HCT persons/add response'unda gelir
})

accessGroups: defineTable({
  // ... mevcut alanlar
  hctGroupId: v.optional(v.string()),
})

accessRules: defineTable({
  // ... mevcut alanlar
  hctAccessLevelId: v.optional(v.string()),
})
```

---

## 10. AK/SK Alma Süreci

1. **HCT Team account aç**: `https://ieu.hikcentralconnect.com` veya `www.hik-connect.com` üzerinden
   - VEYA: Hik-Connect mobile app içinden "Request Team Trial Services"
2. Cihazları HCT Team account'a transfer et (zaten Hik-Connect'te varsa kolay)
3. **TPP portal Online Case aç**:
   - Subject: "Apply for AK/SK for HCT OpenAPI"
   - Body: HCT account email + use case (ngsplus.app SaaS, ~10-50 cihaz target)
4. 1-3 iş günü içinde AK/SK gelir email ile

---

## 11. HCT Adapter — Ne Zaman Devreye Alınır?

Doc'taki Device Gateway ([HIK_DEVICE_GATEWAY.md](HIK_DEVICE_GATEWAY.md)) primary yol. HCT adapter şu senaryolarda eklenir:

### Senaryo A: Müşteri self-hosted istemiyor
- "Kendi sunucumu yönetmek istemem, hazır servis verin" diyen müşteri
- → Müşteri HCT account açar, NGS'i Service Provider invite eder
- → ngsplus.app HCTAdapter ile yönetir

### Senaryo B: Cihazlar farklı lokasyonlarda dağınık
- Her lokasyon için ayrı Device Gateway kurmak yerine HCT bulutu kullan
- Daha az operasyonel yük

### Senaryo C: Premium tier — "fully managed"
- Standard tier: Device Gateway (self-hosted, NGS yönetir, daha düşük fiyat)
- Premium tier: HCT (Hikvision yönetir, garanti, daha yüksek fiyat)

### Kod tarafında

```ts
// convex/lib/hikvisionAdapter.ts
interface HikvisionAdapter {
  addPerson(deviceRef: string, person: PersonData): Promise<{id: string}>;
  deletePerson(deviceRef: string, personId: string): Promise<void>;
  openDoor(deviceRef: string, doorId: number): Promise<void>;
  // ...
}

class DeviceGatewayAdapter implements HikvisionAdapter { /* ... */ }
class HCTAdapter implements HikvisionAdapter { /* ... */ }

// Runtime'da device.hikIntegrationType'a göre seçim:
const adapter = device.hikIntegrationType === "hct"
  ? new HCTAdapter()
  : new DeviceGatewayAdapter();
```

---

## 12. İlgili Belgeler

- [HIK_DEVICE_GATEWAY.md](HIK_DEVICE_GATEWAY.md) — **Birincil yol** (Hetzner self-hosted)
- [HIKVISION_ENTEGRASYON.md](HIKVISION_ENTEGRASYON.md) — Genel Hikvision entegrasyon
- [sdk/](sdk/) — Hikvision SDK reference (HCNetSDK)
- Hikvision PDF: `Downloads/Hik-Connect for Teams OpenAPI Developer Guide_V2.15.0_20260306.pdf`
- TPP portal: `https://tpp.hikvision.com` (NGS Teknoloji MLA partner)

---

## 13. Karar Kayıtları

- **2026-05-17**: HCT yerine Device Gateway primary seçildi. Sebep: kontrol + lisans modeli + Hetzner zaten var. HCT alternatif olarak saklandı — premium tier veya farklı müşteri segmenti için.

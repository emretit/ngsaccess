# HCNetSDK Log Tipleri

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Appendix C.4, s.437–471

## Özet

HCNetSDK kendi içinde **debug/audit log** üretir. Bu loglar:
- SDK init / cleanup
- Login / logout
- Config get/set çağrıları
- Alarm channel setup
- Hata durumları

Log tipleri **major + minor** çiftleri ile sınıflandırılır. ngsaccess HCNetSDK kullanmadığı için bu loglar **doğrudan görünmez** — sadece bridge process veya Hikvision'ın kendi araçları (iVMS-4200) için anlamlı.

---

## Log Major Type'ları

| Major | Açıklama |
|---|---|
| `MAJOR_OPERATION` | Operasyon (login, config) |
| `MAJOR_ALARM` | Alarm event'leri |
| `MAJOR_EXCEPTION` | İstisna durumlar |
| `MAJOR_INFORMATION` | Bilgilendirme |

## Log Minor Type Kategorileri

### Local Operations
- `MINOR_LOCAL_LOGIN`, `MINOR_LOCAL_LOGOUT`
- `MINOR_LOCAL_PLAY`, `MINOR_LOCAL_BACKUP`
- `MINOR_LOCAL_CFG_PARAM` (config değişiklik)
- `MINOR_LOCAL_UPGRADE`, `MINOR_LOCAL_FORMAT_HDD`

### Remote Operations
- `MINOR_REMOTE_LOGIN`, `MINOR_REMOTE_LOGOUT`
- `MINOR_REMOTE_PLAY`, `MINOR_REMOTE_BACKUP`
- `MINOR_REMOTE_CFG_PARAM`
- `MINOR_REMOTE_REBOOT`, `MINOR_REMOTE_UPGRADE`
- `MINOR_REMOTE_ARM`, `MINOR_REMOTE_DISARM`

### Network / System
- `MINOR_DEV_POWER_ON`, `MINOR_DEV_POWER_OFF`
- `MINOR_NET_BROKEN`, `MINOR_NET_RESUME`
- `MINOR_AC_OFF`, `MINOR_AC_RESUME`
- `MINOR_LOW_BATTERY`, `MINOR_BATTERY_RESUME`

### Alarm
- `MINOR_ALARMIN_*` — alarm input
- `MINOR_FIRE_*` — fire event
- `MINOR_EMERGENCY_*` — panik buton
- `MINOR_HOST_DESMANTLE_*` — tampering

### Access Control Specific
- Tüm `MINOR_*` kodları [c.1 Access Control Event Types](./c.1-access-control-event-types.md) ile aynı

---

## Pratik Notlar

### Bu Tabloyu Ne Zaman Kullanacağız?
- Hikvision'ın **iVMS-4200** veya **HikCentral** ile entegrasyon yaparken cihazdan log indirme
- HCNetSDK kullanan bridge process'in **debug audit** logları için
- ngsaccess'in **kendi audit log'una** karıştırmayın — ngsaccess'in audit log'u Convex tarafında, tamamen ayrı bir sistem

### ngsaccess Audit Log Tasarımı
```typescript
// convex/schema.ts (önerilen audit log)
auditLogs: defineTable({
  type: v.union(
    v.literal("device_action"),    // remote door open, sync etc.
    v.literal("user_login"),
    v.literal("config_change"),
    v.literal("card_assignment"),
  ),
  userId: v.optional(v.id("users")),
  deviceId: v.optional(v.id("devices")),
  details: v.any(),
  timestamp: v.number(),
}).index("by_time", ["timestamp"]);
```

---

## Detaylı Liste

c.4 bölümünde ~30 sayfa boyunca **tüm `MINOR_*` log tipleri** listelenmiştir. Çoğu zaten:
- [c.1-access-control-event-types.md](./c.1-access-control-event-types.md) — Major 0x1, 0x2, 0x3, 0x5
- [c.2-event-linkage-types.md](./c.2-event-linkage-types.md) — Event linkage tipleri

ile örtüşür. Bu yüzden **buraya tekrar yazmıyoruz** — gerekirse PDF s.437-471 referans alın.

---

## İlgili Belgeler
- [docs/sdk/appendix-c/c.1-access-control-event-types.md](./c.1-access-control-event-types.md) — Event types tam liste
- [docs/sdk/appendix-c/c.2-event-linkage-types.md](./c.2-event-linkage-types.md) — Linkage types
- [docs/sdk/appendix-c/c.3-sdk-errors.md](./c.3-sdk-errors.md) — Error codes

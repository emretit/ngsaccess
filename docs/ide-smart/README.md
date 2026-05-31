# IDE Smart — IoT Device Integration Reference

Bu klasör `IoT Device Integration Reference` dokümanının bölüm bazlı markdown sürümünü içerir.

**Kaynak**: `IoT Device Integration Reference.txt` (Revision 2.1 · May 2026)

## Bölümler

- [1. Communication Overview](01-communication-overview.md)
- [2. Status LED Reference](02-status-led-reference.md)
- [3. Authentication & Authorization](03-authentication-authorization.md)
- [4. Message Types Reference](04-message-types-reference.md)
- [5. CRUD Data Models & Validation](05-crud-data-models-validation.md)
- [6. Device Upstream Events](06-device-upstream-events.md)
- [7. OTA (Over-the-Air) Firmware Update](07-ota-firmware-update.md)
- [8. Bulk Repository Synchronization (sync / sync_reset)](08-bulk-repository-sync.md)
- [9. Access Control Logic](09-access-control-logic.md)
- [10. Full Parameter Reference](10-full-parameter-reference.md)
- [11. Boot Modes & Recovery](11-boot-modes-recovery.md)
- [12. Postman Collection](12-postman-collection.md)
- [13. PC Setup Application](13-pc-setup-application.md)
- [14. Firmware Release Notes](14-firmware-release-notes.md)
- [15. Confidentiality, Copyright & Contact](15-confidentiality-copyright-contact.md)

## ngsaccess Entegrasyon Dökümanları (proje-özel)

> Yukarıdaki 1–15 IDE Smart **firmware/protokol** referansıdır (vendor). Aşağıdakiler
> **ngsaccess'in uygulamasını** anlatır.

- [Kişi & Yetki Senkronizasyon Mimarisi](NGSACCESS_SYNC_ARCHITECTURE.md) — **otoriter**: mapping,
  tetikleyiciler, internalAction zorunluluğu, kuyruk, orphan akışları, deployment topolojisi, test planı
- [Session Devir Notu](SESSION_HANDOFF.md) — güncel durum + sonraki adımlar
- [Sorular & Uyumsuzluklar](IDESMART_SORULAR_VE_UYUMSUZLUKLAR.md) — firmware ↔ doküman çelişkileri
- Session günlükleri: [Token-auth & Reader (2026-05-31, EN GÜNCEL)](SESSION_2026-05-31_TOKEN_AUTH_VE_READER.md) ·
  [MQTT Entegrasyonu](SESSION_2026-05-29_MQTT_ENTEGRASYONU.md) ·
  [Event Entegrasyonu](SESSION_2026-05-29_EVENT_ENTEGRASYONU.md)

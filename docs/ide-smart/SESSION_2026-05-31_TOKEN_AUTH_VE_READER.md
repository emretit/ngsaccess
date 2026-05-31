# IDE Smart — Session Devir Notu (2026-05-31)

> Bu session'da kişi/yetki sync'i **uçtan uca canlı çalışır hale getirildi** (token-auth fix) ve
> kart-okutma sorununun kök nedeni bulundu. Tüm timestamp UTC+3. Otoriter mimari:
> [NGSACCESS_SYNC_ARCHITECTURE.md](NGSACCESS_SYNC_ARCHITECTURE.md). Bir önceki devir:
> [SESSION_HANDOFF.md](SESSION_HANDOFF.md).

---

## ⭐ TEK CÜMLE ÖZET

Kişi/yetki sync artık **çalışıyor ve canlı kanıtlandı** (İrem panele yazıldı: "permission created" +
"user created"). **Kart okutma canlı izlemeye düşmüyor** çünkü panelin **WIEGAND2 girişine okuyucudan
elektriksel sinyal gelmiyor** (`irq_edges:0`) — fiziksel kablo sorunu, yazılım DEĞİL.

---

## 1. BU SESSION'DA YAPILANLAR (hepsi deploy edildi + doğrulandı)

### A. Kişi/yetki sync 4 blocker + review fix'leri (kod)
- `authedAction → internalAction` (3 sync action + yeni `deleteIdeUserFromPanels`) — scheduler'dan
  artık `throw` etmiyor.
- permission-before-user sıralama; çok-kural `permissions[]` (capPermissionNos); orphan temizliği
  (remove/cardChanged/removeGroupMember, `convex/lib/accessGraph.ts`); bulkUpdateStatus sync; io-clamp uyarısı.
- Dosyalar: `convex/actions/ideGatewayDevice.ts`, `convex/ideSync.ts`, `convex/employees.ts`,
  `convex/accessRules.ts`, `convex/lib/accessGraph.ts`, `convex/ideSync.test.ts` (14 test).

### B. ⭐ Komut-auth (level-1 token) — login-over-MQTT  [BU SESSION'IN ANA İŞİ]
**Sorun:** panel `create_data`'ya `forbidden: requires level 1, you are 0` döndü. MQTT komutları
token'sız (level 0); kapı açma level 0 ama kişi/yetki **level 1 login token'ı** ister.
**Çözüm (canlı kanıtlandı):**
- Panel `login`'i **MQTT komut kanalından** kabul ediyor → `login_response` + `data.token`
  (token=`level.iat.exp.uuid.sig`, level 1, TTL 600s).
- **Bridge** (`scripts/ide-mqtt-bridge.mjs`): `loginOverMqtt` + `ensureToken` + `tokenCache` (uuid bazlı,
  30s marj) + `LEVEL1_OPS` set; level-1 op zarfına token ekler; auth-fail/TTL'de yeniden login.
- **Convex** (`convex/ideSync.ts` `listPendingForBridge`): level-1 op'lara `device.ideUser/idePassword`
  ekliyor (openDoor hariç).
- Detay: [NGSACCESS_SYNC_ARCHITECTURE.md](NGSACCESS_SYNC_ARCHITECTURE.md) §5.1.

**Deploy:** Convex → `npx convex dev --once` (notable-tern-4); bridge → `scp scripts/ide-mqtt-bridge.mjs
root@157.90.114.86:/opt/ngs-bridge/scripts/` + `systemctl restart ide-mqtt-bridge` (active).

**Canlı kanıt:** İrem (`employeeId k17de29e7c0v5sctevfxv48wbn864kxv`, kart 4240722371) sync →
`upsertPermission` acked **"permission created"** + `upsertUser` acked **"user created"**. Eski
token'sız op'lar "failed: forbidden ... level 1". → **auth blocker ÇÖZÜLDÜ.**

---

## 2. ⛔ AÇIK BLOKER (sonraki session ÖNCELİK): kart okutma düşmüyor

**Belirti:** Kullanıcı kart okutuyor ama canlı izleme ekranına / `cardReadings`'e düşmüyor (bugün hiç yeni
kayıt yok; en yeni 05-29).

**Kök neden (kesin, panelin kendi sayacıyla kanıtlandı):** Panelde `WIEGAND2.STATS.irq_edges = 0` →
okuyucudan panele **hiç elektriksel kenar/pulse gelmiyor**. Tüm `accept/raw/reject` sayaçları 0.
(Sinyal gelse format yanlış olsa bile irq_edges/reject_* artardı.)

**Kanıt zinciri:**
- Yazılım/bridge/Convex/UI: TEMİZ. İrem panelde, LOGGER `PROTOCOL=MQTT`+`AC_LOG_TOPIC=event/access/online` ✅,
  panel online (heartbeat akıyor). 05-29'da aynı path çalışıyordu (`accept_ok>0`).
- Broker `event/#` 25-30s dinlendi: swipe sırasında **sadece heartbeat**, hiç `access_event` yok.
- Kart 4240722371 = **34-bit → WIEGAND2** (ID 32-bit, `BIT_LENGTH:34`, `FORMAT_GUESS:W34-RAW`). WIEGAND0
  26-bit, bu kartı okuyamaz.
- Swipe sonrası `WIEGAND2.STATS.irq_edges=0` (sinyal yok). Cihaz **söküp takıldığı** için en olası: reader
  **D0/D1** hattı WIEGAND2 terminaline gevşek/yanlış porta takılı, ya da reader beslemesiz.

**Kullanıcı notu:** "fiziksel her şey okey, ayarlara dokunmadım" dedi — ama panelin `irq_edges:0` sayacı
sinyal gelmediğini gösteriyor. Sonraki session: reader LED/buzzer tepki veriyor mu + D0/D1 WIEGAND2'ye
bağlı mı tekrar kontrol ettir.

**Doğrulama testi (LAN'dan, reader düzelince):** swipe → `WIEGAND2.STATS.irq_edges > 0` olmalı; olunca
kart anında cardReadings'e + canlı izlemeye düşer (o taraf hazır). Test komutu §6'da.

---

## 3. Panel saati: DOĞRU + gün-numarası bulgusu

- Saat **birebir doğru**: `NTP.TIME=2026-05-31 11:53:41` = gerçek TR saati; `TIMEZONE=3` (UTC+3);
  `time.google.com`'dan NTP sync. Saatte sorun YOK.
- **Bulgu:** `NTP.DAY-WEEK` panelde **0=Pazartesi … 6=Pazar** (canlı: gerçek gün Pazar → panel `=6`).
  Bu session'da yanlışlıkla doc'u "0=Pazar" yapmıştım → geri alındı (doc 10:129).
- **⚠ Doğrulanacak (potansiyel bug):** permission `schedule.week_days` konvansiyonu. `convex/ideSync.ts`
  `daysToIdeWeekDays` **0=Pazar** kullanıyor (CRUD §5.2 doc'una göre). Ama NTP.DAY-WEEK 0=Pazartesi.
  İkisi farklı olabilir; **day-limitli kural** için ideSync mapping'i 1 gün kaymış olabilir. İrem all-days
  (`[0..6]`) olduğu için ETKİLENMİYOR. Day-limitli bir kuralla canlı test edilip netleşmeli.

---

## 4. AÇIK KOD-REVIEW BULGULARI (bridge — henüz DÜZELTİLMEDİ)

Bu session'da bridge token kodu code-review workflow + security-review skill ile incelendi. Gerçek bulgular:
1. **nextMsx() collision (CONFIRMED):** `nextMsx` sadece `pending`'i kontrol ediyor, `loginWaiters`'ı
   ETMİYOR → login msxId ile komut msxId çakışabilir → response yanlış waiter'a gider. Fix: `nextMsx`'e
   `&& !loginWaiters.has(candidate)` ekle. (Olasılık düşük — 2e9 rastgele uzay — ama gerçek.)
2. **Missing-creds sonsuz spin (CONFIRMED):** device'ta ideUser/idePassword yoksa `ensureToken` null
   döner, op pending kalır, her 2s yeniden denenir (tight loop). Fix: creds yoksa op'u markSent+ack-fail
   ile normal retry/backoff'a sok (veya skip+log). İrem panelinde creds var, bu yüzden mevcut akışı
   etkilemiyor.
3. **login_response explicit type check (PLAUSIBLE):** handler login_response'u sadece msxId-in-loginWaiters
   ile ayırt ediyor; `transaction.type==="login_response"` kontrolü yok. Topic-uuid guard'ı kısmen koruyor.
4. **GÜVENLİK — MEDIUM (security-review):** `loginOverMqtt` admin kimliğini + token'ı `device/subscribe/<uuid>`'e
   yazıyor; ACL'de tüm filo tek `device` user'ı paylaşıyor + `read device/subscribe/#` → başka panel
   kimliği/token'ı okuyabilir (lateral movement). Fix: per-panel MQTT user + `pattern read device/subscribe/%u`
   (ACL yorumunda zaten öneriliyor) + panel admin şifresini admin/admin'den değiştir. Bkz `infra/mqtt/config/acl`.

---

## 5. PRE-EXISTING FLAG (kapsam dışı, ayrı iş)

**Hikvision sync de aynı authedAction-scheduler bug'ına sahip** (`convex/actions/hikvisionSync.ts` sync
action'ları authedAction + scheduler-tetikli → throw → Hikvision otomatik sync de kırık). internalAction'a
çevirmek gövdedeki `listProjectIdsForCurrentUser`+`isProjectAllowed` mantığını elden geçirmeyi gerektirir.

---

## 6. ERİŞİM & TANI KOMUTLARI

**Kimlikler:**
- Panel: device `_id=jn72ysjvw744wnf2mpyvkz819x87mcww`, `ideUuid=289833329732592`, IP `192.168.1.4:80`,
  4 çıkış (io 0-3). İrem: `k17de29e7c0v5sctevfxv48wbn864kxv`, kart `4240722371`, kural `j57073hh66p7a3rr5zvf8zczzs821f93`.
- **Deployment topolojisi:** `notable-tern-4` = "dev" deployment AMA canlı sistem orada. Güncelle:
  `npx convex dev --once`. `npx convex deploy` AYRI/alakasız prod'a gider — KULLANMA.
- L3 panel şifresi `.env.local`'da (`IDE_L3_USER`/`IDE_L3_PASS`, IDE Smart verdi). Admin: `IDE_USER`/`IDE_PASS` (admin/admin).
- SSH: `ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86` (bridge+broker; `SERVER_CREDENTIALS.md` pafta'da).
- Bridge: `/opt/ngs-bridge/scripts/ide-mqtt-bridge.mjs`, systemd `ide-mqtt-bridge`, broker docker `ngs-mqtt` (1883 loopback).

**Bu makine panelin LAN'ında (192.168.1.9)** → panele doğrudan HTTP atılabilir.

**Reader sinyal testi (LAN'dan, L3):** login → `parameter_read {module:"WIEGAND2"}` → `STATS.irq_edges`
swipe öncesi/sonrası karşılaştır (örnek komutlar bu session transcript'inde).

**Sync tetikle:** `npx convex run actions/ideGatewayDevice:syncEmployeeToIdePanels '{"employeeId":"k17de29e7c0v5sctevfxv48wbn864kxv"}'`
→ `{queued:2}`; durum: `npx convex data idePendingOperations` (acked/failed).

**Canlı broker izle:** `ssh ... 'PW=$(grep MQTT_BRIDGE_PW /etc/ide-mqtt-bridge.env|cut -d= -f2-); docker exec ngs-mqtt mosquitto_sub -h 127.0.0.1 -u bridge -P "$PW" -t "event/#" -v'`

**Bridge log:** `ssh ... 'journalctl -u ide-mqtt-bridge -f'`

---

## 7. SONRAKİ SESSION — ÖNERİLEN SIRA

1. **Reader fiziksel:** WIEGAND2 D0/D1 kablosunu kontrol ettir → `irq_edges>0` olunca kart okuması
   uçtan uca düşmeli (test §2/§6). **Asıl bloker bu.**
2. Reader düzelince: kart okut → cardReadings "izin_verildi" (İrem panelde) + canlı izleme ekranı.
3. Bridge code-review fix'leri (§4: nextMsx collision, missing-creds spin, type check) — küçük, düşük risk.
4. Güvenlik: per-panel MQTT ACL hardening (§4.4).
5. permission week_days konvansiyonu doğrula (§3) — day-limitli kural ile.
6. (Ayrı) Hikvision authedAction bug'ı (§5).
7. Henüz commit yapılmadı — kullanıcı isteyince commit/push.

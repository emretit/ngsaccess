# IDE Smart Panel Entegrasyonu — Session Devir Notu

> Bu dosya, IDE Smart panel entegrasyonu çalışmasının mevcut durumunu yeni bir chat'e
> aktarmak için yazıldı. Tarih: 2026-05-29. Tüm timestamp'ler UTC+3 (Türkiye).

---

## ⭐ GÜNCEL DURUM (2026-05-29 akşamı — MQTT + kişi/yetki sync)

> Bu notun **alt kısmı (HTTP fazı) ESKİMİŞTİR**. O zamanki "event hedefi engeli" **MQTT'ye
> geçilerek çözüldü** ve kişi/yetki sync tamamlandı. Otoriter, güncel mimari:
> **[NGSACCESS_SYNC_ARCHITECTURE.md](NGSACCESS_SYNC_ARCHITECTURE.md)**.

**Tamamlanan & kanıtlanan:**
- MQTT mimarisi (broker + Hetzner bridge + `idePendingOperations` kuyruğu) — kapı açma ✅ + kart
  okutma ✅ canlı kanıtlandı.
- **Kişi & yetki sync kodu** (`syncEmployeeToIdePanels`, `syncPermissionToIdePanels`,
  `deleteIdeUserFromPanels`) — yeniden yazıldı, `notable-tern-4`'e deploy edildi.
- **Katman-1 (kuyruk) testi KANITLANDI** (İrem Peker): `queued=2`, `upsertPermission` →
  `upsertUser` sırası, payload'lar (`io:[0,1,2,3]`, `permissions:[1]`, `status:1`) doğru.
- 4 blocker düzeltildi: (1) permission record artık user'dan ÖNCE yazılıyor, (2) çok-kural
  `permissions[]` korunuyor, (3) silme/kart-değişiminde orphan temizleniyor, (4) sync action'ları
  **internalAction** (authedAction scheduler'dan `throw` ediyordu → otomatik sync hiç çalışmıyordu).

**Bekleyen:**
- **Katman-2 (canlı panel):** cihaz şu an **geçici offline**; dönünce `get_data` ile panelde
  user/permission teyidi + fiziksel kart okutma (izin_verildi/reddedildi) + UI silme. Adımlar
  mimari dökümanı §10'da.
- **Hikvision aynı buga sahip:** sync action'ları authedAction + scheduler-tetikli → onlar da
  `throw` ediyor (Hikvision otomatik sync de kırık). Ayrı iş — mimari §5.
- **Reconcile cron** (orphan temizliği) — mimari §8.
- **Açık sorular:** `create_data` idempotensi (dolu panelde doğrulanmadı), 64-bit/QR kart no taşma
  riski — mimari §11.

---

## Amaç

`docs/ide-smart/` (15 bölüm) altındaki IoT Device Integration Reference'a uygun, yeni bir cihaz
ailesi entegre etmek: **IDE Smart IoT erişim paneli** (HTTP/JSON envelope, login→token auth).
Mevcut Hikvision + ESP32 entegrasyonunun yanına ekleniyor.

**Kullanıcı kararları (onaylı):**
- Transport: önce HTTP (event + komut), sonra MQTT (Faz 2).
- Kapsam: tam çift yön — event alma + kapı açma + kullanıcı/permission sync.
- Model: **Panel = 1 bölge (zone)**, panel kaç kapılıysa o kadar **kapı (door)** o bölgenin
  altında otomatik üretilir. Her door bir `ioId` (0..N-1) taşır. `ZoneDoorTree`'de
  "Panel adı → Giriş/Çıkış/..." şeklinde görünür.
- Okuyucu↔kapı: **1 okuyucu → 1 kapı** (4 bağımsız geçiş). 4 io_id = 4 kapı.

## GERÇEK PANEL — Doğrulanmış Bilgiler (canlı test edildi)

| Bilgi | Değer |
| :-- | :-- |
| Panel IP | `192.168.1.4` (hostname `ide-dc300-2592.home`) |
| HTTP port | `80` (açık), TCP `6090` (açık) |
| UUID | `289833329732592` |
| Cihaz adı | "4 Output DC" → **4 çıkış/kapı** |
| Login | user `admin` (Level 1) — fabrika default şifresiyle → token alınıyor ✓ |
| AC.MAX_PERMS_PER_USER | 16 |
| WIEGAND0 okuyucu | ENABLED=1, W26 (26-bit), parity W26, ID start bit 8, ID 16-bit, FC kabul -1 |
| Senin makinen (test) | `192.168.1.245` |

### Canlı test sonuçları
- **login** → `{result:"success", data:{token:"1.<iat>.<exp>.289833329732592.<sig>"}}` ✓
- **parameter_read** (module/parameters) → çalışıyor ✓
- **update_actuator `{io_id:0, keep:1}`** → `"Actuator latched"` ✓ (röle açıldı)
- **update_actuator `{io_id:0, keep:0}`** → `"Actuator released"` ✓
- **update_actuator `{io_id:0, value:1}`** (pulse) → `"Something went wrong"` FAIL
  (pulse modu `user_id` ister + panelde kayıtlı kullanıcı yok)
- **get_data user page** → boş liste (panelde 0 kullanıcı) ✓

### KRİTİK FİRMWARE KURALLARI (dokümanda net değil, testle bulundu)
1. **`dst-id` ZORUNLU** (login hariç). Verilmezse panel isteği **sessizce yok sayar, `null` döner**.
2. **`dst-id` NUMBER olmalı.** Sayısal string (`"289833..."`) gönderince yine `null` döner;
   number (`289833...`) gönderince çalışır. Kodda `normalizeDstId` ile çözüldü.
3. **Yetki sınırı:** `admin` = Level 1. Yazma için:
   - `HTTPCLIENT.HOST` yazma → **level 99** (dışarıdan yazılamaz, internal/factory).
   - `LOGGER.AC_LOG_PATH` yazma → **level 2**.
   - `LOGGER.*` okuma → level 3.
   - Yani **panel event hedefini admin ile DEĞİŞTİREMİYORUZ.** (doc'taki "USER2-USER5 için IDE
     Smart ile iletişime geçin" notu geçerli — yüksek-level şifreler IDE Smart'tan alınır.)
4. Panelin şu anki event hedefi: **`HTTPCLIENT.HOST=192.168.1.147 : PORT=8080`** (kim olduğu
   bilinmiyor; doğrulanmadı — kullanıcı son soruya cevap vermeden chat değiştirdi).
5. `SYSTEM.PID` bu modelde yok ("Unknown parameter on module") — atlanıyor.

## ŞU ANKİ ENGEL (devam buradan)

**Event akışını (kart okutunca panel → bize) test edemiyoruz** çünkü:
- Convex cloud panelin LAN IP'sine (192.168.1.4) ulaşamaz → event'i Convex'e yönlendirmek için
  panelin `HTTPCLIENT.HOST`'unu bir bridge'e/yakalayıcıya çevirmek gerek.
- Ama `HTTPCLIENT.HOST` yazma level 99 istiyor → admin ile değiştirilemiyor.

**Açık karar (kullanıcıya soruldu, cevap bekleniyor):** event hedefini nasıl yakalayacağız?
- Seçenek A: `192.168.1.147`'yi (panelin mevcut hedefi) dinle — o makine kimin? (belirsiz)
- Seçenek B: IDE Smart'tan (ismail.tural@idesmart.com) yüksek-level şifre (USER2/4/5) al.
- Seçenek C: IDE Smart PC Setup app (docs §13) ile event hedefini elle 192.168.1.245'e çevir.

**Sonraki adım:** Kullanıcı event hedefini çözünce → `scripts/ide-smart-capture.mjs`'i çalıştır,
okuyucuya kart okut, ham event'i gör (alan adları, io_id var mı, format ne). Ardından
`cardReaderParse.ts` IDE dalını gerçek event şekline göre kalibre et.

## NE YAZILDI — Kod (hepsi deploy edildi: `dev:notable-tern-4`)

### Backend (Convex)
- `convex/schema.ts`: `devices.brand` union'a `ide_smart`; IDE alanları (`ideUuid`, `ideUser`,
  `idePassword`, `ideHttpPort`, `ideDoorCount`) + `by_ide_uuid` index. `zones.ideDeviceId` +
  `by_ide_device` index. `doors.ioId`. (hikPendingOperations'a IDE op literal'leri eklenmişti,
  code-review sonrası **geri çıkarıldı** — Faz 1 anlık çalışıyor, kuyruk kullanmıyor.)
- `convex/lib/ideSmart.ts` *(YENİ)*: protokol client. `login`, `call` (dst-id token'dan otomatik),
  `updateActuator`, `upsertUser/Permission`, `deleteData`, `parameterRead/Write`, `triggerSync`,
  `uuidFromToken`, `normalizeDstId`. §5 validasyonları. `IdeTokenError`/`IdeCommandError`.
  TOKEN_ERROR_RE = `/token expired|not bound|tamper detected/i` ("level" over-match için çıkarıldı).
- `convex/actions/ideGatewayDevice.ts` *(YENİ)*: `registerIdePanel` (login + SYSTEM.UUID oku +
  forwarding parameter_write — ama HTTPCLIENT yazma level 99 yüzünden gerçek panelde çalışmaz) ve
  `openIdeDoor` (door→ioId, default **keep:1 admin latch**, panel-zone yetki kontrolü
  `getPanelZoneIds` ile). `loadIdePanel` = yetki + brand + bağlantı bilgisi doğrular.
- `convex/devices.ts`: CRUD'a IDE alanları. `createIdePanel` (authedMutation — bölge + cihaz +
  N kapı atomik üretir, io 0="Giriş" 1="Çıkış" sonrası "Kapı N"). `getByIdeUuid`,
  `getPanelDoorByIo`, `getPanelZoneIds`, `setIdeUuid`, `markIdeOnline`. `remove`'da IDE panel
  cascade (zone+door temizler). `updateLastSeen`'e ideUuid lookup.
- `convex/zones.ts`: `create`'e `ideDeviceId`; `remove`'da IDE panel zone'u silme kilidi.
- `convex/doors.ts`: `create`/`update`'e `ioId`; `remove`'da IDE panel kapısı silme kilidi;
  `getByIdInternal`.
- `convex/http.ts`: `/card-reader` parsed'a `ideIoId`/`ideUuid`; processCardReading'e geçiriliyor;
  cross-tenant guard'a ideUuid; updateLastSeen'e ideUuid.
- `convex/cardReadings.ts`: `processCardReading` args'a `ideUuid`/`ideIoId`; device lookup'a
  `by_ide_uuid`; `resolveDirection`'a IDE io_id branch (io 0→entry, 1→exit, sonrası toggle).
- `convex/lib/cardReaderParse.ts`: IDE event dalı (`user_id`+`io_id`+uuid tanır). **DİKKAT:** bu dal
  varsayıma dayalı yazıldı; **gerçek event şekli henüz görülmedi** — capture ile doğrulanıp
  kalibre edilmeli.
- `convex/lib/cardReaderParse.test.ts`: 2 IDE test case eklendi (26 test geçiyor).
- `convex/hikvisionSync.ts`, `convex/lib/hikSync.ts`: inline `brand` tiplerine `ide_smart` eklendi.

### Frontend (`src/`)
- `components/devices/hooks/useDeviceFormSchema.ts`: `DEVICE_BRANDS`+`ide_smart`, BRAND_LABELS,
  IDE form alanları, `device_serial` IDE'de opsiyonel (superRefine).
- `components/devices/BrandPickerStep.tsx`: "IDE Smart Panel" kartı (LayoutGrid, emerald).
- `components/devices/form-sections/DeviceIdeSmartSection.tsx` *(YENİ)*, `DeviceNameSection.tsx` *(YENİ)*.
- `components/devices/DeviceForm.tsx`: IDE Smart dalı (ad + IDE section + status; zone/door/serial gizli).
- `components/devices/hooks/useDeviceFormSubmission.ts`: IDE create → `createIdePanel` +
  `registerIdePanel`; update'e ideFields.
- `components/access-control/ZoneDoorTree.tsx`: panel bölgesi CPU ikonu, manuel ekle/sil gizli,
  her kapıda "Kapıyı Aç" (`openIdeDoor`).
- `types/device.ts`: IDE alanları.
- `components/sync/SyncIssuesBanner.tsx`: değişiklik geri alındı (IDE op literal'leri çıkınca).

### Test/diagnostic script'leri (`scripts/`)
- `ide-smart-probe.mjs`: panele login + parameter_read + (opsiyonel) kapı açma. Şifre maskeli loglar.
  Kullanım: `IDE_IP=192.168.1.4 IDE_PASS=admin [IDE_OPEN_IO=0] node scripts/ide-smart-probe.mjs`
- `ide-smart-capture.mjs` *(YENİ)*: senin makinende event yakalayıcı HTTP server (0.0.0.0:8090).
  Kullanım: `node scripts/ide-smart-capture.mjs` — panel event'leri ham görünür.
- `ide-smart-point-here.mjs` *(YENİ)*: panel event hedefini bir host:port'a çevirmeyi dener.
  **NOT: admin level 1 ile HTTPCLIENT/LOGGER yazma reddediliyor (level 99/2) — şu an işe yaramaz.**

## Convex deploy notu

`npx convex codegen` SADECE tip üretir, fonksiyonları YÜKLEMEZ. UI'dan
"Could not find public function" hatası alınırsa → **`npx convex dev --once`** çalıştır
(fonksiyonları `dev:notable-tern-4`'e push eder). En son bu yapıldı, fonksiyonlar deployed.

## Doğrulama durumu
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata (sadece pre-existing
  `src/integrations/supabase/` hataları var, bizimle ilgisiz — @supabase paketi kurulu değil).
- `node_modules/.bin/eslint src convex` → 0 error, 0 warning, no-explicit-any 0.
- `vitest run convex/lib/cardReaderParse.test.ts` → 26 test geçiyor.
- code-review + security-review yapıldı: raporlanacak yeni güvenlik açığı yok; dead-code
  (kullanılmayan IDE op literal'leri) temizlendi.

## Açık işler / sonraki adımlar
1. **(ENGEL) Event hedefini çöz** — yukarıdaki A/B/C seçeneklerinden biri. Kullanıcı 147'nin kim
   olduğunu netleştirmeli veya IDE Smart'tan yüksek-level şifre almalı.
2. Event hedefi çözülünce → `ide-smart-capture.mjs` ile kart okut, **ham event şeklini gör**.
3. `cardReaderParse.ts` IDE dalını gerçek şekle göre kalibre et + test güncelle.
4. Event → cardReadings → UI (CardReadings tablosu) uçtan uca doğrula.
5. UI'dan panel ekleme akışını test et (createIdePanel → bölge+4 kapı ağaçta görünmeli).
   ⚠️ `openIdeDoor` Convex cloud'dan çalışır; panel LAN-only olduğu için cloud→panel
   bağlanamayabilir (timeout). Komut yolu için de LAN bridge / port-forward gerekebilir (Faz 2).
6. Kullanıcı/permission sync (create_data) tetikleyicileri — çalışan gruba eklenince panele yaz.
7. **(Faz 2)** MQTT + offline retry kuyruğu + LAN bridge üzerinden komut.

## Bağlantı / referans
- IDE Smart destek: ismail.tural@idesmart.com (yüksek-level şifre için)
- Plan dosyası: `~/.claude/plans/docs-ide-smart-alt-nda-15-b-l-m-robust-church.md`
- Hetzner card-reader bridge runbook: `docs/HETZNER_CARD_READER_BRIDGE.md`

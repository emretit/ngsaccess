# Handoff — Kapı ↔ Okuyucu Ayrıştırması + Hikvision Model-Tabanlı Provizyon

**Tarih:** 2026-06-20 · **Deployment:** notable-tern-4 (DEV ama canlı) — `npx convex dev --once`

## 1. Amaç / Bağlam

Önceden **okuyucu kapıyla 1:1** modelleniyordu (`doors.readerName` + `doors.readerDirection`),
ve Hikvision cihazı eklerken **kapı sayısı elle** giriliyordu, kapı kayıtları otomatik
oluşmuyordu. Yeni model:

- Hikvision cihazı eklerken **önce model seçilir** (DS-K2804, DS-K1T807, DS-K1T343, "Diğer/manuel").
- Modelden **kapı + okuyucu sayısı otomatik türetilir**; kapılar + okuyucular otomatik üretilir.
- **Bir kapı 1..2 okuyucuya** (giriş + çıkış) sahip olabilir → ayrı `readers` tablosu.
- Model seçimi **cihaz adından hemen sonra** gelir (topolojiyi belirlediği için ilk adım).

**Onaylanan katalog:** DS-K2804 = 4 kapı / 4 okuyucu (kapı başına **1**, yetenek 2);
DS-K1T807 & DS-K1T343 = 1 kapı / 1 okuyucu (terminalin kendisi okuyucu).

## 2. Mimari kararlar

- **`readers` ayrı tablo** (kapı↔okuyucu N:1). Eski `doors.readerName/readerDirection` alanları
  **legacy fallback** olarak korundu (silinmedi) — additive değişiklik.
- **İzin modeli kapı-bazlı kalır.** Okuyucular ngsplus tarafında bir gösterim/yön kavramı;
  panele gönderilmez (Hik event'i okuyucu no taşımaz → `hikReaderNo` şimdilik yalnız görsel).
- Hik'te bir kapının giriş/çıkış okuyucu satırları **aynı son-okumayı paylaşır**.
- Kapı **en az 1 okuyucu** tutar (son okuyucu silinemez, sunucu reddeder).
- Edit modunda model değişimi kapıları **yeniden üretmez** (sadece hikModel/hikDoorCount günceller).

## 3. Değişen/eklenen dosyalar

### Backend (Convex)
| Dosya | Değişiklik |
|---|---|
| `convex/lib/hikModels.ts` (yeni) | Model kataloğu: `HIK_MODELS`, `MANUAL_MODEL_ID`, `getHikModelSpec`, `resolveHikModelSpec`. Bağımlılıksız → hem src hem convex import eder. |
| `convex/schema.ts` | `readers` tablosu (by_door/by_device/by_project/by_zone). |
| `convex/readers.ts` (yeni) | `list`/`create`/`update`/`remove` (RBAC + kapı başına max + son-okuyucu koruması) + `backfillReadersFromDoors` (internalMutation) + `deleteReadersForDoor` (cascade helper). |
| `convex/devices.ts` | `createHikDevice` mutation; `provisionHikDoorsAndReaders` + `resolveOrCreateZone` + `insertReaderRow` helper'ları; `provisionPanelZoneAndDoors` artık IDE kapılarına da okuyucu üretir; `purgeDeviceCascade` okuyucuları siler; `update` bölge-taşımada reader zoneId senkronlar. |
| `convex/doors.ts` | `create` varsayılan 1 okuyucu üretir; `remove` reader cascade; `readerStatus` **okuyucu-merkezli** (kapı başına N satır, `readerId` + legacy fallback). |

### Frontend (React)
| Dosya | Değişiklik |
|---|---|
| `src/components/devices/form-sections/DeviceHikModelField.tsx` (yeni) | Model `<Select>` + özet + manuel kapı sayısı inputu. **Cihaz adından sonra** render edilir. |
| `DeviceBasicSection.tsx` | Ad alanından sonra `{brand === "hikvision" && <DeviceHikModelField />}`. |
| `DeviceHikvisionSection.tsx` | Model bloğu kaldırıldı (artık DeviceBasicSection'da). Transport + bağlantı kaldı. |
| `DeviceHikLocalBridgeSection.tsx` | "Kapı Sayısı" inputu kaldırıldı (model belirler). |
| `DeviceLocationSection.tsx` | Hik'te generic `door_count` select gizli. |
| `useDeviceFormSchema.ts` | `hik_model` alanı + superRefine (yeni Hik cihazda model zorunlu; manuelde kapı sayısı zorunlu). `makeFormSchema(adminMode, isEdit)`. |
| `useDeviceFormSubmission.ts` | Yeni Hik dalı → `createHikDevice` + gateway registration; edit'te `hikModel` persist. |
| `buildDeviceFormValues.ts` | `hik_model` yükleme (kullanıcının refaktörü). |
| `ZoneDoorTree.tsx` | Çoklu okuyucu render + "+ Okuyucu" / sil; `editReader` state'inde `readerId`. |
| `EditReaderDialog.tsx` | `readerId` varsa `readers.update`, yoksa legacy `doors.update`. |
| `AddReaderDialog.tsx` (yeni) | `readers.create`. |

> **Commit durumu:** Ana iş commit `12ce665`'te. **Uncommitted (working tree):**
> `convex/devices.ts` (createHikDevice `status` arg + `readersPerDoor` clamp),
> `DeviceBasicSection.tsx` + `DeviceHikvisionSection.tsx` + `DeviceHikModelField.tsx`
> (model alanının cihaz adından sonraya taşınması). Bunlar henüz commit edilmedi.

## 4. Yeni backend API yüzeyi

- `api.devices.createHikDevice` — cihaz + kapılar (hikDoorNo 1..N) + okuyucular tek mutation'da.
- `api.readers.list / create / update / remove` — RBAC `doors.ts` desenini birebir taşır.
- `internal.readers.backfillReadersFromDoors` — legacy kapılar için tek okuyucu üretir (idempotent).
- `api.doors.readerStatus` — **dönüş şekli değişti**: artık okuyucu başına bir satır
  (`{ readerId: Id<"readers"> | null, doorId, readerName, readerDirection, lastReadAt, ... }`).
  Tek tüketici: `ZoneDoorTree.tsx` (güncellendi).

## 5. Rollout durumu

- ✅ Şema + fonksiyonlar **deploy edildi** (`npx convex dev --once`, notable-tern-4).
- ✅ **Backfill çalıştırıldı:** 11 kapı → 11 okuyucu. Tekrar çalıştırınca `created: 0` (idempotent doğrulandı).
- ✅ **tsc** (`tsconfig.app.json`) 0 hata · **eslint** (`src convex`) 0 hata, `no-explicit-any` 0.
- ✅ **code-review** (3 bulgu düzeltildi) + **security-review** (bulgu yok) tamamlandı.

## 6. ⚠️ Kalan iş / doğrulanmamış

- **Manuel UI doğrulaması yapılmadı** (preview tarayıcısı dev server'a ulaşamadı + auth gerekli).
  Kendi oturumunda doğrulanması gereken akış:
  1. Cihaz ekle → Hikvision → **cihaz adından sonra** "Cihaz Modeli" görünmeli.
  2. **DS-K2804** seç → özet "4 kapı · 4 okuyucu"; transport otomatik **localBridge**; kapı sayısı inputu yok.
  3. Kaydet → ZoneDoorTree'de cihaz altında **4 kapı**, her kapıda **1 okuyucu (Giriş)**.
  4. Bir kapıya **"+ Okuyucu"** → çıkış okuyucusu eklenir; 2'de buton kaybolur.
  5. **DS-K1T807** → 1 kapı / 1 okuyucu; "+ Okuyucu" yok.
  6. "Diğer (manuel)" → kapı sayısı inputu görünür; girilen sayı kadar kapı + 1'er okuyucu.
  7. **Düzenle** sayfasında da model alanı cihaz adından sonra görünmeli.

## 7. Bilinen edge-case / notlar

- **Edit + model değiştirme:** model seçimi `hik_door_count`'u modelin kapı sayısına **sabitler**
  (boşaltmaz) → localBridge edit'inde hikDoorCount varsayılana (4) düşmez. Ama edit'te model
  değiştirmek kapıları yeniden üretmez; yalnız metadata günceller (kasıtlı).
- **`createHikDevice.readersPerDoor`** modelin `maxReadersPerDoor`'una clamp'lenir (UI 1 gönderir;
  doğrudan API çağrısı abuse edemez). `status` form değerinden geçer.
- **Convex transaction'ları serializable** → `readers.create` kapı-başı-max kontrolü race-safe
  (eşzamanlı yazımlar OCC ile çakışıp retry olur).
- `convex codegen`/`dev --once` deployment'a push yapar (notable-tern-4 canlı) — dikkat.

## 8. Olası sonraki adımlar

- Gerçek panelle (DS-K2804 localBridge) uçtan uca doğrulama: cihaz ekle → roster → SDK → kart okut.
- Hik event'ine kapı/okuyucu no eklenirse `readerStatus`'ta gerçek per-okuyucu son-okuma atfı yapılabilir
  (şu an entry/exit aynı veriyi paylaşır).
- IDE Smart panellerinde de çoklu-okuyucu UI'ı (şu an max 1).

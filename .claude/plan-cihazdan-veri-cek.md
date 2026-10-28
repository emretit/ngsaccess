# Plan — "Cihazdan verileri çek" (Hik gateway cihazı → ngsplus kişi + geçmiş kayıt)

2026-10-28 · ilk hedef ANKA (`jn72xktd0hvnnjt2ff5f49nvk18h48qn`, DS-K1T804AMF, ISUP `ANKA001`)

## Checklist

### Faz 0 — Ön koşul
- [x] Kayıt sonrası otomatik kişi silme koddan kaldırıldı (çalışma dizininde, commit yok)
- [x] 0.1 Silme kaldırma: fa847eb3 commit + Convex CANLI 2026-10-28 16:49 (push yok)
- [x] 0.2 Saat dilimi denendi → GERİ ALINDI: cihaz dilimi değişince eski olayların saati kayıyor. Aktarımdan ÖNCE dilime dokunma (bkz. Saat kuralı)

### Faz 1 — Önizleme (yalnız okur)
- [ ] 1.1 `previewDeviceImport` action: cihaz kişileri + kartları + parmak izi sayısı + ngsplus eşleşmesi
- [ ] 1.2 Testler (gateway mock)

### Faz 2 — Kişi aktarımı
- [ ] 2.1 `importDevicePersons`: seçilen satırlar → `employees` (kart no = cihaz kişi no)
- [ ] 2.2 Parmak izi şablonu → FP-Central (`employeeFingerprints`, şifreli) + biyometrik rıza kaydı (K1 ✅)
- [ ] 2.3 "<Cihaz> mevcut kişiler" erişim kuralı (7/24, cihazın tüm kapıları) + üyelik
- [ ] 2.4 Kartsız kişi bayrağı: eşitleme cihaza kart yazmaz
- [ ] 2.5 Testler

### Faz 3 — Geçmiş kayıtlar
- [ ] 3.1 Backfill: `cardNo` boşsa `employeeNoString` kimlik olsun (parmak izi/yüz olayları)
- [ ] 3.1b Saat kuralı: cihaz olay saatinin yerel kısmı alınır, cihazın offset etiketi yok sayılır, TR (+03:00) uygulanır (canlı köprü `EVENT_TIME_OFFSET` ile aynı)
- [ ] 3.2 Tarih aralığı + "Tümü" seçeneği (bugün yalnız son 24 sa)
- [ ] 3.3 Testler

### Faz 4 — Arayüz (Cihaz → İşlemler sekmesi)
- [ ] 4.1 "Cihazdan verileri çek" kartı: Önizle → seçimli tablo → Seçilenleri aktar → sonuç
- [ ] 4.2 "Geçmiş kayıtları çek": tarih aralığı + sonuç (taranan / eklenen / atlanan)
- [ ] 4.3 Testler

### Faz 5 — Kapı, yayın, ANKA canlı
- [ ] 5.1 Kapılar + çapraz denetim (yazan Codex → Claude denetler)
- [ ] 5.2 Commit + Convex + web yayını (Emre onayı)
- [ ] 5.3 ANKA: 4 kişiyi aktar → kayıtları çek → Kişiler + Geçiş Kayıtları kontrolü; cihazda hâlâ 4 kişi + parmak izi geçişi çalışıyor

---

## Kararlar (önerilen varsayılan — Emre onaylar)

| # | Konu | Önerim | Alternatif |
|---|---|---|---|
| K1 | Parmak izi şablonu | ✅ KARAR (Emre 2026-10-28): NGS gibi — FP-Central'a aktar (`employeeFingerprints`, AES-256-GCM); her aktarımda aynı | — |
| K2 | Aktarılan kişinin kapı yetkisi | ✅ Otomatik "ANKA mevcut kişiler" kuralı (7/24) | Yetkisiz aktar (kişi cihazda kalır ama ngsplus'ta "yetkisiz" görünür) |
| K3 | Kartsız (yalnız parmak izi) kişi | ✅ Kart no alanına cihaz kişi no (`1`…`4`) + kartsız bayrağı → cihaza kart yazılmaz | Kart "1" de cihaza yazılsın (anlamsız kart, hata gürültüsü) |
| K4 | Kartı olup kart no ≠ kişi no olan kişi | ✅ Aktarılmaz, önizlemede "elle eşleştir" olarak görünür | Kart no'yu esas al (cihazdaki kişi no ile bağ kopar) |
| K5 | Aynı kart no başka projede var | ✅ Satır "çakışma", aktarılmaz | — |
| K1.1 | Biyometrik rıza | ✅ Aktarım ekranında onay kutusu ("Seçilen kişilerin parmak izi açık rızası alınmıştır") → işaretleyen kullanıcı adına `employeeConsents` `biometric_fingerprint` (grantedBy, notes "Cihazdan aktarım: <cihaz>"); işaretsizse şablon aktarılmaz | — |

Kararların hepsi Emre onaylı (2026-10-28 "önerinden devam").

## Cihazdan okunan gerçekler (ANKA, 2026-10-28 salt okuma)

- Kişiler: 4 (`1` Okan ISMAN, `2` Cinar ZONGUR, `3` Bengu AYDIN, `4` Mustafa Bingeloglu), hepsi `normal`.
- Kart: 0 (`CardInfo/Count` = 0). Hepsi parmak iziyle geçiyor.
- Parmak izi: `FingerPrint/Count` → notSupport; `POST /ISAPI/AccessControl/FingerPrintUpload` çalışıyor
  (kişi 1: 1 parmak, `fingerPrintID` 6, şablon ~684 karakter base64). Sayım bu uçtan yapılır, şablon atılır.
- Olay: 605 toplam (`AcsEventTotalNum`); major 5 → 537; parmak izi eşleşti (minor 38 / 0x26) → 174.
  Parmak izi olaylarında `cardNo` boş, kişi `employeeNoString`'de.
- Saat: `localTime 2026-10-28T15:29+08:00`, `timeMode manual` → saat doğru ama dilim +08:00.
  Düzeltilmezse backfill olayları 5 saat kayar (`toUtcISO`, [trDate.ts:30](../convex/lib/trDate.ts)).
- **Saat kuralı (2026-10-28 16:42 denendi, geri alındı):** cihaz olayı UTC saklıyor ve gösterirken GÜNCEL dilimi uyguluyor.
  Dilim +08→+03 yapılınca eski olay `15:37+08:00` → `10:37+08:00` oldu (etiket de güncellenmedi). Eski olayların duvar saati
  (15:37) doğru TR saati çünkü cihaz saati TR'ye göre kurulmuştu. → Aktarım yerel kısmı TR kabul eder; dilim düzeltmesi
  (istenirse) aktarımdan SONRA yapılır.
- `setDeviceTime` JSON gövdesi bu cihazda `badParameters` (K1T804AMF yalnız XML'de `timeZone` kabul ediyor) → günlük
  `syncHikDeviceTimes` ANKA'da başarısız. XML yedeği ayrı küçük iş; dilimi değiştireceği için aktarım sonrasına.

## Koddan dayanaklar

- ngsplus kişiyi cihaza `employeeNo = employee.cardNumber` ile yazar ve aynı numarayla kart ekler
  ([hikSyncEmployee.ts:275-294](../convex/lib/hikSyncEmployee.ts)). → K3 bayrağı `addCardToDevice`'ı atlatmalı.
- Kuralı olmayan ve daha önce cihaza gönderilmemiş kişi için eşitleme hiçbir şey yapmaz
  ([hikSyncEmployee.ts:118](../convex/lib/hikSyncEmployee.ts) — yalnız `previousDevices` varsa siler). K2-alternatifi güvenli.
- Pasif yapılan kişi cihazlardan silinir ([hikSyncEmployee.ts:126](../convex/lib/hikSyncEmployee.ts)) — aktarım sonrası beklenen davranış.
- Backfill satırı: `cardNo` boşsa kart okuması açılmıyor, yalnız `deviceEvents`'e düşüyor
  ([cardReadings.ts:791-796](../convex/cardReadings.ts)); kişi eşleşmesi `findDeviceCardEmployee(cardNo)`.
- Backfill sınırı: 50 sayfa × 30 = 1500 olay/çalışma, 10 devam → 15 000 ([gatewayBackfill.ts](../convex/lib/gatewayBackfill.ts)). ANKA tek çalışmada biter.
- Eski olaylar alarm e-postası atmaz (`isFreshAlarmEvent`).
- Parmak izi: NGS standardı FP-Central — şablon `employeeFingerprints`'te AES-256-GCM şifreli, kişinin erişimindeki tüm Hik cihazlarına yayılır (2026-10-22). Kayıt açık rıza ister ([fingerprintEnrollment.ts:64](../convex/fingerprintEnrollment.ts)). `deviceFingerprintEnrollments` yalnız cihaz-başı metadata.
- Saat dilimi yazan fonksiyon hazır: `setDeviceTime` varsayılan `CST-3:00:00` ([gateway/devices.ts:200](../convex/lib/gateway/devices.ts)).
- Arayüz: İşlemler sekmesi `DeviceDetailsPanel.tsx:179` → `DeviceCommandCenter.tsx`; tarama komutu `useDeviceCommands.ts:22`.

## API taslağı

```ts
// convex/actions/hikDeviceImport.ts ("use node") — authedAction, devices.manage
previewDeviceImport({ deviceId }) → {
  rows: Array<{
    employeeNo: string; name: string; cards: string[]; fingerCount: number;
    status: "new" | "matched" | "conflict" | "manual";
    matchedEmployeeId?: Id<"employees">; reason?: string;
  }>;
  totals: { persons: number; cards: number; events?: number };
}
// convex/hikDeviceImport.ts — authedMutation, devices.manage + kişi yönetimi
importDevicePersons({ deviceId, rows: Array<{ employeeNo; name; fingerNos: number[] }> })
  → { created: number; skipped: number; ruleId?: Id<"accessRules"> }
// mevcut backfillDeviceEvents'e: startTime?: string | "all"
```

- Ad bölme: son kelime soyad, kalanı ad (`Mustafa Bingeloglu` → `Mustafa` / `Bingeloglu`); tek kelime → soyad boş.
- `email: ""`, `projectId = device.projectId`, `isActive: true`.
- İdempotent: aynı projede aynı kart no varsa `matched`, yeniden oluşturulmaz.
- Aktarım cihaza HİÇBİR silme göndermez; kural üyeliği eşitlemesi yalnız upsert yapar (aynı `employeeNo` → parmak izi korunur).

## Kapsam dışı
- IDE Smart panelden çekme · yüz fotoğrafı aktarma.
- IDE `reconcilePanelRosterIde` söküm davranışı (ayrı karar).
- Geçmiş günler için PDKS: vardiya ataması yoksa kayıtlar yalnız "geçiş" olarak kalır (Vardiyasız = PDKS yok kuralı).

## Açık sorular
- Önizleme sayfa boyu: K1T804 `UserInfo/Search` 30/sayfa döndü; büyük cihazda (≥1000 kişi) parmak izi sayımı kişi başı 1 çağrı → süre ~1 sn/kişi, gerekirse arka plan işine çevrilir.

## Uygulama düzeni
- Worker A (Codex `gpt-6.1-sol medium`): Faz 1-3 backend. Ownership: `convex/actions/hikDeviceImport.ts`, `convex/hikDeviceImport.ts`,
  `convex/cardReadings.ts` (backfill satırı), `convex/lib/gatewayBackfill.ts`, `convex/lib/hikSyncEmployee.ts` (kartsız), `convex/schema.ts`, testleri.
- Worker B (Codex `gpt-6.1-sol medium`): Faz 4 arayüz, A bitince. Ownership: `src/components/devices/**` yeni kart + test.
- Denetçi (Claude `sonnet medium`): diff + kendi kapı koşusu.
- Spec'lerde: commit/push/deploy/DB yazma YOK, `git add`/`git commit` yasak.
- Süre: backend ~1,5 sa · arayüz ~1 sa · denetim + kapı ~30 dk → toplam ~3 sa.

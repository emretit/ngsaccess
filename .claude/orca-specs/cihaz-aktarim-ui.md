# Görev: "Cihazdan verileri çek" — arayüz (Faz 4)

Repo: /Users/emreaydin/ngsaccess (Convex + React + Vite, TypeScript strict, Tailwind, shadcn/ui). Ana dizinde çalış, worktree AÇMA.
Plan: `.claude/plan-cihazdan-veri-cek.md` (Kararlar K1-K5, K1.1). Backend hazır (başka worker yazdı) — backend dosyalarına DOKUNMA.

## Hedef (test edilebilir)
Cihaz ayrıntı paneli → "İşlemler" sekmesinde, Hikvision gateway cihazı için kişi önizleme/seçimli aktarım ve geçmiş kayıt çekme
kartı çalışır; vitest (Testing Library) ile önizle → seç → rıza → aktar → sonuç ve geçmiş "Tümü" akışı kanıtlanır.

## Proje kuralları (CLAUDE.md'den, sen okumazsın)
- `any` / `as any` YASAK (eslint error). Convex sonuçları `FunctionReturnType<typeof api.X.Y>` ile tiplenir, `any[]`'a açılmaz.
- `!` non-null assertion yerine optional chaining + erken return.
- Tüm kullanıcı metni Türkçe, sade (teknik terim yok: "employeeNo" değil "Cihaz kişi no").
- Mevcut desenleri kullan: `useAction` (convex/react), `notify` (`@/lib/notify`), `StatusBadge` (`@/components/shared/StatusBadge`, tone:
  success|warning|danger|info|neutral), `ListSelectAll`, `ui/table`, `ui/checkbox`, `ui/button`, `ui/toggle-group`, `ui/date-picker` (`DateInput`),
  `SectionSkeleton`, `ConfirmAction`. Mobil 390px'te taşma yok; düğmeler mobilde `min-h-11` (bkz. `DeviceCommandCenter.tsx` sarmalayıcı sınıfı).

## YASAKLAR (ihlal = iş geçersiz)
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore`, `git push` ÇALIŞTIRMA.
- `npx convex …` hiçbir alt komut ÇALIŞTIRMA. Canlı DB / gateway / ssh / curl yok. Dev sunucusu açma.
- `convex/**` dosyalarına yazma (backend bitti). Ownership dışı dosyaya yazma.
- Başka oturumun değişikliklerine DOKUNMA ve bunlara bağımlı olma: `src/components/devices/DeviceList.tsx`, `DeviceList.test.tsx`,
  `src/components/shared/TableStateRow*` (commit'lenmemiş, kullanma), `src/components/pdks/**`, `src/components/shared/FilterBar.tsx`, `src/pages/PDKSRecords.tsx`.

## Ownership (yalnız bunlara yaz)
- YENİ: `src/components/devices/DeviceImportCard.tsx` (+ gerekirse `src/components/devices/deviceImportView.ts` saf yardımcılar),
  `src/components/devices/DeviceImportCard.test.tsx`.
- DEĞİŞİR: `src/components/devices/DeviceCommandCenter.tsx` (kartı yerleştir + pending OR), `src/components/devices/DeviceActionsSection.tsx`
  ("Olayları tara" düğmesini kaldır), `src/components/devices/useDeviceCommands.ts` (`handleBackfill` + `backfillEvents` useAction kaldır),
  `src/components/devices/deviceLabels.ts`, `src/components/devices/deviceCenterView.ts` (tip gerekiyorsa),
  ve bu değişikliklerin kırdığı mevcut testler: `useDeviceCommands.test.tsx`, `DeviceCommandCenter.audit.test.tsx`, `DeviceDetailsPanel.test.tsx`.

## Backend API (hazır, `convex/_generated/api.d.ts`'de)
```ts
api.actions.hikDeviceImport.previewDeviceImport({ deviceId }) →
  { rows: Array<{ employeeNo: string; name: string; cards: string[]; fingerCount: number;
                  status: "new" | "matched" | "conflict" | "manual"; matchedEmployeeId?: Id<"employees">; reason?: string }>;
    totals: { persons: number; cards: number }; truncated?: true }
  // hata durumunda THROW eder (Error.message Türkçe) — try/catch ile notify.error.
api.actions.hikDeviceImport.importDevicePersons({ deviceId, employeeNos: string[], biometricConsentConfirmed: boolean }) →
  { created; matched; conflicts; manual; consentsRecorded; fingerprintsStored; fingerprintsSkipped: number; ruleId: Id<"accessRules"> | null }
  // throw eder. Sunucu seçimi cihazdan yeniden okur, yalnız "new" olanları oluşturur.
api.actions.hikGatewayDevice.backfillDeviceEvents({ deviceId, startTime?: string /* ISO */, fromAll?: boolean }) →
  { ok: boolean; scanned: number; inserted: number; skipped: number; cursor?: number; error?: string; partial?: boolean }
  // ok:false + partial:true → kalan sayfalar arka planda sürüyor (hata değil, bilgi mesajı).
```
Kesin tipleri `FunctionReturnType` ile al; yukarıdaki şekil api.d.ts ile çelişirse api.d.ts kazanır, raporda belirt.

## Görünürlük / yetki
- Kart yalnız: `device.brand === "hikvision" && device.hikTransport === "gateway" && device.hikDevIndex` ve `can("devices.manage")`.
- "Kişileri aktar" bölümü ayrıca `can("employees.manage")` ister; yoksa bölüm gizli.
- Rıza kutusu yalnız `can("biometrics.manage")` ise görünür; yoksa küçük not: "Parmak izi yetkiniz yok; kişiler parmak izi olmadan aktarılır."
  ve `biometricConsentConfirmed: false` gönderilir.
- Cihaz çevrimdışıysa (`connection !== "online"`, `DeviceCenter`'daki değer) düğmeler pasif + "Cihaz çevrimdışı — aktarım yapılamaz".

## Kart tasarımı (`DeviceImportCard`, `DeviceCommandCenter` içinde `DeviceActionsSection`'dan SONRA, aynı `section py-3` deseni)
Başlık: "Cihazdan verileri çek" (ikon `Download`, lucide).

### A. Kişileri aktar
1. Düğme "Cihazdaki kişileri göster". Basınca `previewDeviceImport`; yüklenirken "Cihaz okunuyor… kişi sayısına göre 1 dakikayı bulabilir." (role=status).
2. Sonuç özeti tek satır: "Cihazda {persons} kişi, {cards} kart." `truncated` ise uyarı: "İlk 1000 kişi gösteriliyor."
3. Tablo (sütunlar): seçim kutusu · Cihaz kişi no · Ad · Kart (yoksa "Kartsız") · Parmak izi (sayı, 0 ise "—") · Durum rozeti.
   - Durum: `new` → "Yeni" (info) · `matched` → "Zaten kayıtlı" (success) · `conflict` → "Çakışma" (danger) · `manual` → "Elle eşleştir" (warning).
     `reason` varsa rozetin altında küçük `text-muted-foreground` metin.
   - Yalnız `new` satırlar seçilebilir; diğerlerinin kutusu `disabled`. Varsayılan: tüm `new` satırlar seçili.
   - Başlıkta `ListSelectAll` ("Tüm yeni kişileri seç"), `indeterminate` destekli. Satırın herhangi bir yerine tıklamak kutuyu değiştirir
     (yalnız seçilebilir satırda; `cursor-pointer`).
   - Hiç `new` yoksa tablo yine görünür + not: "Aktarılacak yeni kişi yok."
4. Rıza kutusu (yalnız seçili satırlardan en az birinde `fingerCount > 0` ve `biometrics.manage` varsa):
   "Seçilen kişilerin parmak izi açık rızası alınmıştır". İşaretsizken yardımcı metin: "İşaretlemezseniz kişiler parmak izi olmadan aktarılır."
   (Engelleyici DEĞİL — işaretsiz de aktarılabilir; backend şablonu atlar.)
5. Düğme "Seçilenleri aktar ({n})" — n=0 iken pasif. Basınca `ConfirmAction`: başlık "Kişiler aktarılsın mı?", açıklama:
   "{n} kişi ngsplus'a eklenecek ve '<cihaz adı> mevcut kişiler' erişim kuralına bağlanacak. Cihazdaki kişiler silinmez."
6. Sonuç kutusu (role=status): "{created} kişi eklendi · {fingerprintsStored} parmak izi kaydedildi" + sıfır değilse
   "· {fingerprintsSkipped} parmak izi atlandı" · "· {consentsRecorded} rıza kaydı" · ruleId varsa "· Erişim kuralı: <cihaz adı> mevcut kişiler".
   `created === 0` ise "Yeni kişi eklenmedi (hepsi zaten kayıtlı)." Ardından önizleme otomatik YENİDEN çalışır (satırlar "Zaten kayıtlı" olur).
   Hata → `notify.error("Aktarım tamamlanamadı", message)`, seçim korunur.

### B. Geçmiş kayıtları çek
1. Kapsam seçimi (`ToggleGroup type="single"`, zorunlu): "Son 24 saat" (varsayılan) · "Tarihten itibaren" · "Tümü".
   "Tarihten itibaren" seçilince `DateInput` (bugünden ileri seçilemez). Tarih → o günün 00:00 Europe/Istanbul ISO'su
   (`${date}T00:00:00+03:00`). "Son 24 saat" → `new Date(Date.now() - 24*3600*1000).toISOString()`. "Tümü" → `{ fromAll: true }` (startTime gönderme).
2. Düğme "Kayıtları çek". "Tümü" seçiliyse önce `ConfirmAction`: "Cihazdaki tüm geçmiş kayıtlar çekilecek. Zaten aktarılanlar tekrar eklenmez; işlem birkaç dakika sürebilir."
3. Sonuç (role=status): "{scanned} kayıt tarandı · {inserted} eklendi · {skipped} zaten vardı / atlandı".
   `ok:false && partial` → "{scanned} kayıt tarandı, kalanı arka planda sürüyor. Birkaç dakika sonra Geçiş Kayıtları'na bakın."
   `ok:false && !partial` → `notify.error("Kayıtlar çekilemedi", error)`.

### Pending
- Aktarım/önizleme/çekme sürerken iki bölümün düğmeleri pasif. `DeviceCommandCenter`'ın `onPendingChange`'i (panel kapanmasını engeller)
  kart pending'iyle OR'lanır: `useDeviceCommands` pending'i ile kartın pending'ini birleştir, tek `onPendingChange` çağrısı.
  Kartın kendi `longRunning` eşiği yok (önizleme meşru olarak uzun sürer).

### Eski düğme
- `DeviceActionsSection`'daki "Olayları tara" (`backfillEvents`) düğmesi ve `useDeviceCommands.handleBackfill` kaldırılır (yerini B aldı).
  `deviceLabels.backfillEvents` başka yerde kullanılmıyorsa kaldır.

## Testler (`DeviceImportCard.test.tsx`, mevcut `useDeviceCommands.test.tsx` mock desenini kopyala: `vi.mock("convex/react")`)
1. Gateway değil / `devices.manage` yok → kart render edilmez.
2. Önizle → 4 satır (ANKA fixture: `1` Okan ISMAN, `2` Cinar ZONGUR, `3` Bengu AYDIN, `4` Mustafa Bingeloglu; hepsi `new`, kart yok, fingerCount 1)
   + 1 `matched` + 1 `conflict` → yalnız `new` kutuları aktif, varsayılan seçili 4, "Seçilenleri aktar (4)".
3. Rıza kutusu görünür; işaretle → onayla → `importDevicePersons` `{ employeeNos: ["1","2","3","4"], biometricConsentConfirmed: true }` ile çağrılır;
   sonuç metni "4 kişi eklendi · 4 parmak izi kaydedildi"; önizleme 2. kez çağrılır.
4. `biometrics.manage` yok → rıza kutusu yok, not görünür, `biometricConsentConfirmed: false`.
5. Bir satırın seçimi kaldırılınca employeeNos'tan düşer; select-all indeterminate.
6. Geçmiş "Tümü" → onay → `backfillDeviceEvents({ deviceId, fromAll: true })`; "Tarihten itibaren" `2026-09-01` → `startTime: "2026-09-01T00:00:00+03:00"`.
7. `partial` sonuç → arka plan mesajı, `notify.error` çağrılmaz.
8. Çevrimdışı → düğmeler pasif.
Mevcut testlerde "Olayları tara" beklentisi varsa güncelle.

## Kapılar (hepsi yeşil olmadan worker_done YOK)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint src convex        # no-explicit-any 0
node_modules/.bin/vitest run src/components/devices
node_modules/.bin/vitest run               # TAM koşu
```
Not: `convex/shiftPlans.test.ts` tam koşuda zaman aşımına düşebiliyor (tek başına geçiyor) — öyleyse tek başına koşup belirt.
Başka oturumun dosyalarından gelen hata varsa (pdks / TableStateRow / DeviceList) DÜZELTME, raporda belirt.

## Rapor (worker_done, ≤10 satır)
Değişen dosyalar file:line, kapı sonuçları, api.d.ts ile spec arasında fark varsa, açık risk. `--files-modified` ile tam dosya listesini ver.

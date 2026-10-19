# Denetim — KVKK Faz 1 BACKEND (salt-okuma)

**Canlıya hazır: HAYIR.** 3 YÜKSEK bulgu var: self-signup projeleri biyometri açık başlıyor; bridge çevrimdışıyken imha her şablon için 24 saatlik 30 sn poll zinciri açıyor (Convex kota riski); canlı (eski Netlify) web asistanın OpenAI yolu deploy sonrası çalışmaz. Silme güvenliği, IDOR ve kapı kapsamı genel olarak sağlam; KRİTİK bulgu yok.

## Kapılar (kendi koşumum, 2026-10-19)
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → exit 0, hata yok.
- `node_modules/.bin/eslint convex` → exit 0, 0 error / 0 warning.
- `npx vitest run convex` → 63 dosya, 835/835 geçti.

## Bulgular

### YÜKSEK

**Y1 — Self-signup ile oluşan projeler biyometri AÇIK başlıyor (sözleşme ihlali)**
- `convex/onboarding.ts:45` ve `convex/onboarding.ts:132` `projects` satırı ekliyor ama `projectPrivacySettings` satırı eklemiyor. Yalnız `convex/projects.ts:71` (superAdmin `create`) `biometricEnabled: false` yazıyor.
- Senaryo: yeni müşteri Register ile kayıt oluyor → onboarding projesi oluşuyor → satır yok → `DEFAULT_PRIVACY.biometricEnabled = true` (`convex/lib/privacySettings.ts:15`) → yüz/parmak izi rızası ve eklemesi serbest. Sözleşmede "yeni projeler biyometri KAPALI başlar" yazıyor.
- Düzeltme: iki onboarding insert'inden sonra `upsertPrivacySettings(ctx, projectId, { biometricEnabled: false })` + `writeAudit`. Seed dosyaları (`seedHikvisionLanDevice.ts:34`, `seedCardReaderTest.ts:19`) önemsiz.

**Y2 — İmhada bridge cihazları: şablon başına 24 saat × 30 sn kontrol zinciri (kota yangını)**
- `convex/biometricDestruction.ts:225-231`: kuyruğa bridge işlemi eklenen her partide (DESTRUCTION_BATCH_SIZE = 1, yani **her şablonda**) ayrı bir `checkDeviceOperations` zinciri başlıyor. `:251-252` op'lar `pending` kaldıkça 30 sn'de bir kendini yeniden planlıyor, sınır `DEVICE_WAIT_MS = 24 saat` (`convex/lib/biometricDestruction.ts:7`).
- Senaryo: projede `hikTransport: "localBridge"` cihazı var, Windows köprüsü kurulu değil/çevrimdışı (memory: köprü 1.1.0 kurulumu bekliyor) → 500 şablon imhası = 500 paralel zincir × 2.880 çağrı ≈ **1,44 milyon mutation/gün**. Free plan kotası 1M/ay; geçmişte iki kez kota yangını yaşandı.
- Ek etki: zincirler bitene kadar run `waitingDevices` kalır → `hasActiveDestructionRun` (`convex/lib/biometricDestructionState.ts:11`) 24 saat boyunca modülün yeniden açılmasını ve yeni imhayı engeller.
- Düzeltme: run başına TEK kontrol zinciri (op id'leri state'te ya da `destructionRunId` ile index'li sorgu), aralığı geri çekilmeli (30 sn → 5 dk → 30 dk), ya da bridge `hikLastSeenAt` eskiyse hemen "doğrulanamadı" deyip beklememek.

**Y3 — Canlıdaki eski web istemcisi deploy sonrası asistanı kullanamaz**
- `convex/actions/openaiChat.ts:61-63`: `projectId` yoksa OpenAI'a gitmeden "Asistan güncellendi; sayfayı yenileyin" döner. Eski istemci `projectId` göndermiyor; yeni gönderim `src/components/pdks/chat/hooks/useMessageHandler.ts:48` commit'siz diff'te.
- Senaryo: `npx convex dev --once` yapılır, web Netlify'da eski build'te kalır (memory P-01: Netlify HEAD'i yayınlamıyor) → sayfayı yenilemek işe yaramaz, asistanın serbest soru yolu kalıcı olarak "yenileyin" der. Davranış kapalı kalarak başarısız oluyor (veri sızmıyor), ama özellik kırılıyor.
- Düzeltme: ya web deploy'u Convex deploy'uyla aynı anda yapılmalı, ya da geçiş için `projectId` yokken kullanıcının tek projesini sunucuda çözüp yine sunucu bağlamıyla (maskeli) devam etmeli. En azından mesaj "yenileyin" yerine gerçeği söylemeli.

### ORTA

**O1 — Asistan maskelemesi uygulama içi rapor tablosunu da maskeliyor (gizlilik kazancı olmadan işlev kaybı)**
- `convex/actions/getChatData.ts:44-56`: `getCardReadings` sonucu OpenAI'a GİTMİYOR; yalnız istemcideki parser/NL yolunda tablo olarak gösteriliyor (`src/components/pdks/chat/services/chatService.ts:24-59`; OpenAI'a yalnız `fetchDatabaseContext` → sunucu `getAssistantContext` gidiyor, `openaiChat.ts:72`).
- Senaryo: yetkili yönetici "bugün Muhasebe giriş kayıtları" yazar → tabloda "Personel 1, Personel 2" görür, kimin geldiğini göremez. Varsayılan maskeli olduğu için tüm eski projelerde de olur.
- Düzeltme: maskelemeyi yalnız OpenAI sınırında (`getAssistantContext`) bırakmak; `getCardReadings`'ten kaldırmak. Kullanıcıya söylenecek davranış değişikliği.

**O2 — `projectId`'siz (eski) biyometrik şablonlar imhada görünmüyor, tutanak "tamamlandı" der**
- `convex/schema.ts:757,768`: `employeeFaces.projectId` ve `employeeFingerprints.projectId` `v.optional`. Önizleme (`convex/biometricDestruction.ts:52-54`) ve imha (`:101-102`) `by_project` index'iyle `eq("projectId", projectId)` arıyor.
- Senaryo: backfill öncesinden kalan `projectId: undefined` şablon → sayılmaz, silinmez, tutanakta `durum: completed`. Canlıda böyle satır var mı **doğrulanamadı** (`convex/migrations/projectIdBackfill.ts` mevcut; çalıştırılıp çalıştırılmadığı bilinmiyor).
- Düzeltme: imhadan önce `by_employee` ile projenin çalışanları üzerinden de taramak ya da önizlemede "projesiz şablon sayısı"nı ayrı göstermek; canlıda `projectId` boş şablon sayısını salt-okuma kontrol etmek.

**O3 — `captureFaceFromDevice` biyometri kapısından geçmiyor**
- `convex/actions/hikGatewayDevice.ts:933-985`: public `authedAction`; proje izni var, `assertBiometricAllowed` yok. Cihaz kamerasından canlı yüz verisi (`faceDataBase64`) alıp istemciye döner.
- Senaryo: modül kapalı projede herhangi bir proje üyesi API'den çağırır → yüz görüntüsü toplanır (kalıcı kayıt `addFace`'te kapılı, ama toplama kapısız). `src` içinde çağıran yok; `employeeNo` ile cihazın yüzü kişiye kaydedip kaydetmediği **doğrulanamadı**.
- Düzeltme: device.projectId için `assertBiometricSyncAllowed` benzeri bir iç sorgu ya da kullanılmıyorsa fonksiyonu kaldırmak.

**O4 — Her şablon için ayrı parti → fonksiyon çağrısı ve denetim kaydı şişmesi**
- `convex/lib/biometricDestruction.ts:4` `DESTRUCTION_BATCH_SIZE = 1`. Her şablonda: `prepareBatch` + action + 2-3 `isBatchActive` + cihaz başına 2 mutation + `finishBatch`. Ayrıca her şablonda ≥2 auditLog satırı (`saveState` → `writeAudit`, `:37`, `:138`, `:232`) ve gateway cihaz başına 2 satır (`:163`, `:193`).
- Senaryo: 1.000 şablon × 20 gateway cihazı ≈ 42.000 denetim satırı ve ~45.000 fonksiyon çağrısı; Denetim sayfası imha satırlarıyla dolar.
- Düzeltme: ilerleme notlarını audit'e yazmak yerine yalnız state satırını patch'lemek (başla/bitir/hata audit'te kalsın), cihaz op audit'lerini partide toplamak.

**O5 — Saklama alt sınırı (365 gün) yorumdaki yasal süreyle çelişiyor**
- `convex/lib/privacySettings.ts:22-24`: yorum "Puantaj/SGK dayanağı okumalar yasal saklama süresine (5-10 yıl) tabidir" diyor ama alt sınır 365 gün. Silinen okumalar `pdksRecords`'u etkilemez (ayrı tablo, `convex/schema.ts:779`), ama okuma tabanlı raporlar ve itiraz kanıtı 1 yıl sonra kaybolur.
- Düzeltme: ürün/hukuk kararı — alt sınırı yükseltmek ya da UI'da 5 yıldan kısa seçimde açık uyarı. Kod hatası değil, kullanıcıya sorulacak karar.

### DÜŞÜK

- **D1** `convex/hikvisionSync.ts:560-563`: modül kapalıyken engellenen bridge ekleme op'ları `failed` yapılıyor ama `attemptCount` artırılmıyor → `cleanupStaleSyncIssues` (`:938`, `attemptCount >= 5` şartı) bunları hiç kapatmaz; Senkron Sorunları bandında kalıcı kalırlar ve 500'lük temizlik penceresinin başını işgal edebilirler. Düzeltme: `attemptCount: 5` ya da ayrı `dismissedAt`.
- **D2** `convex/hikvisionSync.ts:743,752` (`listRetryCandidates`) kapıyı sorguda kontrol ediyor; `hikQueueWorker.ts:154` `addFingerprint` çalıştırmadan önce yeniden kontrol etmiyor. Pencere birkaç saniye (TOCTOU, yani kontrol ile kullanım arasında durum değişmesi). Gateway retry'da `addFace` zaten desteklenmiyor (`hikQueueWorker.ts:280`).
- **D3** `convex/lib/biometricDestructionState.ts:13`: 24 saatten uzun süren `running` run "aktif değil" sayılır → büyük projede imha sürerken modül yeniden açılabilir. Veri güvenliği korunuyor (`_creationTime <= startedAt` + `addedAt` kontrolü, `convex/biometricDestruction.ts:101,118,207,215`), politika açığı.
- **D4** auditLog satırı durum deposu olarak patch'leniyor (`convex/biometricDestruction.ts:36`). Ekleme-yalnız iz ayrı satırlarda (`targetTable: "biometricDestruction"`) korunuyor, PII yok (sayılar, gerekçe, proje adı, opak cursor). Ama "create" satırı zamanla değişiyor, `searchText` ilk hâlde kalıyor, yeni tablolar için `AUDIT_TARGET_LABELS` (`convex/lib/auditLogQuery.ts:3`) etiketi yok → Denetim sayfasında ham tablo adı + ham JSON görünür. Bozuk/yeni sürüm state satırı `startBiometricDestruction`'ı kalıcı kilitler (`:69` `!previous.success` → DESTRUCTION_ACTIVE); bugünkü kodla oluşmaz.
- **D5** `convex/privacyBiometric.ts:38`: eski (satırsız, açık) projede `enabled: true` + gerekçe gönderilirse "değişiklik yok" diye dönülür, gerekçe kaydedilmez. UI bu yolu sunmuyor (`BiometricModuleCard.tsx:50`).
- **D6** `convex/privacyRetention.ts:103`: süre tanımlı her proje için günde 1 denetim satırı (0 silme olsa bile). Kayıt geciken (backlog) projede günlük tavan 4.000 okuma (`RETENTION_BATCH_SIZE 200 × 20`); 1M eski okuma ≈ 250 gün sürer — tutanakta `dailyLimitReached` var.
- **D7** Yeni public query'lerde `returns` validator'ü yok (`privacyBiometric.ts:17`, `biometricDestruction.ts:47,83`, `privacyRetention.ts:18`). Argüman validator'leri tam, `any` yok (eslint 0).

## Kontrol listesi — temiz çıkanlar (kanıtla)

1. **Yetki/IDOR** — temiz. Tüm public fonksiyonlar `adminQuery/adminMutation` + `requireProject` (`getProjectIdsForUser`): `privacyBiometric.ts:20,33`, `biometricDestruction.ts:50,63,86`, `privacyRetention.ts:21,30,42`. `getDestructionRun` başka projenin `runId`'sini `row.projectId !== args.projectId` ile reddediyor (`:88`). Durum değiştiren tüm imha fonksiyonları `internalMutation/internalQuery/internalAction` (`grep "export const" convex/biometricDestruction.ts convex/actions/biometricDestruction.ts`). `getAssistantPrivacy/getAssistantContext` internal + yine kullanıcı proje izni kontrolü (`privacyRetention.ts:54,63`).
2. **İmha** — (a) silme yalnız `face.projectId === projectId` ve revizyon eşleşmesinde (`biometricDestruction.ts:207,215`); storage silme yalnız `employees.by_photo_storage` referansı yoksa (`:208-209`). Şemada storage'a referans veren yalnız 3 alan var (`employees.photoStorageId`, `employeeFaces.pictureStorageId`, `pendingUploads.storageId` — `grep 'v.id("_storage")' convex/schema.ts`); iki yüz satırının aynı dosyayı paylaşması yalnız elle hazırlanmış istemci çağrısıyla mümkün (mevcut `addFace` de dosyayı koşulsuz siliyor). (b) `confirmText === project.name`, gerekçe 3-500, modül kapalı şartı sunucuda (`:64-71`). (c) Çift teslim: `batch` sayacı eski action sonuçlarını geçersiz kılıyor (`:155,174,201,224`); watchdog 10 dk (`:262-274`) takılı run'ı `failed` yapıyor, sonra gelen `finishBatch` hiçbir şey silmiyor (güvenli yön). (e) Cihazlar `device.projectId === run.projectId` ile yeniden doğrulanıyor (`:157,174`); 50 cihaz sınırı action planlanmadan ÖNCE, o partide hiçbir şey silinmeden duruyor (`:125-129`).
3. **Kapı bypass** — `grep -rn -E 'addFaceToDevice|addFingerprintToDevice|"addFace"|"addFingerprint"|insert\("employeeFaces"|insert\("employeeFingerprints"' convex`: ekleme yolları `employeeFaces.addFace:68`, `employeeFingerprints.addFingerprint:66`, rıza `employeeConsents.grant:62`, sync action girişi + hedef başına (`actions/hikvisionSync.ts:757,788,897,925`), bridge enqueue (`hikvisionSync.ts:419-422`), bridge claim (`:555-563`), gateway retry (`:743,752`), elle retry (`:981-984`) kapılı. `http.ts`/`hikBridge.ts`'de yüz/parmak izi rotası yok; `employeeCascade` yalnız siler. Tek açık: O3. Silme yolları (`removeFace`, `deleteFace` op'ları, rıza geri alma) kapısız — doğru. Satırsız eski projeler açık kalıyor (`privacySettings.ts:27,57`). `projects.create` insert + ayar + audit tek mutation içinde (atomik).
4. **Saklama** — Yeni yazımların hepsi UTC `...Z` (`cardReadings.ts:886,1437` `toISOString`; `ideTimeToISO`/`toUtcISO` → `toISOString`). Kesim UTC ISO, TR gün başına hizalı (`cardReadingRetention.ts:12-18`). `+03:00`/boşluklu eski (Supabase taşıması) format olursa hata en fazla kesim gününde <24 saat; canlı veride format karışıklığı **doğrulanamadı**. Index `by_project_access_time` (`schema.ts:490`), `filter` yok, `take(200)`, zincir yalnız tam partide devam eder ve ayar değişince durur (`privacyRetention.ts:96-102`); süresiz (null) proje atlanır (`:81`); `lt(cutoff)` yeni kaydı silmez (cihaz saati bozuk olup geçmiş tarih yazan okumalar hariç).
5. **Asistan** — `grep -rliE 'openai|chat/completions|gpt-' convex` → yalnız `actions/openaiChat.ts` (+ yorum/test). OpenAI'a giden bağlam artık sunucuda üretiliyor; istemcinin `dbContext`'i yok sayılıyor (`openaiChat.ts:72,90`). Örneklemde `employeeId` dışarı çıkarılıyor (`privacyRetention.ts:67-68`). `projectId`'siz çağrı dış çağrı yapmıyor (`openaiChat.ts:61-63`). Kullanıcının kendi yazdığı metin olduğu gibi gider (beklenen).
6. **Ortak yardımcı/şema** — `toPatch`: undefined dokunmaz, null alanı siler (`nullablePatch.ts:6-11`); iki worker farklı alan yazar, aynı satıra eşzamanlı yazımı Convex OCC sıralar. `projectDeletionCleanupTables`'a eklenmiş, `by_project` index'i var (`adminGuards.ts:69`, `schema.ts:1151`). `api.d.ts` +8 satır, tsc 0.
7. **Canlıya çıkış** — İlk cron koşumunda tablo boş → hiçbir şey silinmez. Yeni tablo boşken eski projelerde davranış değişmez (biyometri açık). İmza kırılması: yalnız Y3.

## Kullanıcıya söylenecek davranış değişiklikleri
1. Süper admin'in açtığı yeni projelerde biyometri kapalı başlar (self-signup'ta değil — Y1).
2. Modül kapalı projede biyometrik rıza verme, yüz/parmak izi ekleme ve cihaza gönderme reddedilir; bekleyen bridge eklemeleri "başarısız" olarak Senkron Sorunları'nda görünür.
3. Asistan adları varsayılan maskeler; uygulama içi rapor tablosu da maskeli görünür (O1).
4. İmha sonrası bridge cihazı varsa modül 24 saate kadar yeniden açılamaz (Y2); DS-K2804 köprüsü biyometrik silmeyi desteklemiyor (worker raporu) → bu cihazlarda tutanak "cihaz silmesi başarısız/doğrulanamadı" gösterir.
5. Web, Convex'le aynı anda deploy edilmezse asistanın serbest soru yolu çalışmaz (Y3).

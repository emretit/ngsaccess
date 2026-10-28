# TAŞIMA K-02 MVP — W1 BACKEND: kişiyi başka projeye kalıcı taşıma (erişim devri)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma).
Rapor: `/tmp/tasima-k02-w1-rapor.md`. Tasarım kaynağı: `docs/sistem-audit-2026-10-25/tasima-tasarim-claude.md` (§0-§2, §4) +
`TASIMA-SENTEZ.md`. Satır numaraları eski olabilir; kodda yeniden doğrula. **Schema değişikliğine bu spec İZİN VERİR** (aşağıdaki kadar).

## Emre kararları (2026-10-26, değişmez)
1. Kişi modeli: **B projesinde YENİ kayıt**; A kaydı "taşındı" olarak kapanır, geçmişi (PDKS, okumalar, izin, puantaj, rıza) A'da kalır.
2. **Zorla tamamla YOK.** Kalıcı bozuk cihazın tek çıkışı: cihaz A projesinden kaldırılırsa/silinirse o hedef `deviceRemoved` kapanır (audit'li).
3. MVP: başlangıçta hedef cihazlardan biri bile çevrimiçi değilse taşıma BAŞLAMAZ. (IDE panel devri C-02 bu işin kapsamı DIŞI.)

## Hedef (test edilebilir)
`startTransfer` A kişisini B projesine taşır: A hemen pasif olur ve eski cihazlardaki silmeler izlenir; **A'nın TÜM hedef cihazları
silmeyi gerçekten onaylamadan kart B kaydına geçmez ve B'de hiçbir cihaza yazılmaz**; son onayla kart B'ye geçer, B kuralları uygulanır.

## Ownership (yalnız bunlar)
`convex/schema.ts` · `convex/employeeTermination.ts` (YENİ fonksiyonlar BURAYA — yeni convex modülü AÇMA, codegen yasak) ·
YENİ `convex/lib/accessTransfer.ts` (yalnız saf yardımcı + ctx alan helper; içinde kayıtlı Convex fonksiyonu OLMAZ) ·
`convex/lib/grantStatus.ts` · `convex/employees.ts` · `convex/lib/employeeCardChange.ts` · `convex/employeeAuth.ts` (yalnız aynı e-postalı
taşınmış kayıt seçimi gerekiyorsa) · `convex/lib/deviceHelpers.ts` · `convex/lib/deviceAssignment.ts` (yalnız 2. karar kancası) ·
`convex/hikvisionSync.ts` (yalnız supersede kancası) · `convex/ideSync.ts` + `convex/actions/ideGatewayDevice.ts` (yalnız devir silmelerinde
deneme sınırı / employeeId taşıma) · `convex/crons.ts` · `src/components/employees/lib/employment.ts` (yalnız "transfer" etiketi, tsc için) ·
`src/components/audit/auditLabels.ts` (YALNIZ yeni satır EKLE; dosyada başka oturumun `mailSettings` satırı var, ona dokunma) ·
testler: YENİ `convex/employeeTransfer.test.ts` + değişen modüllerin mevcut testleri.
DOKUNMA: `convex/actions/sendEmail.ts`, `convex/actions/sendScheduledReports.ts`, `convex/lib/auditLogQuery.ts`, `convex/lib/pdks*`,
`src/components/reports/**`, `src/lib/reports/**`, `src/components/settings/**`, `src/lib/capabilities.ts`, `package.json` (başka oturum WIP) ·
`src/components/employees/**` (lib/employment.ts hariç — UI W2'de) · `convex/_generated/**`.

## Şema (yalnız bunlar; hepsi genişletme, mevcut veri bozulmaz)
- YENİ `accessTransfers`: `kind: "employee" | "ide_panel"` (yalnız employee uygulanır), `status: requested|revoking|revoked|provisioning|done|stuck|cancelled`,
  `sourceProjectId`, `targetProjectId`, `employeeId` (A), `targetEmployeeId` (B), `cardNumber` (dondurulmuş kimlik), `targetPlan`
  (B'de uygulanacak alanlar: `accessRuleIds`, opsiyonel `departmentId`), `requestedBy`, `requestedAt`, `deadlineAt`, `completedAt?`,
  `stuckReason?`, `lastError?`. Index'ler: `by_status_deadline`, `by_employee_status`, `by_target_employee_status`, `by_source_project`.
- YENİ `accessTransferTargets`: `transferId`, `deviceId`, `brand: hikvision|ide_smart`, `state: pending|confirmed|failed|superseded|deviceRemoved`,
  `lastError?`, `confirmedAt?`, `updatedAt`. Index'ler: `by_transfer_state`, `by_device_state`, ve onay kancası için `(deviceId, state)` yeterli değilse
  `by_employee_device` benzeri (transferin A employeeId'si ile hızlı eşleşme) — tasarla, tam tablo taraması YOK.
- `employees.terminationType` union'ına `"transfer"`; `employees.transferredFromEmployeeId?` (B'de), `transferredToEmployeeId?` (A'da);
  A'nın kartı B'ye geçince A'da görünür kalması için arşiv alanı (ör. `transferredCardNumber?`). Başka alan gerekirse rapora gerekçe yaz.

## Akış
1. **`startTransfer`** (authedMutation; args `employeeId`, `targetProjectId`, `accessRuleIds: Id<"accessRules">[]`, `departmentId?`):
   - Yetki: A projesinde ve B projesinde `employees.manage`; ücret alanı doluysa İKİ projede `pay.view` (mevcut `employees.update` taşıma
     yetki mantığı, ~`employees.ts:320-330`); `accessRuleIds` boş değilse B'de `accessRules.manage`. Kurallar ve departman B projesine ait olmalı.
   - Ret (ConvexError `{code, message}`, Türkçe): ziyaretçi · zaten pasif/işten ayrılmış · A=B · A veya B için aktif devir var
     (`TRANSFER_IN_PROGRESS`) · A'nın ev sahibi olduğu AKTİF ziyaretçi var (sayı mesajda) · hedef cihazlardan biri `deviceConnection(...) !== "online"`
     (`TRANSFER_DEVICE_OFFLINE`, kapalı cihaz adları mesajda).
   - Hedefleri dondur: A'nın Hik cihazları (`snapshotEmployeeHikDevices` + `removed` olmayan grant satırları + bekleyen silmeler), IDE cihazları
     (`resolveEmployeeIdeDeviceIds` + A kartını tutan, projesi A olan `idePanelUsers` satırları). Cihaz başına bir `accessTransferTargets` satırı.
   - Aynı transaction: A → `isActive:false`, `employmentEndDate` = bugün (TR, `trTodayKey`), `terminationType:"transfer"`, `terminatedAt/By`,
     `transferredToEmployeeId`; A'nın `groupMembers` satırları, `employeeSessions` ve `employeeAuth` kaydı silinir; `closeAccess` mantığı
     (dışa aç, kopyalama) silmeleri başlatır — **dondurulan her hedef için gerçekten bir silme işi oluştuğunu doğrula**; `closeAccess` bir
     hedefi kapsamıyorsa (ör. yalnız `idePanelUsers`'ta görünen panel) o hedef için silmeyi sen kuyruğa al. IDE devir silmeleri `maxAttempts` 50.
   - B'de **kartsız** yeni kayıt: yalnız projeden bağımsız profil alanları kopyalanır (ad, soyad, e-posta, TC, sicil, foto, ücret yetkiliyse,
     notlar); A'nın departman/şirket/pozisyon/vardiya id'leri KOPYALANMAZ (A projesine ait); `departmentId` arg'dan. `transferredFromEmployeeId`.
     Kartsız kişi HİÇBİR cihaza gitmez (sync yollarında boş kartın atlandığını doğrula; atlanmıyorsa koru). E-posta/TC/sicil tekillik kontrolleri
     B oluşturmayı A yüzünden reddetmesin; mobil giriş aynı e-postada B'yi (aktif kaydı) seçsin — mevcut kontrolleri oku, gerekeni yap.
   - Hedef yoksa doğrudan tamamlama. Audit: "Başka projeye taşıma başlatıldı". Dönüş `{ transferId, targetEmployeeId }`.
2. **Onay** — tek kanca `lib/grantStatus.ts` `upsertGrantStatus` içinde `state === "removed"` olduğunda: A employeeId + deviceId için açık hedef
   varsa `confirmed`. (Bu nokta Hik `markOpDone`, yerel köprü ack, gateway `recordGrantResults`, IDE ack success ve `not_found` yollarının ortak
   noktası — her birini testle kanıtla.) Hik supersede (`markOpSuperseded` / `supersedeDeletion`) bir devir hedefine denk gelirse hedef
   `superseded` ve devir `stuck` (sessizce done OLMAZ). IDE iş terminal `failed` olursa hedef `failed` (devir `revoking` kalır, süre dolunca stuck).
   Onay yalnız iyiye ilerler; geç gelen başarı `failed`/`stuck` hedefi de `confirmed` yapar. Tüm hedefler `confirmed|deviceRemoved` → `revoked`
   ve tamamlama `internalMutation`'ı planlanır.
3. **Tamamlama** (internalMutation): kart tekilliğini A hariç yeniden kontrol et; A kartı arşiv alanına alınır ve A'dan düşer, kart B'ye yazılır,
   `targetPlan` (kurallar/üyelik) mevcut kişi oluşturma/kural atama yolunun mekanizmasıyla uygulanır, B için normal Hik + IDE gönderimi
   planlanır (`employees.ts` create yolundaki gibi). `provisioning → done`, `completedAt`. Audit.
4. **`cancelTransfer`** (authedMutation; `revoking|stuck`): A geri açılır (alanlar temizlenir, kartı yeniden cihazlara gönderilir — `reinstate`
   mantığı), B kaydı (kartsız) mevcut silme cascade'iyle silinir, hedefler kapanır, `cancelled`. Audit. **`retryTransfer`** (`stuck`): `failed`
   hedeflerin silmesi yeniden kuyruğa girer, `deadlineAt` +24 sa, `revoking`; `superseded` hedef varsa red (nedeni mesajda).
5. **Süre** — `crons.ts`: 15 dk'da bir `revoking` + `deadlineAt` (24 sa) geçmiş → `stuck` (`by_status_deadline`, sayfalı).
6. **Cihaz çıkışı (karar 2)** — A projesindeki cihaz silinir ya da başka projeye/havuza alınırsa açık hedefleri `deviceRemoved` (audit'li) +
   kalan hedef yoksa revoked akışı. Kanca `lib/deviceHelpers.ts` cascade'inde (cihaz kaldırma tek noktadan geçiyorsa) — doğrula.
7. **Kilitler** (`TRANSFER_IN_PROGRESS`): devir aktifken (`requested|revoking|revoked|provisioning|stuck`) A ve B için kart değişimi, proje değişimi,
   silme, `terminate`, `reinstate`, yeni devir reddedilir. `reinstate` `terminationType:"transfer"` olan kaydı HER ZAMAN reddeder (devir bitmiş olsa da).
   `employees.update` proje değişimi engeli KALIR; mesajı "Kişi Ayrıntıları → Başka projeye taşı" yolunu göstersin.
8. **Sorgular** (UI W2 için): `getEmployeeTransfer({employeeId})` → A veya B tarafından bakan için aktif/son devir: durum, karşı proje adı, hedef
   listesi (cihaz adı, durum, son görülme, hata), `canCancel`, `canRetry`. Okuyan kişinin o projede kişi görme yetkisi olmalı; karşı projeye
   yetkisi yoksa karşı projenin yalnız adı görünür. `transferPreflight({employeeId, targetProjectId})` → başlatmayı engelleyecek nedenler listesi
   (çevrimdışı cihazlar, aktif ziyaretçi sayısı, yetki eksikleri) + hedef cihaz sayısı. Sorgular sınırlı okuma (`take`), tam tarama YOK.

## Kabul (testler — `convex/employeeTransfer.test.ts`, convex-test)
- Başarılı yol: 1 Hik + 1 IDE hedef → start sonrası A pasif, B kartsız, B için cihaz işi YOK; Hik `markOpDone` → hedef confirmed, devir hâlâ revoking;
  IDE ack success → revoked → tamamlama: kart B'de, A'da arşivde, B için gönderim planlandı. IDE `not_found` da onay sayılır.
- Hik supersede → hedef superseded + devir stuck; retry reddedilir; cancel → A aktif + kart A'da + B silinmiş.
- Çevrimdışı hedef → start reddi (cihaz adı mesajda). Aktif ziyaretçi ev sahipliği → ret. Aktif devirde ikinci devir/kart değişimi/silme/reinstate → ret.
- Yetki: B'de `employees.manage` yok → ret; ücretli kişide bir projede `pay.view` yok → ret; B kuralı başka projeden → ret.
- Deadline cron → stuck; retry → revoking, deadline uzar. Cihaz A'dan kaldırılınca hedef deviceRemoved → devir ilerler.
- Hedefsiz kişi → doğrudan done. Geç başarılı ack `failed` hedefi confirmed yapar.
- Kapılar (fix-ortak.md) + `vitest run convex/employeeTransfer.test.ts convex/employeeTermination.test.ts convex/employees*.test.ts convex/employeeAuth*.test.ts convex/ideSync*.test.ts convex/hikvisionSync*.test.ts convex/accessGrantStatus.test.ts convex/devices*.test.ts src/components/audit` (var olanlar) yeşil.

commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK. Belirsiz yerde `ask` ile koordinatöre sor; varsayımını rapora yaz.

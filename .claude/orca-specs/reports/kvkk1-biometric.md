# KVKK Faz 1 — Worker A / Biyometri modülü

## Değişiklikler
- `convex/privacyBiometric.ts:11`: admin rolü + `getProjectIdsForUser` ile proje erişimi, kodlu Türkçe hatalar.
- `convex/privacyBiometric.ts:17`: durum/gerekçe/değişiklik/legacy sorgusu; eksik satır veya eksik biometricEnabled eski açık ayar sayılır.
- `convex/privacyBiometric.ts:29`: açmada kırpılmış 3–500 karakter gerekçe, kapatmada isteğe bağlı gerekçe; imha sürerken açma kilidi; aynı duruma yazma no-op; kısmi upsert ve eski/yeni audit.
- `convex/lib/biometricGate.ts:6`: kapalı projede `BIOMETRIC_DISABLED`; projesiz/eski satırsız kayıtta sözleşmenin eski açık davranışı.
- `convex/lib/biometricGate.ts:28`: kuyruk payload'ından çalışan kimliği daraltılır, çalışanın güncel projesi DB'den okunur.
- `convex/employeeFaces.ts:51`, `convex/employeeFingerprints.ts:44`: biyometrik eklemeler rıza/veri yazımı öncesinde kapıdan geçer; silmeler değiştirilmedi.
- `convex/employeeConsents.ts:48`: yalnız yeni biyometrik rıza kaydına kapı; kart/fotoğraf ve geri alma değişmedi.
- `convex/projects.ts:54`: yeni proje aynı transaction içinde biyometri kapalı ayarla oluşturulur ve privacy oluşturma audit'i yazılır.
- `convex/hikvisionSync.ts:403`: biyometrik enqueue cihaz ve çalışan projesi üzerinden reddedilir.
- `convex/hikvisionSync.ts:513`: claim sırasında güncel cihaz/çalışan projesi kontrol edilir; engellenen eklemeler failed olur, silmelerin pending penceresini tıkamaz.
- `convex/hikvisionSync.ts:718`, `:974`: otomatik retry adayları kapalı modülü atlar; manuel yeniden enqueue kapalıyken reddedilir.
- `convex/hikvisionSync.ts:998`, `convex/actions/hikvisionSync.ts:757`, `:788`, `:897`, `:925`: önceden schedule edilmiş yüz/parmak gönderimleri action girişinde ve her cihaz isteğinden hemen önce yeniden kontrol edilir.
- `convex/_generated/api.d.ts`: yalnız Worker A'nın `privacyBiometric` import/kayıt satırları eklendi.
- `src/components/settings/sections/privacy/BiometricModuleCard.tsx:23`: durum, eski ayar notu, gerekçe ve son tarih; gerekçeli dialog, sabit uyarı, kapatma için ConfirmDestructive, async kilidi, SettingsFormState ve taslak kapatma koruması. Proje değişimi iç formu key ile sıfırlar.
- `src/components/employees/EmployeeConsentsCard.tsx:31`, `:118`, `:120`, `:209`: yalnız erişim kontrolü metinleri ve açılır/kopyalanabilir şablon; mevcut rıza verme/geri alma UI mantığı korunur.
- `src/lib/consentNotice.ts:2`: veri sorumlusu, somut amaç, hukuki şartın kurumca belirlenmesi, aktarım, alternatif erişim, saklama/imha, haklar/başvuru alanlı sabit taslak; danışmana doğrulatma notu.
- `convex/lib/biometricGate.test.ts`, `src/lib/consentNotice.test.ts`, `src/components/settings/sections/privacy/BiometricModuleCard.test.tsx`: kapı/gerekçe/kuyruk çalışan projesi/imha kilidi ve metin/durum testleri.

## Tam fonksiyon imzaları
Aşağıdaki endpoint dönüşleri istemci `FunctionReturnType` değerleridir; server handler'ları `Promise<...>` döndürür. Var olan endpoint argümanları/dönüşleri değiştirilmedi.

```ts
requireProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<void>
assertBiometricAllowed(ctx: QueryCtx | MutationCtx, projectId: Id<"projects"> | undefined): Promise<void>
biometricReason(enabled: boolean, reason: string | undefined): string
isBiometricAddition(operation: string): boolean
biometricPayloadProject(ctx: QueryCtx | MutationCtx, payload: unknown): Promise<Id<"projects"> | undefined>
getBiometricModule(args: { projectId: Id<"projects"> }): {
  enabled: boolean; reason: string | null; changedAt: string | null;
  changedBy: Id<"users"> | null; legacy: boolean;
}
setBiometricModule(args: { projectId: Id<"projects">; enabled: boolean; reason?: string }): null
assertBiometricSyncAllowed(args: { employeeId: Id<"employees">; deviceId?: Id<"devices"> }): null
addFace(args: { employeeId: Id<"employees">; storageId: Id<"_storage"> }): Id<"employeeFaces">
addFingerprint(args: { employeeId: Id<"employees">; fingerPrintID: number; fingerData: string; fingerType?: string }): null
grant(args: { employeeId: Id<"employees">; consentType: "biometric_face" | "biometric_fingerprint" | "card" | "photo"; documentUrl?: string; notes?: string }): Id<"employeeConsents">
create(args: { name: string; description?: string; isActive?: boolean }): Id<"projects">
syncEmployeeFaceToDevicesInternal(args: { employeeId: Id<"employees">; allowedProjectIds?: Id<"projects">[] }): { synced: number; failed: number; errors: string[] }
syncEmployeeFingerprintToDevicesInternal(args: { employeeId: Id<"employees">; fingerPrintID: number; allowedProjectIds?: Id<"projects">[] }): { synced: number; failed: number; errors: string[] }
validBiometricReason(enabled: boolean, reason: string): boolean
BiometricModuleCard(props: { projectId: Id<"projects"> }): React.JSX.Element
BiometricModuleForm(props: { projectId: Id<"projects"> }): React.JSX.Element
```

Karmaşık mevcut kuyruk sözleşmeleri için tam türler (yeniden tanım/kopya yok):
```ts
type EnqueueArgs = FunctionArgs<typeof internal.hikvisionSync.enqueueLocalBridgeOperation>;
// { deviceId: Id<"devices">; runId?: Id<"deviceSyncRuns">; projectId?: Id<"projects">;
//   operation: mevcut hikOperationValidator birleşimi; payload: mevcut v.any() }
type EnqueueReturn = FunctionReturnType<typeof internal.hikvisionSync.enqueueLocalBridgeOperation>; // Id<"hikPendingOperations">
type ClaimArgs = { token: string; max?: number };
type ClaimReturn = FunctionReturnType<typeof internal.hikvisionSync.claimLocalBridgeOperations>;
type RetryCandidatesArgs = { limit: number; maxAttempts: number; onlineWindowMs: number };
type RetryCandidatesReturn = FunctionReturnType<typeof internal.hikvisionSync.listRetryCandidates>;
type RetryIssueArgs = { issueId: Id<"hikPendingOperations"> };
type RetryIssueReturn = { queued: boolean };
// Yukarıdaki FunctionArgs/FunctionReturnType convex/server'dan, internal _generated/api'den gelir.
```

## Koordinatörün gerçek oturumda kontrol etmesi gerekenler
1. `/settings?tab=privacy`: eski satırsız proje Açık + eski ayar notu; yeni proje Kapalı. Worker C ayarı satır oluşturmuş ama biometricEnabled vermemişse de eski ayar notu görünmeli.
2. Açma dialog'u: boş/2 karakter gerekçe ile kaydet kapalı; 3–500 karakter + tam uyarı; başarılı kayıtta gerekçe/tarih güncellenir. Yetkisiz proje çağrısı kodlu hata olmalı.
3. Dialog taslağında ayarlar sekmesi/proje değişimi, kapat/Esc/dış tıklama ve işlem beklerken tekrar tıklama; 390px görünüm ve klavye odağı.
4. Kapatma: ikinci onay ve mevcut verileri silmez açıklaması; kapalıyken yüz/parmak ekleme ve yeni biyometrik rıza reddedilmeli; mevcut yüz/parmak silme ve rıza geri alma çalışmalı.
5. Kapalı cihaz/çalışan projesinde kuyruk enqueue/retry/claim ve önceden schedule edilmiş gönderimler engellenmeli; deleteFace/deleteFingerprint kuyrukları işlemeye devam etmeli. İmha sürerken yeniden açma `BIOMETRIC_DESTRUCTION_ACTIVE` vermeli.
6. Çalışan rıza kartında şablonu aç/kopyala, kurum alanlarını gözden geçir; rıza verme/geri alma akışları korunmalı.

## Bilerek kapsam dışında / sınırlar
- İmha aracı Worker B, saklama ve asistan Worker C. Ortak schema/privacySettings/shell değiştirilmedi. PDKS hesapları ve pdksSource değiştirilmedi.
- Canlı DB, giriş, cihaz çağrısı, migration, build, deploy ve commit çalıştırılmadı. UI statik render ile test edildi; tarayıcı/390px ve cihazda gerçek akış kontrolü koordinatöre bırakıldı.
- Başlamış/bridge'e teslim edilmiş fiziksel cihaz isteği sonradan geri alınamaz; güncel ayar gönderim sınırlarında yeniden okunur. Modül kapatma otomatik imha yapmaz.
- Mevcut sınırsız sorgular ve existing payload `v.any()` sözleşmesi bu dar kapı değişikliğinde yeniden tasarlanmadı; yeni sorgu erişimleri sınırlı tekil okumadır.

## Doğrulama
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: son koşum exit 0 (B kilit dosyası geldikten sonra).
- App tsc: son koşum tüm proje 0 tanı; sahip olunan dosya/proje kapsamı süzmesi de 0 hata.
- `node_modules/.bin/eslint` yalnız sahip olunan 14 TS/TSX dosyası: exit 0, hata/uyarı yok.
- `node_modules/.bin/vitest run convex/lib/biometricGate.test.ts src/lib/consentNotice.test.ts src/components/settings/sections/privacy/BiometricModuleCard.test.tsx`: 3 dosya, 13 test geçti. Aktif imhada açma reddi ve gerçek kapatma audit yazımı da kapsandı.
- `git diff --check`: exit 0.
- B kilit dosyası henüz yokken yapılan ara koşumda eksik import/test hatası görüldü; dosya geldikten sonra son Convex tsc ve 13 test yeşil. Açık entegrasyon bağımlılığı kalmadı.

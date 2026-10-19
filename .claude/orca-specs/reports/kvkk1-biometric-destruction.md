# KVKK Faz 1 — Worker B: biyometrik imha

## Sonuç ve kapsam

Proje yetkili admin için kuru sayım → gerekçe/tam proje adı onayı → biyometri kapalı kontrolü → kalıcı run/kilit → cihaz snapshot/kuyruk → küçük Convex silme partileri → cihaz onayı/tutanak akışı eklendi. Canlı DB/cihaz çağrısı, login, deploy, migration, commit veya paket kurulumu yapılmadı. Cihaz tarafındaki mevcut fonksiyonların snapshot/bridge eksiği nedeniyle koordinatörün açık onayıyla yeni action, mevcut bridge enqueue mutation'ını ve gateway biometrics yardımcılarını çağırır; Worker A dosyaları değiştirilmedi.

## Dosyalar

- `convex/biometricDestruction.ts:17`: admin proje yetkisi, sınırlı sayım, tam ad/gerekçe kontrolü, auditLog tabanlı run/kilit, kayıt+dosya silme, queue sonuçları ve watchdog.
- `convex/actions/biometricDestruction.ts:11`: Node action; silmeden önce kalıcı scheduler snapshot'ı, beş hedefli paralel gruplar, bridge enqueue ve gateway çağrıları. Cihaz hatası Convex imhasını geri almaz.
- `convex/lib/biometricDestruction.ts:4`: sınırlar, tür normalizasyonu, saf sayım/plan/onay/özet/tutanak mantığı, runtime run şeması, snapshot validator'ları.
- `convex/lib/biometricDestructionState.ts:5`: koordinatörün ek ownership izniyle Worker A'nın kullandığı `hasActiveDestructionRun` yeniden açma kilidi.
- `convex/lib/biometricDestruction.test.ts:1`: saf mantık + gerçek handler gövdelerinin mock DB/storage/scheduler ile testleri; gerçek DB kullanılmaz.
- `src/components/settings/sections/privacy/BiometricDestructionCard.tsx:22`: sayım öncesi ve yanlış ad/gerekçede kapalı destructive eylem, ConfirmDestructive, useAsyncAction/notify, ilerleme ve son tutanak. Proje değişiminde key ile taslak sıfırlanır. DS-K2804 cihaz desteği eksikliği açıkça belirtilir.
- `src/components/settings/sections/privacy/BiometricDestructionCard.test.tsx:1`: SSR onay alanı ve düğme korumaları.
- `convex/_generated/api.d.ts`: yalnız `biometricDestruction` ve `actions/biometricDestruction` import/map satırları eklendi; diğer worker satırları korunur.

## Tam argüman / dönüş sözleşmeleri

Aşağıdaki imzalarda `Id<T>` Convex kimliği, `Kind = "face" | "fingerprint"`, dönen `void` Convex RPC üzerinde `null` demektir.

```ts
type State = {
  version: 1; projectName: string; kinds: Kind[]; reason: string;
  startedAt: number; finishedAt: number | null;
  status: "running" | "waitingDevices" | "completed" | "failed";
  phase: Kind; cursor: string | null; batch: number; heartbeatAt: number;
  deletedFaces: number; deletedFingerprints: number; deletedFiles: number;
  deviceOperations: number; deviceFailures: number; deviceUnconfirmed: number;
  pendingDeviceChecks: number; skippedChanged: number; error: string | null;
};
type Report = {
  projectId: string; kinds: Kind[]; silinenYuz: number; silinenParmak: number;
  silinenDosya: number; cihazOpSayisi: number; cihazHata: number;
  cihazDogrulanamayan: number; baslangic: number; bitis: number | null;
  gerekce: string; durum: State["status"]; degistigiIcinAtlanan: number;
};
type Target = { deviceId: Id<"devices">; hikDevIndex?: string; hikTransport?: "gateway" | "localBridge" };
type Item = {
  kind: Kind; employeeId: Id<"employees">; faceId?: Id<"employeeFaces">;
  fingerprintId?: Id<"employeeFingerprints">; storageId?: Id<"_storage">;
  fingerPrintID?: number; addedAt: number; cardNumber: string;
  targets: Target[]; unconfirmed: number;
};
type Preview = {
  faceCount: number; fingerprintCount: number; employeeCount: number;
  storageFileCount: number; capped: boolean; projectName: string; biometricEnabled: boolean;
};

// Public adminQuery/adminMutation
previewBiometricDestruction(args: { projectId: Id<"projects">; kinds: Kind[] }): Promise<Preview>;
startBiometricDestruction(args: { projectId: Id<"projects">; kinds: Kind[]; confirmText: string; reason: string }): Promise<Id<"auditLog">>;
getDestructionRun(args: { projectId: Id<"projects">; runId?: Id<"auditLog"> }): Promise<(State & { runId: Id<"auditLog">; userName: string; report: Report }) | null>;

// Internal functions
prepareBatch(args: { runId: Id<"auditLog"> }): Promise<void>;
isBatchActive(args: { runId: Id<"auditLog">; batch: number }): Promise<boolean>;
createGatewayOperation(args: { runId: Id<"auditLog">; batch: number; deviceId: Id<"devices">; hikDevIndex?: string; employeeId: Id<"employees">; cardNumber: string; kind: Kind; fingerPrintID?: number }): Promise<Id<"hikPendingOperations"> | null>;
queueBridgeOperation(args: { runId: Id<"auditLog">; batch: number; deviceId: Id<"devices">; employeeId: Id<"employees">; cardNumber: string; kind: Kind; fingerPrintID?: number }): Promise<Id<"hikPendingOperations"> | null>;
finishGatewayOperation(args: { runId: Id<"auditLog">; opId: Id<"hikPendingOperations">; ok: boolean }): Promise<void>;
finishBatch(args: { runId: Id<"auditLog">; batch: number; item: Item; deviceOperations: number; deviceFailures: number; deviceUnconfirmed: number; queuedOpIds: Id<"hikPendingOperations">[] }): Promise<void>;
checkDeviceOperations(args: { runId: Id<"auditLog">; checkId: Id<"auditLog">; opIds: Id<"hikPendingOperations">[]; deadline: number }): Promise<void>;
watchRun(args: { runId: Id<"auditLog"> }): Promise<void>;
// Node internalAction
 destroyBatch(args: { runId: Id<"auditLog">; batch: number; projectId: Id<"projects">; item: Item }): Promise<void>;

// Exported pure/shared helpers
normalizeKinds(kinds: readonly Kind[]): Kind[];
validateDestructionInput(projectName: string, confirmText: string, reason: string, kinds: readonly Kind[]): string | null;
splitDestructionBatches<T>(items: readonly T[], size?: number): T[][];
summarizePreview(faces: readonly { employeeId: string; pictureStorageId: string }[], fingerprints: readonly { employeeId: string }[], kinds: readonly Kind[], limit?: number): Omit<Preview, "projectName" | "biometricEnabled">;
initialDestructionState(projectName: string, kinds: Kind[], reason: string, now: number): State;
destructionReport(projectId: string, state: State): Report;
destructionSummary(state: Pick<State, "deletedFaces" | "deletedFingerprints" | "deletedFiles" | "deviceOperations" | "deviceFailures" | "deviceUnconfirmed">): string;
hasActiveDestructionRun(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<boolean>;

// Private backend helpers
requireProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<Doc<"projects">>;
latestRun(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<Doc<"auditLog"> | null>;
readRun(ctx: QueryCtx | MutationCtx, runId: Id<"auditLog">): Promise<{ row: Doc<"auditLog">; projectId: Id<"projects">; state: State } | null>;
saveState(ctx: MutationCtx, row: Doc<"auditLog">, state: State, note: string): Promise<void>;
settleIfReady(ctx: MutationCtx, row: Doc<"auditLog">, state: State): Promise<void>;

// UI
BiometricDestructionCard(props: { projectId: Id<"projects"> }): JSX.Element;
BiometricDestructionForm(props: { projectId: Id<"projects"> }): JSX.Element;
DestructionConfirmationFields(props: {
  preview: Preview | null; kinds: Kind[]; reason: string; confirmText: string;
  busy: boolean; moduleEnabled: boolean; onReason: (value: string) => void;
  onConfirmText: (value: string) => void; onContinue: () => void;
}): JSX.Element;
```

## Kalıcılık ve güvenlik

- `biometricDestructionRun` auditLog satırı operasyon durumu olarak güncellenir; `biometricDestruction` hedefli ayrı append-only `writeAudit` kayıtları başlangıç, ilerleme ve bitiş kanıtıdır. Proje/başlatan/gerekçe ve istenen Türkçe tutanak anahtarları tutulur. Yeni tablo yok.
- Proje kapsamı `getProjectIdsForUser`, admin wrapper ile doğrulanır; yanlış proje runId okuması null döner. Aynı proje için aktif run ikinci başlangıcı reddeder. Modül açık ise `BIOMETRIC_MODULE_ACTIVE`.
- Şablonlar `by_project` üzerinden başlangıç zamanına kadar cursor ile tekli partilerde yürür. Yeni/değişmiş şablonlar silinmez; değişen sürüm sayacı tutulur. Çalışan/kart/rıza/okuma geçmişi ve profil fotoğrafı kayıtlarına yazılmaz.
- Yüz dosyası mevcutsa silinir; `employees.by_photo_storage` referansı varsa profil dosyası korunur. Eksik storage dosyası atlanır.
- Cihaz hedefleri yalnız mevcut grup üyeliğiyle sınırlı değil, aynı projenin tüm cihazlarıdır; eski kuraldan çıkmış cihazlar da kapsanır. Queue yazmadan önce cihazın hâlâ aynı projede olması tekrar kontrol edilir.
- Gateway hatası başarısız kuyruk kanıtı bırakır. Genel gateway retry worker güncel/mutable kart numarası okuduğundan bu run'ın hatalı gateway op'ları `attemptCount: 5` ile terminal bırakılır; dondurulmuş kart yerine sonradan değişen kartın hedeflenmesi önlenir.
- Bridge ack beklenirken Convex silme diğer partilerde sürer. Ack gelene kadar başarı sayılmaz; 24 saat sonunda pending/kayıp op `cihazDogrulanamayan`, açık failed op `cihazHata` olur. Sayım ve son tutanak farklı zaman anlarını yansıtır.
- 10 dakika ilerlemeyen action watchdog ile failed olur; silinmiş toplamlar korunur, son cihaz partisi doğrulanamadı olarak görünür. Tamamlanmış batch tekrar teslim edilirse batch numarası sayacı çift silme/toplama engeller.
- Worker A kontrol edildi: bridge claim sırasında kapalı modül addFace/addFingerprint op'ları failed edilip atlanıyor; gateway retry listesi cihaz/çalışan projesi kapısını uyguluyor; doğrudan sync her hedefte izin sorguluyor.

## Bilinen sınırlar / koordinatör onayı

- **Koordinatör 50 cihaz sınırını Faz 1 için açıkça kabul etti; cursor cihaz alt-partisi yapılmamasını istedi.** Projedeki toplam cihaz sayısı 50'yi aşarsa şablon silmeden (o parti için) failed ve destek yönlendirmesi gelir. Şablon toplamında bu sınır yok. Önizleme tür başına 500 kayıt ve fingerprint okumasında 2MB ile sınırlı; `capped: true` alt sınırdır.
- **DS-K2804: cihazdan silme yok, kuyruk+tutanak çalışıyor, cihazDogrulanamayan sayısı gösterilir.** Mevcut `bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:73` biometric delete için explicit deferred failure döndürür. Bu cevap geldiğinde `cihazHata`, cevap gelmezse `cihazDogrulanamayan` artar; UI her ikisini gösterir ve adaptörün destek eksikliğini açıklar. Bridge geliştirmesi kapsam dışıdır.
- İmha başlarken hâlihazırda cihazda uygulanmakta olan eski ekleme işlemi için dağıtık cihaz transaction'ı yoktur; modül kapısı yeni enqueue/claim/sync'i engeller. Gerçek cihaz doğrulaması gereklidir.
- Silinen şablonu saklayarak cihaz yeniden denemesi yapılmaz. Gateway hataları veya doğrulanamayan cihazlarda operatör cihaz incelemesi gerekir. Bu durum “başarı” diye raporlanmaz.
- `hasActiveDestructionRun` koordinatör sözleşmesine göre 24 saatten eski running run'ı bayat sayar; waitingDevices son kontroller bitene kadar kilitler.
- Oturum açılıp 390px tarayıcı denemesi yapılmadı (yasak). Min-width, flex-wrap, break-words ve tek kolon alanları kullanıldı; gerçek responsive kontrol koordinatörde.

## Doğrulama / gerçek oturumda kontrol

Yerel kapılar: Convex tsc sıfır; app tsc kapsam filtresi sıfır (son log bütünü de boş); kendi dosyalarına ESLint sıfır; iki Vitest dosyasında 21 test geçti; git diff --check temiz. Backend testleri mock context üzerinden gerçek handler gövdelerini çağırır; Convex server entegrasyonu ve fiziksel cihaz testi değildir. Paket yüklenmedi.

Koordinatör test projesinde: (1) yetkisiz kullanıcı/proje ve açık modül engeli; (2) tür değişince sayım/onayın sıfırlanması ve tam proje adı; (3) yüz-only/parmak-only/birlikte ve storage yok/profil ortak dosya; (4) aynı projede ikinci run ve modül yeniden açma kilidi; (5) gateway success/failure, bridge pending/failed/done ve desteklenmeyen DS-K2804 açıklaması; (6) sayfa yenilemede son run/tutanak; (7) >50 cihaz fail-closed/destek açıklaması; (8) 390px uzun proje/gerekçe/tutanak. Canlı şablon imhası bu worker tarafından çalıştırılmadı.

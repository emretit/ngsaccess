# KVKK Faz 1 Düzeltme-1 — İmha aracı

## Sonuç

Y2, D3, O2, O4, D4 ve UI #3/#6/#8/#10 düzeltildi. Şema, ortak privacySettings, diğer worker dosyaları, bridge uygulaması ve PDKS kaynak filtresi değiştirilmedi. Commit/push/deploy/migration, canlı DB erişimi, login veya paket kurulumu yapılmadı.

## Değişen dosyalar

- `convex/biometricDestruction.ts:33`: ilerleme yalnız state patch; terminal hata/bitişte tek cihaz özetli tutanak. Başlangıçta 1 durum + 1 başlangıç satırı, sonunda 1 bitiş/hata satırı: toplam 3 auditLog satırı; şablon ve cihaz sayısından bağımsız.
- `convex/biometricDestruction.ts:51`: önizlemede projenin ilk 50 çalışanından `by_employee` ile projesiz şablon örneklemi; ayrı `projectlessTemplateCount`. Tüm sayılar mevcut `capped` ile alt sınır olarak işaretlenir.
- `convex/biometricDestruction.ts:110`: her türün proje index taramasından sonra çalışanlar `employees.by_project` üzerinden tekli sayfalanır; eski şablonlar `by_employee` üzerinden tekli sayfalanır. Snapshot öncesi ve gerçek silmede çalışanın hedef projede olması tekrar doğrulanır. Başka projeye atanmış şablon eski şablon kabul edilmez.
- `convex/biometricDestruction.ts:201`: gateway/bridge enqueue ve gateway bitişindeki audit satırları kaldırıldı; kuyruk operasyon kayıtları korunur.
- `convex/biometricDestruction.ts:244`: her şablonda check satırı/zinciri oluşturmak kaldırıldı. Run state son 500 bekleyen op kimliğini tutar; taşan kimlikler doğrulanamayan sayacına eklenir.
- `convex/biometricDestruction.ts:282`: bütün şablon taraması bitince run başına tek cihaz kontrol zinciri; aralık 30 sn, 5 dk, 5 dk, sonra 30 dk. Attempt numarası aynı teslimin ikinci zincir açmasını önler. Bridge veya cihaz heartbeat'i yok/eskiyse (10 dk) ilk kontrolde doğrulanamayan; bağlı ama sonuç vermeyen cihazda 24 saat sınırı. Sonuçlar toplanır, terminal run completed olur.
- `convex/lib/biometricDestruction.ts:7`: kontrol sınırları ve saf gecikme hesabı; `:51` geriye dönük default'lu state alanları; `:101` özet artık açıkça “Convex'ten silindi”, sıfır cihaz operasyonunda ayrıca cihaz silmesi gerekli.
- `convex/lib/biometricDestructionState.ts:5`: running kilidi startedAt yerine son 30 dk heartbeat; sağlıklı 25 saatlik run kilitli kalır.
- `convex/lib/auditLogQuery.test.ts:65`: koordinatörün `msg_d6591b8d81a6` mesajıyla verdiği ek sahiplik izni kapsamında beklenen hedef listesine 5 imha hedefi eklendi.
- `convex/lib/auditLogQuery.ts:3`: yalnız AUDIT_TARGET_LABELS değişti; biometricDestructionRun/biometricDestruction/biometricDestructionCheck ve gerçek eski DeviceCheck/Device hedeflerine Türkçe etiketler.
- `src/components/settings/sections/privacy/BiometricDestructionCard.tsx:20`: cihaz sonucu doğru rozet; `:29` diyalog metni 160 karakter özet + 24 karakterde kırılma noktası, tam gerekçe backend/tutanakta korunur; `:84` dirty/pending Settings'e bildirilir; `:109` projesiz uyarı; `:116/:132` onay hatası hem kartta role=alert hem açık diyaloğun etki listesinde görünür. Hikvision dışı cihazların hedeflenmediği açıklandı. Sınırlı sayımda sıfır görünse bile taranmayan eski şablonlar için onay mümkün; tam sayım sıfırsa düğme pasif.
- `convex/lib/biometricDestruction.test.ts:155`: heartbeat kilidi; `:207` 500 şablon, 51 kontrol, offline tek kontrol, bounded-tail, duplicate delivery, sabit audit sayısı; `:296` projesiz önizleme/işleme alma/proje taşıma koruması.
- `src/components/settings/sections/privacy/BiometricDestructionCard.test.tsx:23`: sınırlı sıfır sayım; `:33` cihaz rozet metni ve uzun boşluksuz diyalog metni.

`convex/actions/biometricDestruction.ts` okundu ve lint kapısına dahil edildi; değişmesi gerekmedi.

## Tam sözleşmeler

Public argümanlar korunur. `void` RPC üzerinde null olur. Tipler:

```ts
type Kind = "face" | "fingerprint";
type State = {
  version: 1; projectName: string; kinds: Kind[]; reason: string;
  startedAt: number; finishedAt: number | null;
  status: "running" | "waitingDevices" | "completed" | "failed";
  phase: Kind; cursor: string | null; batch: number; heartbeatAt: number;
  scan: "project" | "legacy"; employeeCursor: string | null;
  legacyEmployeeId: string | null; pendingOpIds: string[];
  deviceCheckAttempt: number; deviceCheckDeadline: number | null;
  deletedFaces: number; deletedFingerprints: number; deletedFiles: number;
  deviceOperations: number; deviceFailures: number; deviceUnconfirmed: number;
  pendingDeviceChecks: number; skippedChanged: number; error: string | null;
};
type Preview = {
  faceCount: number; fingerprintCount: number; employeeCount: number;
  storageFileCount: number; capped: boolean; projectName: string;
  biometricEnabled: boolean; projectlessTemplateCount: number;
};
type Report = {
  projectId: string; kinds: Kind[]; silinenYuz: number; silinenParmak: number;
  silinenDosya: number; cihazOpSayisi: number; cihazHata: number;
  cihazDogrulanamayan: number; baslangic: number; bitis: number | null;
  gerekce: string; durum: State["status"]; degistigiIcinAtlanan: number;
};
type Item = {
  kind: Kind; employeeId: Id<"employees">; faceId?: Id<"employeeFaces">;
  fingerprintId?: Id<"employeeFingerprints">; storageId?: Id<"_storage">;
  fingerPrintID?: number; addedAt: number; cardNumber: string;
  targets: { deviceId: Id<"devices">; hikDevIndex?: string; hikTransport?: "gateway" | "localBridge" }[];
  unconfirmed: number;
};

previewBiometricDestruction(args: { projectId: Id<"projects">; kinds: Kind[] }): Promise<Preview>;
getDestructionRun(args: { projectId: Id<"projects">; runId?: Id<"auditLog"> }): Promise<(State & { runId: Id<"auditLog">; userName: string; report: Report }) | null>;
startBiometricDestruction(args: { projectId: Id<"projects">; kinds: Kind[]; confirmText: string; reason: string }): Promise<Id<"auditLog">>;
prepareBatch(args: { runId: Id<"auditLog"> }): Promise<void>;
createGatewayOperation(args: { runId: Id<"auditLog">; batch: number; deviceId: Id<"devices">; hikDevIndex?: string; employeeId: Id<"employees">; cardNumber: string; kind: Kind; fingerPrintID?: number }): Promise<Id<"hikPendingOperations"> | null>;
queueBridgeOperation(args: { runId: Id<"auditLog">; batch: number; deviceId: Id<"devices">; employeeId: Id<"employees">; cardNumber: string; kind: Kind; fingerPrintID?: number }): Promise<Id<"hikPendingOperations"> | null>;
finishGatewayOperation(args: { runId: Id<"auditLog">; opId: Id<"hikPendingOperations">; ok: boolean }): Promise<void>;
finishBatch(args: { runId: Id<"auditLog">; batch: number; item: Item; deviceOperations: number; deviceFailures: number; deviceUnconfirmed: number; queuedOpIds: Id<"hikPendingOperations">[] }): Promise<void>;
checkDeviceOperations(args: { runId: Id<"auditLog">; attempt?: number; checkId?: Id<"auditLog">; opIds?: Id<"hikPendingOperations">[]; deadline?: number }): Promise<void>;

saveState(ctx: MutationCtx, row: Doc<"auditLog">, state: State, note: string): Promise<void>;
settleIfReady(ctx: MutationCtx, row: Doc<"auditLog">, state: State): Promise<void>;
// prepareBatch içindeki iki yerel yardımcı; closure üzerinden ctx/run/state kullanırlar:
continueScan(): Promise<void>;
finishKind(): Promise<void>;
hasActiveDestructionRun(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<boolean>;
deviceCheckDelay(attempt: number): number;
initialDestructionState(projectName: string, kinds: Kind[], reason: string, now: number): State;
destructionSummary(state: Pick<State, "deletedFaces" | "deletedFingerprints" | "deletedFiles" | "deviceOperations" | "deviceFailures" | "deviceUnconfirmed">): string;

destructionStatusLabel(run: { status: string; deviceOperations: number; deviceFailures: number; deviceUnconfirmed: number }): string;
dialogExcerpt(text: string): string;
BiometricDestructionCard(props: { projectId: Id<"projects"> }): JSX.Element;
BiometricDestructionForm(props: { projectId: Id<"projects"> }): JSX.Element;
DestructionConfirmationFields(props: {
  preview: Preview | null; kinds: Kind[]; reason: string; confirmText: string;
  busy: boolean; moduleEnabled: boolean; onReason: (value: string) => void;
  onConfirmText: (value: string) => void; onContinue: () => void;
}): JSX.Element;
```

## Kanıt / kapılar

- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: exit 0.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: son koşum exit 0, tüm çıktı boş; kapsam filtresine ihtiyaç kalmadı. Önceki replaceAll ES hedef hatası split/join ile giderildi, tsconfig değiştirilmedi.
- Sahip olunan sekiz TS/TSX dosyası + değişmeyen action üzerinde ESLint: exit 0, hata/uyarı yok.
- İki test dosyasında **33/33** geçti; backend handler'ları mock ctx ile çalıştırıldı (gerçek Convex/cihaz entegrasyonu değil).
- 500 şablon tamamlamasında **0 ayrı poll planı**, tarama sonunda **1 zincir**; 24 saat bekleyen 500 operasyon için **51 kontrol çağrısı**. Offline ilk kontrolde completed, yeniden planlama yok. 500 ilerlemede 0 audit, finalde 1 audit; ayrıca gerçek start handler testi 2 başlangıç + 1 bitiş = **3 satır** doğrular.
- Koordinatörün ek isteğiyle tüm Convex testleri de koşuldu: **64 dosya, 859/859 test geçti** (`/tmp/kvkk1-fix-destroy-convex-vitest.log`); auditLogQuery.test.ts ESLint exit 0.
- `git diff --check`: exit 0. Vite build çalıştırılmadı.

## Sınırlar / bilinçli ertelenenler

1. Bekleyen işlem listesi son **500 kimlikle** sınırlıdır; taşanların sonucu artık izlenmez ve hemen **doğrulanamayan** sayılır. Böylece 500×50 cihaz için çağrı ve okuma yükü sınırlı kalır; tutanak başarı iddiasında bulunmaz. Tüm işlemler için eksiksiz cihaz ack muhasebesi istenirse index'li ayrı operasyon/run modeli gerekir (bu görevin schema sınırı dışında).
2. Önizleme ilk 50 çalışanı, çalışan başına 2 yüz / 11 parmak satırını örnekler; sınıra gelince `capped=true`. İmha bu örneklemle sınırlı değildir. Proje ID'siz ama çalışanı kayıp ya da başka projede olan satırlar hedeflenmez.
3. Cihaz kontrol zinciri Convex şablon taraması bittikten sonra başlar. Kuyruğa yazma/şablon silme action sayısı hâlâ şablon ve cihaz sayısıyla büyür; kaldırılan büyüme uzun süreli poll ve audit çoğalmasıdır. 50 cihaz sınırı, mevcut tekli şablon partileri ve watchdog korunur.
4. Eski `checkId/opIds/deadline` argümanları validator seviyesinde kabul edilir fakat eski şablon başına zincir çağrıları yeni zincir açmadan döner. Henüz yayınlanmamış önceki implementasyondan canlı aktif run olmadığı görev bağlamına dayanıldı; böyle bir run varsa yayın öncesi koordinatör ayrıca değerlendirmeli (migration yapılmadı).
5. DS-K2804 bridge silme desteği ve Hikvision dışı cihaz silmesi kapsam dışı. Offline/taşma ile doğrulanamayan olarak kapanan işlemler kuyruktan silinmez; sonraki bridge sonucu bu bitmiş tutanağı güncellemez. Ekran bunu başarı saymaz.
6. 390px gerçek tarayıcı, yetkili kullanıcı akışı ve fiziksel cihazlar denenmedi; uygulamaya login yasaktı. Hukuki iddia eklenmedi, danışman notu korundu.

## Koordinatörün gerçek oturum kontrolü

- 390px: sıfır Hikvision cihazı olan projede rozet ve özet; 500 karakter boşluksuz gerekçe; uzun proje adı; hata sonrası açık diyalog içinde hata mesajı ve tekrar deneme.
- Gerekçe/proje adı kirliyken sekme/proje geçişi ve sayım/başlatma pending durumunda Settings koruması.
- Projesiz yüz ve parmak şablonu sayımı, yalnız projedeki çalışanların silinmesi, çalışan işlem sırasında taşınırsa silmenin engellenmesi; 50'den fazla çalışanlı projede `capped` açıklaması.
- Bridge heartbeat yok/eski, bridge online ama cihaz offline, ikisi online ve done/failed/pending; offline sonucu tek kontrolde completed + doğrulanamayan.
- 24 saati geçmiş ama ilerleyen run'da modül açma kilidi; bitişte audit sayısı ve Türkçe etiketler; 500 üzeri op durumunda doğrulanamayan sayısı.

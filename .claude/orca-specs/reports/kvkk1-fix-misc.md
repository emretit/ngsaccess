# KVKK Faz 1 — Düzeltme-2

İstenen Y1/Y3/O1/O3/O5/D1/D2/D5 ve FE YÜKSEK-1/2, #4/#5/#7/#9 düzeltmeleri uygulandı. Mevcut public imzalar korundu; şema, imha uygulaması, bridge, PDKS kaynak süzgeci ve kapsam dışı sayfalara yazılmadı. Commit/push/deploy/migration, paket kurulumu, canlı veri erişimi ve uygulamaya giriş yapılmadı.

## Dosya ve davranış

- `convex/onboarding.ts:56,146`: iki proje oluşturma yolunda aynı mutation içinde `biometricEnabled:false` gizlilik satırı ve `create` audit yazılır. Self-signup audit aktörü kullanıcı; secret ile çalışan mevcut atama yolunda sistem (`user:null`).
- `convex/actions/openaiChat.ts:61`: `projectId` yoksa mevcut `internal.users.listProjectIdsForCurrentUser` (sunucudaki `getProjectIdsForUser`) çağrılır. Tam bir projede o proje ve zorunlu maskeli sunucu bağlamı kullanılır; sıfır/çoklu projede OpenAI çağrısı yapılmadan istenen yenileme mesajı döner. İstemci `dbContext` alanı yok sayılır; `source` sözleşmesi korunur.
- `convex/privacyRetention.ts:61`: internal bağlam sorgusuna opsiyonel `forceMaskNames` eklendi. Eski istemci bu bayrağı true verir; proje izni yine sunucuda doğrulanır. Personel kimlikleri örneklemden çıkarılmaya devam eder.
- `convex/actions/getChatData.ts:46`: kullanıcı tablosundaki adlar maskelenmez; maskeleme yalnız asistanın dış servis bağlamındadır. Okuma sonucu alanları korunur.
- `convex/actions/hikGatewayDevice.ts:953`: yalnız `captureFaceFromDevice` değişti; cihaz yetkisinden sonra gerçek cihaz projesine internal biyometri kapısı uygulanır. Kapalı modülde `BIOMETRIC_DISABLED` dış yakalama çağrısından önce fırlatılır.
- `convex/privacyBiometric.ts:52,64`: internal cihaz kapısı ve yalnız çalışan erişimi kapsamında biyometri bayrağı döndüren public sorgu eklendi. Rıza kartı admin olmayan yetkili kullanıcılara da açık olduğundan admin ayar sorgusu yerine bu dar sorguyu kullanır; admin yetkileri genişletilmedi.
- `convex/privacyBiometric.ts:39`: açık eski projede `enabled:true + reason` artık gerekçeyi ve değişiklik/audit bilgisini kaydeder.
- `convex/hikvisionSync.ts:562`: yalnız D1 satırı değişti; engellenen bridge ekleme işlemi `failed + attemptCount:5` olur, mevcut temizlik koşuluna girer.
- `convex/actions/hikQueueWorker.ts:161`: yalnız D2 dalı değişti; parmak izi gönderilmeden hemen önce çalışan ve cihaz için kapı yeniden sorgulanır. Kapı hatasında cihaz çağrılmaz, işlem mevcut retry hata yoluna döner.
- `convex/lib/privacySettings.ts:21`: min 1825, max 3650 gün; yorum ürün politikası ve danışman doğrulaması olarak düzeltildi. Varsayılan süresiz ve eski proje biyometri davranışı korundu.
- `convex/lib/cardReadingRetention.ts:14`, `convex/privacyRetention.ts:31`: doğrulama hata metinleri 1825–3650 gün. Eski geçersiz süreli satırlar dağıtıcıda zaten atlanır; migration yapılmadı.
- `src/components/settings/sections/privacy/RetentionAssistantCard.tsx:16,18,64`: alt sınır, varsayılan ve açıklama güncellendi; yanlış PDKS iddiası kaldırıldı. Okumaların puantaj/bordro/rapor kaynağı olduğu ve süre dolunca eski dönemlerin hesaplanıp raporlanamayacağı hem kartta hem silme onayında aynı metinle belirtilir.
- Aynı dosya `:33,79`: saklama ve asistan sorgusuna alan bazlı iyimser güncelleme; saklama kaydı sonrası eski değere dönme önlenir, diğer gizlilik alanı korunur. Hata halinde taslak korunur.
- Aynı dosya `:91,97`: maskeyi kapatma kaydetmesi önce `ConfirmDestructive` açar; çalışan adlarının üçüncü taraf servise gönderileceği açıkça belirtilir. Pending Settings form durumuna dahil edilir.
- `src/components/employees/EmployeeConsentsCard.tsx:62,96,123,179,213,238`: hatanın kendisi notify'a verilir; kapalı/yüklenmekte olan modülde biyometrik rıza düğmeleri pasiftir (kart/fotoğraf etkilenmez), kapalı açıklaması görünür. Rıza iptali önce kısa onay açar; gerçek iptal onaydan sonra yapılır. Not etiket/alan bağlantısı ve tür bazlı buton aria-label'ları eklendi. Revoke hatası ConfirmDestructive/useAsyncAction üzerinden nesne olarak ortak notify'a ulaşır.

## Tam fonksiyon sözleşmeleri

Convex aşağıdaki imzalarda `ctx`'yi kendisi sağlar. Kimlik/yetki parametresi istemciden eklenmedi.

```ts
ensureProjectForNewUser(args: {}): Promise<Id<"projects"> | null>;
assignProjectsToExistingUsers(args: { secret: string }): Promise<{
  processed: number; created: number; skipped: number; errors: string[];
}>;
processMessage(args: { input: string; dbContext: string; projectId?: Id<"projects"> }):
  Promise<{ content: string; source: "openai" | "error" }>;
getCardReadings(args: {
  projectId: Id<"projects">; department?: string; date?: string; startDate?: string; endDate?: string;
}): Promise<{
  hasMore: boolean; scopeNote: string;
  readings: { name: string; check_in: string; check_out: string | null; department: string; device: string; location: string }[];
}>;
getAssistantContext(args: { projectId: Id<"projects">; forceMaskNames?: boolean }): Promise<string>; // internal
captureFaceFromDevice(args: { deviceId: Id<"devices">; employeeId?: Id<"employees"> }):
  Promise<{ ok: boolean; faceDataBase64?: string; faceURL?: string; error?: string }>;
assertBiometricDeviceAllowed(args: { deviceId: Id<"devices"> }): Promise<null>; // internal, yeni
getEmployeeBiometricModule(args: { employeeId: Id<"employees"> }): Promise<{ enabled: boolean }>; // yeni
setBiometricModule(args: { projectId: Id<"projects">; enabled: boolean; reason?: string }): Promise<null>;
setCardReadingRetention(args: { projectId: Id<"projects">; days: number | null }): Promise<null>;
validRetentionDays(days: number | null): boolean;
retentionCutoff(days: number | null, now: number): string | null;
needsRetentionConfirmation(current: number | null, next: number | null): boolean; // yeni, UI
needsUnmaskConfirmation(current: boolean, next: boolean): boolean; // yeni, UI
RetentionAssistantCard(props: { projectId: Id<"projects"> }): React.JSX.Element;
EmployeeConsentsCard(props: { employeeId: Id<"employees"> }): React.JSX.Element;
```

D1/D2 imzaları da değişmez; tam dönüş alanları:

```ts
claimLocalBridgeOperations(args: { token: string; max?: number }): Promise<
  { ok: boolean; error: string; operations: never[]; device?: undefined } |
  { ok: boolean; error?: undefined;
    device: { deviceId: Id<"devices">; name: string; deviceIp: string | undefined;
      deviceSerial: string | undefined; hikDoorCount: number | undefined };
    operations: { opId: Id<"hikPendingOperations">;
      operation: Doc<"hikPendingOperations">["operation"];
      payload: Doc<"hikPendingOperations">["payload"]; attemptCount: number; createdAt: number }[];
  }
>;
processHikQueue(args: {}): Promise<{ retried: number; ok: number; failed: number }>;
executeOperation(ctx: ActionCtx,
  c: FunctionReturnType<typeof internal.hikvisionSync.listRetryCandidates>[number]
): Promise<{ ok: boolean; error?: string }>; // private
```


## Kendi koştuğum kapılar

- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: exit 0.
- App tsc: sahip olunan dosyalara süzüldüğünde 0 tanı. Tam app tsc'de yalnız paralel worker'ın `BiometricDestructionCard.test.tsx:39` `replaceAll`/ES2021 hatası vardı; koordinatöre heartbeat gövdesiyle iletildi, dosyaya dokunulmadı.
- Sahip olunan 18 TS/TSX dosyasında eslint: exit 0, 0 hata/uyarı.
- `vitest run` aşağıdaki 7 dosyada: **75/75 geçti**.
  - `convex/lib/privacyFixes.test.ts` (yeni): iki onboarding yolu + audit, public capture kapısı, çalışan bayrağı, retry yeniden kontrolü, bridge terminal hata, kullanıcı tablosunda gerçek ad.
  - `convex/lib/cardReadingRetention.test.ts`: 1825/3650 sınırları, eski 365 reddi, gün kesimi/batch, mutation yazmadan ret, zorunlu maskeli eski istemci bağlamı, mevcut yetki ve ayar izolasyonu.
  - `convex/lib/chatMasking.test.ts`: eski istemci 1/0/çoklu proje ve dış çağrı kontrolü, istemci bağlamının yok sayılması, mevcut maske fonksiyonu.
  - `convex/lib/biometricGate.test.ts`: satırsız açık projede gerekçe/audit ek testi; mevcut kapılar/imha kilidi.
  - `src/components/settings/sections/privacy/RetentionAssistantCard.test.tsx`: açıklama/sınırlar, onay kararları, iyimser sorguda yeni değer ve diğer alanın korunması.
  - `src/components/employees/EmployeeConsentsCard.test.tsx` (yeni): kapalı/açık modül, kart/fotoğraf ayrımı, not label/id, iptal tıklamasında mutation olmaması ve onay sonrası iptal, hata nesnesi.
  - `src/components/settings/sections/privacy/BiometricModuleCard.test.tsx`: mevcut uyarı/gerekçe regresyonu.
- `git diff --check`: exit 0.

## Koordinatörün gerçek oturumda doğrulayacağı akışlar

1. 1440/390 genişlikte saklama Süresiz→1825 ve 3650→1825 onayı; kart/onay aynı rapor kaybı açıklamasını göstermeli. 1824 reddedilmeli, kayıt sonrası eski değer parlamamalı; ağ hatasında taslak kalmalı.
2. Maskeyi kapatıp Kaydet→önce üçüncü taraf paylaşım onayı; Vazgeç değişiklik yazmamalı. Başarılı kayıt, başarısız kayıt ve işlem sürerken sekme/proje geçişi.
3. Rıza kartı modül kapalıyken yüz/parmak izi pasif; kart/fotoğraf kullanılabilir; mevcut rıza iptali kapalı modülde de çalışır. İptal önce onay gösterir; hata ham JSON görünmez; klavye/ekran okuyucu etiketleri.
4. Yeni self-signup projesinde gizlilik satırı ve audit birlikte oluşur, biyometri kapalıdır (bu worker canlıda çalıştırmadı).
5. Eski istemci proje argümanı olmadan bir projede maskeli asistan yanıtı; sıfır/çoklu projede yenileme mesajı ve dış çağrı yok. Kullanıcının tablo yanıtındaki adlar gerçek kalır.
6. Modül kapalı cihazdan public capture ve retry parmak izi gönderimi reddedilir; bridge engellenen eklemeleri temizlik eşiğine ulaşır. Gerçek cihaz/bridge sonucu bu worker tarafından çalıştırılmadı.
7. Eski satırsız açık projede `setBiometricModule({projectId,enabled:true,reason})` gerekçeyi ve audit'i kaydeder.

## Bilerek kapsam dışında

İmha uygulaması/testi ve ilgili mevcut app-tsc hatası Düzeltme-1 worker'ının alanıdır. `BiometricModuleCard` ve chat frontend akışının mevcut imzaları bu düzeltmede değişiklik gerektirmedi. Var olan secret atama fonksiyonunun unbounded kullanıcı taraması ve yakalanan hata semantiği bu dar düzeltmede yeniden yazılmadı; fonksiyon çalıştırılmadı. UI testleri SSR ve kontrollü callback/hook fixture'larıdır; gerçek tarayıcı, gerçek servis ve cihaz doğrulaması değildir. Yasal metin bağımsız hukuk görüşü değildir; danışman doğrulama notu korunmuştur.

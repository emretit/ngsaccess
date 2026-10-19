# KVKK Faz 1 — Worker C: saklama süresi ve asistan gizliliği

## Sonuç ve doğrulama

Tamamlandı; commit/push/deploy, migration, canlı DB okuma/yazma, uygulamaya giriş veya paket kurulumu yapılmadı. Son koşum: Convex tsc **0**, app tsc **tamamı 0** (süzülü kapsam da 0), sahip olunan dosyalarda eslint **0 hata / 0 uyarı**, üç test dosyasında **41 test geçti** (saf mantık, mock context ile handler ve sunucu render testleri), `git diff --check` **0**. Başka worker dosyaları değiştirilmedi; `_generated/api.d.ts` içine yalnız privacyRetention import ve modül kaydı eklendi.

## Dosya ve davranış haritası

- `convex/privacyRetention.ts:18`: admin proje-kapsamlı okuma ve iki ayrı yazma; kısmi patch ve her yazmada audit, yabancı proje reddi.
- `convex/privacyRetention.ts:51`: iç sorgularla proje izni doğrulanmış asistan ayarı ve PDKS örneklemi; varsayılan isim maskelemesi, çalışan kimliklerinin dış bağlamdan çıkarılması.
- `convex/privacyRetention.ts:74`: 50 ayar satırlık sayfalı günlük dağıtıcı; süresiz projeler atlanır. Her proje 200 kayıt/batch, en fazla 20 batch (4.000 kayıt/cron koşumu); zincir `scheduler.runAfter(0)` ile sürer. Koşum sonunda kullanıcı olmadan silinen toplam, UTC kesim, proje, tavan/durdurma nedeni audit'e yazılır; sıfır sonuç da raporlanır. Süre değişirse eski zincir durur.
- `convex/lib/cardReadingRetention.ts:7`: 365–3650 tam gün doğrulaması; Türkiye takvim gün başlangıcından konservatif UTC ISO kesim; batch/tavan kararı.
- `convex/lib/cardReadingRetention.test.ts:1`: sınırlar, artık yıl, TR gün kayması, null temizleme, yetki, kısmi patch, varsayılan maskeleme/kapalı durum, batch devamı/tavan/audit ve süresiz atlama testleri.
- `convex/lib/chatMasking.ts:4`: aynı veri kümesinde kimlik (yoksa normalize ad) üzerinden tutarlı Personel N etiketi; boş ad ve kapalı ayarda değerler korunur, kaynak veri değiştirilmez.
- `convex/lib/chatMasking.test.ts:1`: tutarlı etiketler, kimliği farklı aynı isimler, boş ad, maskeleme kapalı durumu ve OpenAI istek gövdesi/güven sınırı testleri.
- `convex/actions/getChatData.ts:12`: mevcut argüman/dönüş şekli korunarak liste adları maskelenir; `getDatabaseContext` sunucu iç sorgusunu kullanır.
- `convex/actions/openaiChat.ts:50`: mevcut input/dbContext argümanlarına **opsiyonel** projectId eklendi. İstemci dbContext metni dış servise aktarılmaz; proje bağlamı çağrı anındaki ayarla yeniden hazırlanır. Kullanıcının input metni aynen gider. Model yanıtındaki Personel N etiketleri aynen gösterilir.
- `src/components/pdks/chat/hooks/useMessageHandler.ts:48`: OpenAI çağrısına seçili projectId eklenir.
- `src/components/settings/sections/privacy/RetentionAssistantCard.tsx:18`: iki bağımsız bölüm/form; SettingsFormState taslak koruması, yüklenme iskeleti, bağlı etiket/hata, 365–3650 sınırları, hukuki danışman uyarısı, üçüncü taraf uyarısı, ayrı kaydetme. Silmeyi başlatan/kısaltan değişimde ConfirmDestructive gösterilir.
- `src/components/settings/sections/privacy/RetentionAssistantCard.test.tsx:1`: sınır doğrulaması, uyarılar, varsayılan seçim ve kapalı/açık anahtar render testleri.
- `convex/crons.ts:87`: kendi yorum bloğunda yalnız 24 saatlik yeni interval eklendi; eski cronlara dokunulmadı.
- `convex/_generated/api.d.ts`: yalnız privacyRetention modülü için iki satır eklendi; başka worker kayıtları korundu.

## Tam fonksiyon sözleşmeleri

Aşağıda kayıtlı fonksiyonların args ve handler dönüşleri verilmiştir; kimlikler Convex `Id<...>` tipidir.

```ts
getRetentionAndAssistant({ projectId: Id<"projects"> }): Promise<{ cardReadingRetentionDays: number | null; aiMaskNames: boolean }>
setCardReadingRetention({ projectId: Id<"projects">; days: number | null }): Promise<null>
setAssistantMasking({ projectId: Id<"projects">; enabled: boolean }): Promise<null>
// internalQuery:
getAssistantPrivacy({ projectId: Id<"projects"> }): Promise<boolean>
getAssistantContext({ projectId: Id<"projects"> }): Promise<string>
// internalMutation:
purgeExpiredCardReadings({ cursor?: string; runAt?: number }): Promise<null>
purgeProjectBatch({ projectId: Id<"projects">; runAt: number; days: number; batch: number; deleted: number }): Promise<null>
// Yerel backend helper:
requireProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<void>
// Saf yardımcılar:
validRetentionDays(days: number | null): boolean
retentionCutoff(days: number | null, now: number): string | null
retentionBatchPlan(deleted: number, completedBatches: number): { continueRun: boolean; dailyLimitReached: boolean }
type ChatPerson = { employeeId?: string; employeeName?: string | null; name?: string | null };
maskChatNames<T extends ChatPerson>(rows: readonly T[], enabled?: boolean): T[]
// Mevcut action'ların korunan / opsiyonel genişletilen sözleşmeleri:
getCardReadings({ projectId: Id<"projects">; department?: string; date?: string; startDate?: string; endDate?: string }): Promise<{ hasMore: boolean; scopeNote: string; readings: { name: string; check_in: string; check_out: string | null; department: string; device: string; location: string }[] }>
getDatabaseContext({ projectId: Id<"projects"> }): Promise<string>
processMessage({ input: string; dbContext: string; projectId?: Id<"projects"> }): Promise<{ content: string; source: "openai" | "error" }>
// UI:
RetentionAssistantCard({ projectId: Id<"projects"> }): React.JSX.Element
RetentionForm({ projectId: Id<"projects">; days: number | null }): React.JSX.Element
AssistantForm({ projectId: Id<"projects">; enabled: boolean }): React.JSX.Element
// retentionDaysSchema giriş/çıkış: number | null
```

## Koordinatör kararları ve gerçek oturum kontrol listesi

1. Koordinatör ortak `upsertPrivacySettings` yardımcısına null temizleme desteği ekledi; süresize dönüş sadece `{ cardReadingRetentionDays: null }` patch'i kullanır (kendi db.patch yolu yok).
2. Koordinatör eski istemci için güvenli davranışı onayladı: projectId gelmezse **hiç dış servis çağrısı yok**, dönüş tam olarak `{ content: "Asistan güncellendi; verilere erişmek için sayfayı yenileyin.", source: "error" }`. Testi mevcut. Yeni frontend yenilenince seçili proje argümanı gider.
3. Gerçek yetkili oturumda `/settings?tab=privacy`: proje geçişi, taslak varken sekme/proje değiştirme koruması, başarısız kayıtta taslak, iki formun birbirini ezmemesi, kısa süre için silme onayı, süresize dönüş; 390px görünüm ve klavye odağı kontrol edilmeli. Render/şema testleri mevcut; gerçek tarayıcı oturumu çalıştırılmadı.
4. Asistan: açıkken Personel N, kapalıyken gerçek adlar; kullanıcının kendi sorusundaki adın korunması, yabancı proje reddi ve eski sekmede yenileme mesajı gerçek oturumda kontrol edilmeli. Dış servis gövdesi unit testte doğrulandı; canlı OpenAI çağrısı yapılmadı.
5. Zamanlayıcı çalışması yalnız kontrollü test ortamında değerlendirilmeli: tam kesim anındaki kayıt korunur (`lt`), süresiz projeye dokunulmaz, 200/batch ve 20 batch sonunda audit oluşur, ayar değişikliği zinciri durdurur. Canlı retention çalıştırılmadı.

## Bilerek kapsam dışında bırakılanlar

Biyometri modülü/imha, pdksRecords ve manuel düzeltme silme, mevcut projelere otomatik süre atama, canlı temizlik ve dağıtım kapsam dışıdır. Personel etiketleri veri kümesi başına üretilir; ayrı sorgular arasında kalıcı kişi numarası vaat edilmez. Günlük tavan günlük cron'un bir proje zinciri içindir; elle aynı internal işi tekrar çağırmak için ayrı kalıcı günlük sayaç tasarlanmadı ve bu görevde manuel tetikleme sunulmadı.

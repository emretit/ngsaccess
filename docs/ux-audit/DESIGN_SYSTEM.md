# Ortak UX altyapısı

Dalga 1 sözleşmeleri (2026-10-16). Yeni ekranlar ve Dalga 2 düzeltmeleri aşağıdaki küçük API'leri kullanır. Toplu eski toast/renk göçü Dalga 3 kapsamındadır.

## 1. Backend proje kapsamı — K1

Proje verisi okuyan veya değiştiren handler'da `resolveProjectScope(ctx, projectId?)` kullanın. Kimliği sunucudan doğrular; seçim varsa izinli projelerle karşılaştırır ve yalnız `[projectId]` döndürür, erişim yoksa “Bu projeye erişim yetkiniz yok” hatası verir. Seçim yoksa `getProjectIdsForUser` sonucunu döndürür; bu davranış kendiliğinden aktif proje seçmez. Dönen kimlikleri sorgu index'lerine uygulamak handler'ın sorumluluğudur. Dashboard'un mevcut kapsam davranışı bu yardımcıya taşındı. Saf karar matrisi `projectScope.test.ts` içindedir.

```ts
import { resolveProjectScope } from "./lib/projectScope";

// authedQuery/authedMutation args: { projectId: v.optional(v.id("projects")) }
const projectIds = await resolveProjectScope(ctx, args.projectId);
const rows = await Promise.all(projectIds.map((projectId) =>
  ctx.db.query("devices").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(100),
));
```

## 2. Frontend aktif proje — K1

`useActiveProjectScope()` ActiveProjectContext üzerinde ince sarmalayıcıdır; `{ projectId, projectIds, loading, isSuperAdmin, isAdmin }` döndürür. `projectId` seçili projedir, `projectIds` kullanıcının tüm erişilebilir projeleridir; bu ikisini sorgu kapsamı olarak birbirinin yerine kullanmayın. Yüklenirken veya seçili proje yokken sorguyu `"skip"` yapın; kullanıcıya proje seçimi/boş durumu gösterin. Rol bayrakları UI içindir, backend yetkilendirmesinin yerine geçmez. Dashboard gerçek tüketicidir; proje adını gerektiğinde mevcut `useActiveProject` üzerinden okuyun, kapsamı yeniden hesaplamayın.

```tsx
const { projectId, loading } = useActiveProjectScope();
const stats = useQuery(api.dashboard.getStats,
  !loading && isAuthenticated && projectId ? { projectId } : "skip",
);
```

## 3. Tek bildirim API'si — K2

Yeni işlemlerde Sonner üzerindeki `notify.success(title, description?)`, `notify.info(title, description?)` ve `notify.error(title, unknownError?)` kullanın. `errorMessage(unknown)` ConvexError'ın string veya `{ message }` verisini, Error mesajını ve string hatayı çıkarır; bilinmeyen/boş değer için Türkçe yedek açıklama üretir. Sunucunun anlamlı Türkçe mesajını korur; keyfi İngilizce mesajları otomatik çevirmediğinden yeni backend hatalarını Türkçe yazın. Sonner sağlayıcısı uygulama kökünde mount edilmiştir. Başarıyı yalnız gerçek işlem tamamlandıktan sonra gösterin; kuyruk kabulünü cihaz onayı diye sunmayın. Bridge iptali ve cihaz silme/taşıma tüketicidir; eski `useToast` çağrıları topluca taşınmadı.

```ts
try {
  await save(payload);
  notify.success("Değişiklikler kaydedildi");
} catch (error: unknown) {
  notify.error("Kaydedilemedi", error);
}
```

## 4. Asenkron işlem durumu — K2

`useAsyncAction(fn, { success?, error? })` form ve aksiyonlarda aynı anda ikinci çağrıyı yok sayar. `run(...args): Promise<boolean>` yalnız başarıda `true`, hatada veya yok sayılan çağrıda `false` döner; mutation sonucunu döndürmez. `pending` tüm işlem boyunca sürer. Başarı metni opsiyoneldir; hata her zaman ortak bildirimle gösterilir. Hook'a verilen fonksiyon hatayı yutmamalı, başarısızlıkta reject/throw etmelidir; aynı işlem için ayrıca catch/toast eklemeyin. `createAsyncGuard` saf yardımcı testleri bekleyen işlem, çift çağrı, senkron/asenkron hata ve yeniden denemeyi kapsar. ConfirmDestructive ve cihaz düzenleme gerçek tüketicidir.

```tsx
const { run, pending } = useAsyncAction(save, {
  success: "Kaydedildi", error: "Kaydedilemedi",
});
const submit = async (payload: FormValues) => {
  if (await run(payload)) setOpen(false);
};
// <Button disabled={pending} onClick={() => submit(values)}>Kaydet</Button>
```

## 5. Nullable patch — K3

Opsiyonel bir alanı temizleyebilen mutation'larda `undefined` “dokunma”, `null` “alanı temizle”, diğer değerler “yaz” anlamına gelir. `toPatch(args)` yalnız düz alanları dönüştürür: undefined girdiyi çıkarır, null için patch içinde own property olarak undefined üretir; Convex bu alanı siler. İç içe nesneleri dolaşmaz; boş string, false ve sıfır korunur. Patch'i JSON'a dönüştürmeyin (silme işaretini kaybedersiniz), kimlik alanlarını ve temizlenemeyen zorunlu alanları yardımcının dışında tutun. Null kabulü yalnız mutation validator'ında gerekir; veritabanı alanı opsiyonel kalabilir. Bu dalgada üretim tüketicisi özellikle eklenmedi; ACC-01/PPL-21 Dalga 2'de bağlanacak.

```ts
import { toPatch } from "./lib/nullablePatch";

// Mutation args validator:
// note: v.optional(v.union(v.null(), v.string()))
const { id, ...fields } = args;
await ctx.db.patch(id, toPatch(fields));
// { note: undefined } → {}; { note: null } → { note: undefined }
```

## 6. Yıkıcı işlem onayı — K6 / ADM-27

`ConfirmDestructive` kontrollü shadcn AlertDialog'dur. `open`, `onOpenChange`, `title`, `objectName`, `effects: string[]`, `confirmLabel` ve `onConfirm: () => Promise<unknown>` alır. Kaynak adı ile etki listesini somut yazın; backend'in uygulamadığı bir koruma sözü vermeyin. Beklerken onay/vazgeç ve Escape kilitlidir; başarıda kapanır, hata bildirimiyle açık kalır, kaynak hâlâ bağlıysa odağı geri verir. `onConfirm` hatayı yutmamalıdır; başarı bildirimi gerekiyorsa mutation sonrasında üretin. Bridge iptali, admin cihaz silme ve proje taşıma bağlandı; uygulamadaki native confirm çağrıları kaldırıldı. Mevcut cihaz cascade veri kaybı uyarısı korunmuştur; geçmiş koruma backend işi bu dalganın dışında kalır.

```tsx
<ConfirmDestructive
  open={deleteTarget !== null}
  onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
  title="Token iptal edilsin mi?"
  objectName="Merkez bridge"
  effects={["Bu token ile çalışan bridge artık bağlanamaz."]}
  confirmLabel="Token'ı iptal et"
  onConfirm={async () => {
    await revokeToken();
    notify.success("Token iptal edildi");
  }}
/>
```

## 7. Durum rozeti ve bölüm iskeleti

`StatusBadge` için `tone` yalnız `success | warning | danger | info | neutral` olabilir; `statusTone(tone)` ilk dört anlamı `src/index.css` içindeki `status-*-badge` sınıflarına, neutral'ı muted/border token'larına eşler. Renk yanında mutlaka açıklayıcı metin kullanın; `className` ile durum rengini geçersiz kılmayın. `SectionSkeleton` bölüm yüklenirken `rows` (varsayılan 3, sıfır veya pozitif tam sayı), `label` (varsayılan “Yükleniyor”) ve `className` alır; status/busy erişilebilirlik bilgisini tek kapsayıcıda verir. Dashboard Son Kart Okutmaları her iki bileşenin gerçek tüketicisidir. Hook/context sarmalayıcıları iş kuralı çoğaltmaz; saf karar testleri proje kapsamı, hata çözümleme, işlem kilidi, nullable patch ve durum tonu dosyalarındadır.

```tsx
<StatusBadge tone="success">İzin verildi</StatusBadge>
<StatusBadge tone="neutral">Henüz bağlanmadı</StatusBadge>
<SectionSkeleton rows={4} label="Cihazlar yükleniyor" />
```

## Yeni/değiştirilen ekran kuralları

- Durum rengi yalnız `StatusBadge` veya semantik durum token'larıyla verilir; sabit yeşil/kırmızı Tailwind renkleri kullanılmaz.
- Emoji ikon yerine Lucide ikon ve anlaşılır Türkçe metin kullanılır.
- Boş listeler `EmptyState`, yükleme hataları `ErrorState` ve gerekiyorsa tekrar deneme aksiyonu kullanır.
- Form alanları `FormFieldWrapper` içinde label/id bağlantısı ve satır içi hata ile sunulur.
- Yalnız ikon taşıyan butonda amaca özgü `aria-label` bulunur.
- Yükleme bölüm içinde `SectionSkeleton` ile gösterilir; tam ekran spinner eklenmez.
- Yıkıcı onayın etki metni backend davranışıyla aynı olmalıdır; native `confirm()` eklenmez.

```tsx
<EmptyState title="Cihaz bulunamadı" description="Bu projeye henüz cihaz atanmamış." />
<ErrorState description="Cihazlar yüklenemedi." onRetry={retry} />
<FormFieldWrapper htmlFor="device-name" label="Cihaz adı" error={nameError}>
  <Input id="device-name" value={name} onChange={(event) => setName(event.target.value)} />
</FormFieldWrapper>
<Button size="icon" aria-label="Cihazı düzenle"><Pencil aria-hidden="true" /></Button>
```

## Dalga 3 — ortak form ve durum bileşenleri

- `PasswordField` standart `Input` props/ref sözleşmesini (`type` hariç) taşır. Görünür `Label` veya `FormFieldWrapper` ile kullanın; `disabled` input ve 44px göster/gizle düğmesini birlikte kilitler.
- `FormFieldWrapper htmlFor="email" label="E-posta" hint="…" error={message}` tek kontrolün `id`, `aria-invalid`, `aria-describedby` alanlarını ayarlar; ipucu/hata ile mevcut açıklama id'sini birleştirir. Karmaşık kontrollerde açık slot kullanın: `{(control) => <Input {...control} />}`. İkon/dekorasyonları slot dışında bırakın.
- `const { requestClose, dialog } = useUnsavedChangesGuard(isDirty)`: modal `onOpenChange`, iptal ve kapat düğmelerinde `requestClose(() => setOpen(false))` çağırın ve `{dialog}` render edin. Başarıyla kaydetme doğrudan kapanabilir. Sekme kapatmada tarayıcı uyarısı vardır; rota değişimi için gezinme callback'ini ayrıca `requestClose` üzerinden geçirin. **API sabit:** `requestClose(close: () => void): void`.
- `QuerySectionBoundary` sorguyu çağıran **çocuk bileşeni** sarar; kendi parent'ındaki query hatasını yakalayamaz. Opsiyonel `title`, `description`, `onRetry`, `resetKey: string | number`, `className`; yeniden deneme çocukları yeniden mount eder, `resetKey` proje/filtre değişiminde hata durumunu temizler. ErrorState içinde yeniden deneme gösterilir; kardeş bölümler ayakta kalır.
- `EmptyState`, `ErrorState`, `AccessDenied` isteğe bağlı `compact` destekler. `StatCard` `loading` ve null/undefined değeri destekler; bilinmeyen değer sıfır yerine “—” gösterilir. Badge: mevcut varyantlara ek `danger`, `successSubtle`, `warningSubtle`, `dangerSubtle`, `infoSubtle`.

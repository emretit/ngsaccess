# C3-admin — üyelik yarış kontrolü ve kısmi genel ayar kaydı

Durum: #9 tamam; #10 backend/payload hazır ancak GeneralSettings.tsx → baseline bağlantısı için ownership izni bekleniyor (ask: msg_55df5d17a804). useSettingsDraft dönüşüne baseline eklenmesi ve generalPayload(parsed.data, draft.baseline) çağrısı henüz yapılmadı; UI bu izin gelene kadar hâlâ tam payload gönderir.

## Değişiklikler

- `convex/lib/adminGuards.ts:4`: `membershipChanged` sırasız, tekilleştirilmiş üyelik kümelerini karşılaştırır; snapshot yoksa eski davranış.
- `convex/users.ts:62`: `updateRole` opsiyonel `expectedProjectIds` alır; üyelikleri transaction içinde bir kez okuyup herhangi bir rol/üyelik yazısından önce kontrol eder. Uyuşmazlıkta `ConvexError({code:"MEMBERSHIP_CHANGED",message:"Kullanıcının proje üyelikleri başka bir oturumda değişti. Formu kapatıp yeniden açın."})`.
- `src/components/admin/hooks/useUserManagement.ts:68`: bir kez yakalanan mevcut `baseline.projectIds` mutation'a gönderilir. `UserFormDialog.tsx` değişmedi: mevcut `errorMessage`, satır içi `role="alert"`, başarısız `useAsyncAction` sonucunda kapanmama ve taslağı koruma davranışları yeniden kullanılır.
- `src/components/settings/sections/general/generalForm.ts:20`: payload normalize edilmiş değerleri dondurulmuş baseline ile karşılaştırır; yalnız farklı alanları gönderir. Boş nullable metin `null`, false boolean gerçek değer olarak kalır; notifications → notificationsEnabled mevcut eşlemesi korunur.
- `src/components/settings/sections/hooks/useGeneralSettings.ts:34`: payload'a canlı abonelikten şirket adı eklemez.
- `convex/settings.ts:44`: şirket adı opsiyonel; gönderilmişse trim/boşluk doğrulaması aynen. Eksik alanlar mevcut `toPatch` ile dokunulmadan kalır, nullable alanlarda null temizler. Yeni kayıt şirket adı olmadan oluşturulursa eski hook varsayılanı `NGS Access` kullanılır; eski tam payload aynı sonucu verir.
- `convex/adminSettingsGuards.test.ts`: küme sırası/duplicate, ekleme/silme/değiştirme, opsiyonel snapshot, gerçek updateRole handler'ında sıfır yazıyla reddetme ve eski rol-only çağrı; gerçek upsertGeneral handler'ında yalnız telefon patch'i, null temizleme, trim ve tam legacy patch testleri.
- `src/components/settings/settings.test.tsx`: yalnız telefon gönderme, başka oturumdaki şirket/e-posta değişikliğini koruma, false/null ve geri alınmış değişiklik testleri.

## Argüman ve dönüş sözleşmeleri

```ts
type Role = "super_admin" | "project_admin" | "project_user";
updateRole(args: {
  userId: Id<"users">;
  role: Role;
  projectIds?: Id<"projects">[];
  expectedProjectIds?: Id<"projects">[];
}): Promise<null>;

membershipChanged(
  liveProjectIds: readonly Id<"projects">[],
  expectedProjectIds: readonly Id<"projects">[] | undefined,
): boolean;

type GeneralValues = {
  companyName: string; taxNumber: string; address: string; email: string;
  phone: string; website: string; currency: string;
  darkMode: boolean; notifications: boolean;
};
type NormalizedGeneralValues = {
  companyName: string; taxNumber: string | null; address: string | null;
  email: string | null; phone: string | null; website: string | null;
  currency: string | null; darkMode: boolean; notificationsEnabled: boolean;
};
normalizedGeneralValues(values: GeneralValues): NormalizedGeneralValues;
type GeneralPayload = Partial<NormalizedGeneralValues>;
generalPayload(values: GeneralValues, baseline?: GeneralValues): GeneralPayload;

upsertGeneral(args: {
  projectId?: Id<"projects">; companyName?: string;
  address?: string | null; email?: string | null; phone?: string | null;
  website?: string | null; taxNumber?: string | null; currency?: string | null;
  logoUrl?: string | null; darkMode?: boolean; dateFormat?: string;
  timezone?: string; systemLanguage?: string; workingDays?: string[];
  workingHoursStart?: string; workingHoursEnd?: string; notificationsEnabled?: boolean;
}): Promise<Id<"generalSettings">>;
```

`useUserManagement(): { projects: FunctionReturnType<typeof api.projects.list>; currentUser: User | null; formData: UserFormData; baseline: UserFormData; setFormData: Dispatch<SetStateAction<UserFormData>>; error: string | undefined; handleEditUser(user: User): void; handleSaveUser(): Promise<boolean>; saving: boolean; editReady: boolean; handleDeleteUser(user: User): Promise<void>; resetForm(): void }` dönüşü değişmedi.

`useGeneralSettings(): { settings: FunctionReturnType<typeof api.settings.getGeneral>; loading: boolean; saving: boolean; saveSettings(data: Omit<FunctionArgs<typeof api.settings.upsertGeneral>, "projectId">): Promise<boolean> }` dönüşü ve çağrı sözleşmesi korunur; `saveSettings` artık değişmeyen şirket adını eklemez.

## Koordinatörün gerçek oturumda bakacağı akışlar (1440 + 390 px)

1. İki sekmede aynı kullanıcıyı düzenleme formunu açın; her ikisinde üyeliklerin yüklenmesini bekleyin. İlk sekmede proje ekleyip kaydedin; ikinci sekmede rol veya üyelik değiştirip kaydedin. İkinci form açık ve taslak korunmuş kalmalı; MEMBERSHIP_CHANGED metni görünmeli, rol/üyeliklerden hiçbiri yazılmamalı. Azaltma onayından kaydetme yolunda da aynı metin görünmeli. Formu kapatıp yeniden açınca güncel üyeliklerle kayıt başarılı olmalı.
2. Genel ayarları iki sekmede açın; ikinci sekmede yalnız telefonu düzenleyerek taslak başlatın. İlk sekmede şirket adını/e-postayı değiştirip kaydedin; ikinci sekmede telefonu kaydedin. İlk sekmenin şirket/e-posta değişikliği korunmalı; ikinci payload yalnız `projectId` + `phone` içermeli.
3. Telefonu temizleyin, bildirimleri ve koyu temayı false yapın; ilgili null/false alanlar yazılmalı. Düzenleyip eski değerine dönen alan payload'a girmemeli. Yeni şirket bilgisi oluşturma ve eski tüm alanları gönderen istemci de çalışmalı.

Canlı oturum, DB yazma, deploy, migration, commit/push ve paket kurulumu yapılmadı. Diğer ayar bölümleri, admin listeleri ve rol modeli kapsam dışıdır.

## Ara doğrulama

- App tsc, Convex tsc, src+convex ESLint, vite build ve git diff --check geçti.
- Hedef testler: 2 dosya / 28 test geçti (yeni gerçek handler kontrolleri dahil).
- Tam vitest ara koşusu: 103 dosya / 1063 test geçti; yalnız ownership dışı `convex/lib/shiftAssign.test.ts:254` eski `OVERLAP:1` string beklerken `convex/shifts.ts` structured `SHIFT_OVERLAP` döndüğü için başarısız. Koordinatöre escalation ile bildirildi.
- İzin sonrası üst form bağlantısı eklenince tüm kapılar yeniden çalıştırılmalı; mevcut durum teslim başarısı değildir.

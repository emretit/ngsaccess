# C3 sweep — tamamlandı

## Değişiklikler

- `src/components/admin/IdeProvisioningCard.tsx:7,99,202`: eski toast → notify; başarı/hata/uyarı/bilgi renkleri A2 tokenları. Kart içeriği, ağ çağrıları, düğmeler ve akış aynı.
- `src/components/pdks/chat/useAiChat.ts:8,50`, `src/components/pdks/dashboard/PDKSSavedViews.tsx:21,41`, `src/components/pdks/chat/useExportUtils.ts:1,37`, `src/components/employees/EmployeeConsentsCard.tsx:20,87`, `src/hooks/useDevices.ts:3,51`: notify geçişi; title/description ifadeleri aynen korunur, destructive → error; panel durum bilgisi → info.
- `src/components/pdks/chat/useExportUtils.ts:9,86`: PDF başlık, metin, satır ve çizgi renkleri CSS tema tokenlarından türetilir; sabit RGB kaldırıldı. PDF kolonları, metinleri ve zebra davranışı aynı.
- `src/components/pdks/chat/useExportUtils.test.ts:1`: HSL→RGB dönüşümünün nötr, birincil ve farklı durum tonlarında doğruluğu (2 test).
- `src/components/pdks/AiInsightsCard.tsx:12,27`: gradyan/palet → nötr card, border, foreground ve muted tokenları.
- `src/components/pdks/chat/AiModelStatus.tsx:18`: durum noktası badge'in kontrast metin rengini izler (`bg-current`); bağlı/bağlı değil anlamı mevcut semantik badge varyantlarında kalır.
- `src/components/profile/SecurityCard.tsx:20,31`, `src/components/profile/ProfilePhoto.tsx:59,70,92`, `src/components/profile/ProfileForm.tsx:67`: yardımcı metin → muted-foreground; birincil yüzey yazısı → primary-foreground.
- `src/components/employees/EmployeeConsentsCard.tsx:135`: aktif rıza → successSubtle; `src/components/employees/EngineeringDepartmentView.tsx:33`: hata → destructive.
- `src/components/pdks/PDKSAiChat.tsx:3,67,125`: Rocket/Lightbulb Lucide ikonları, açıklayıcı metinler aynı; dekoratif ikonlar aria-hidden.
- `src/App.tsx:12`: yalnız App.css importu kaldırıldı; `src/App.css` silindi.

## App.css kullanım doğrulaması

Dosya yalnız `#root { width: 100%; min-height: 100vh; }` içeriyordu. `#root` normal blok olarak zaten mevcut genişliği doldurur; uygulama kabuğu SidebarInset ile h-screen, public/setup/auth/not-found rota kökleri min-h-screen ve PageFallback h-screen sağlar. Başka App.css importu yoktu; bu yüzden index.css taşıması gerekmedi, index.css değiştirilmedi.

## Fonksiyon sözleşmeleri

Public component props ve hook dönüş alanları değişmedi; yeni backend API/fonksiyon yoktur. Renk değişen component'ler mevcut props ile `React.JSX.Element` döndürür: `IdeProvisioningCard()`, `AiInsightsCard({ insight?: string, isLoading?: boolean })`, `AiModelStatus({ isConnected: boolean })`, `SecurityCard()`, `ProfilePhoto(props: ProfilePhotoProps)`, `ProfileForm(props: ProfileFormProps)`, `EmployeeConsentsCard({ employeeId: Id<"employees"> })`, `EngineeringDepartmentView()`, `PDKSAiChat()`, `PDKSSavedViews({ filters: FilterValues, onApply: (filters: FilterValues) => void })`.

Yeni/değişen mantık ve bildirim callback'lerinin tam argüman/dönüş tipleri (mevcut Device, MessageData, Id ve React tipleri):

```ts
pdfThemeColor(channels: string): [number, number, number];
// useExportUtils() döndürür:
formatReportData<T extends { check_in?: string | Date | null; check_out?: string | Date | null }>(data: T[]): (T & { check_in: string; check_out: string })[];
handleExportExcel(messageData: MessageData[]): Promise<void>;
handleExportPDF(messageData: MessageData[]): Promise<void>;
// useAiChat() bildirim callback'i; saveConversation alanı olarak döner:
saveConversationToConvex(): Promise<void>;
// useDevices() callback'leri; aynı isimlerle döner:
addDevice(deviceData: Partial<Device>): Promise<Id<"devices"> | undefined>;
editDevice(deviceId: Id<"devices">, updates: Partial<Device>): Promise<void>;
removeDevice(deviceId: Id<"devices">): Promise<void>;
// IdeProvisioningCard içi:
handleScan(): Promise<void>;
handleProvision(): Promise<void>;
handleCheckStatus(): Promise<void>;
// EmployeeConsentsCard içi:
handleGrant(): Promise<void>;
handleRevoke(id: Id<"employeeConsents">, label: string): Promise<void>;
// PDKSSavedViews içi:
handleSave(): void;
```

## Doğrulama

- Frontend `tsc --noEmit -p tsconfig.app.json`: son koşu geçti. Aradaki loadRuleEditor.ts TS7022/TS7006 hataları koordinatöre bildirildi ve diğer worker düzeltmesinden sonra tekrar kontrol edildi.
- Backend `tsc --noEmit -p convex/tsconfig.json`: geçti.
- `eslint src convex`: 0 hata, 0 uyarı.
- `npx vitest run`: 104 dosya, 1066 test geçti. İlk koşuda başka worker alanındaki SHIFT_OVERLAP eski istemci testi başarısızdı; koordinatöre bildirildi, eşzamanlı düzeltme sonrası tam koşu geçti.
- `npx vite build`: geçti; mevcut büyük chunk uyarısı sürüyor.
- `git diff --check`: geçti.
- Ownership kaynakları grep taraması: useToast/palet/emoji/sabit gerçek renk yok. `EmployeeConsentsCard.tsx` placeholder'ındaki `ref #1234` renk değildir ve metin koruma gereği tutuldu. Testte beklenen RGB sayıları test fixture'ıdır.

## Koordinatörün 1440 + 390 gerçek oturum kontrolü

Admin IDE provisioning: köprü açık/kapalı/configError, panel bulunamadı/bulundu, tam/kısmi provisioning, panel durum bildirimi. PDKS: AI bilgi kartı, bağlı/bağlı değil rozeti ve nokta kontrastı, yerli AI yardım ikonları, sohbet kaydetme, kayıtlı görünüm, Excel/PDF indirme; açık/koyu tema PDF renkleri. Çalışan rızası: aktif/eksik rıza ve grant/revoke bildirimi; profil yardımcı metinleri, avatar ve fotoğraf yükleme düğmesi. Public login/register/landing ve uygulama kabuğunda App.css kaldırıldıktan sonra ekran yüksekliği.

Uygulamaya giriş yapılmadı; bu görsel turlar koordinatöre bırakıldı. Kapsam dışı kalıntılar aşağıda yalnız raporlandı; landing/ui/access-rules ve diğer worker dosyaları değiştirilmedi. Commit/push/deploy/DB yazma yapılmadı.

---

# C3 sweep — kapsam dışı ham tarama

Landing (`src/components/landing/**`) ve shadcn (`src/components/ui/**`, logo dahil) hariç `src` tarandı; ownership dosyaları sonuçtan çıkarıldı. Tanım dosyaları, testler ve yorumlar da ham sonuçlara dahildir; bunların tümü uygulama ihlali anlamına gelmez. Bu dosyalar değiştirilmedi.

## Palet ve sabit siyah/beyaz sınıflar

Komut: `grep -rEn '(bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|shadow)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|slate|zinc|neutral|stone)-[0-9]{2,3}|(bg|text|border|ring|from|to|via)-(black|white)([^a-zA-Z-]|$)' src` (sonrasında yukarıdaki yol filtreleri).

10 eşleşen satır.

```text
src/components/demo/DemoRequestHero.tsx:10:        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-3xl mx-auto mb-6 backdrop-blur-sm">
src/components/layout/AppSidebar.tsx:22:          <span className="truncate text-[19px] font-semibold group-data-[collapsible=icon]:hidden text-white">
src/pages/Login.tsx:237:        <div className="absolute inset-0 bg-black/10" />
src/pages/Login.tsx:240:        <div className="absolute right-12 top-12 h-28 w-28 rounded-full bg-white/10" />
src/pages/Login.tsx:241:        <div className="absolute bottom-24 left-16 h-20 w-20 rounded-full bg-white/10" />
src/pages/Login.tsx:242:        <div className="absolute right-24 top-1/2 h-16 w-16 rounded-full bg-white/5" />
src/pages/Register.tsx:188:        <div className="absolute inset-0 bg-black/10" />
src/pages/Register.tsx:191:        <div className="absolute right-12 top-12 h-28 w-28 rounded-full bg-white/10" />
src/pages/Register.tsx:192:        <div className="absolute bottom-24 left-16 h-20 w-20 rounded-full bg-white/10" />
src/pages/Register.tsx:193:        <div className="absolute right-24 top-1/2 h-16 w-16 rounded-full bg-white/5" />
```

## Hex / rgb / export renk çağrıları

Komut: `grep -rEn '#[0-9a-fA-F]{3,8}([^0-9a-zA-Z]|$)|rgba?\(|set(Fill|Text|Draw)Color\([0-9]' src` (sonrasında yukarıdaki yol filtreleri).

6 eşleşen satır.

```text
src/utils/sgkExport.ts:99:  doc.setTextColor(100, 100, 100);
src/utils/sgkExport.ts:105:  doc.setTextColor(0, 0, 0);
src/utils/pdksExport.ts:217:    doc.setTextColor(100, 100, 100);
src/utils/pdksExport.ts:219:    doc.setTextColor(0, 0, 0);
src/index.css:18:    --shadow-popover: 0 4px 16px rgb(0 0 0 / 0.10);
src/index.css:273:    .status-purple-text { color: #fff; }
```

## useToast / use-toast

Komut: `grep -rEn 'useToast|use-toast' src` (sonrasında yukarıdaki yol filtreleri).

6 eşleşen satır.

```text
src/hooks/access-rules/useGroupMemberMutations.ts:3:import { useToast } from "@/hooks/use-toast";
src/hooks/access-rules/useGroupMemberMutations.ts:7:  const { toast } = useToast();
src/hooks/access-rules/useGroupDeviceMutations.ts:3:import { useToast } from "@/hooks/use-toast";
src/hooks/access-rules/useGroupDeviceMutations.ts:7:  const { toast } = useToast();
src/hooks/use-toast.ts:171:function useToast() {
src/hooks/use-toast.ts:191:export { useToast, toast }
```

## Emoji taraması

`grep -rEn '[🀀-🫿☀-➿⌚-⌛⏩-⏳⏸-⏺]' src` ve aynı yol filtreleri: **0 satır**.
Klavyedeki `⌘K` işareti emoji değildir; `CommandPalette.tsx:34-35` geniş pictograph taramasındaki yanlış pozitiflerdir.

# C3-ui — küçük UI ve hata düzeltmeleri

## Değişiklikler
- `src/components/employees/SlideOverPanel.tsx:43`, `src/components/devices/DeviceDetailsPanel.tsx:42`: `useProjectChangeGuard(open && (dirty || pending), pending ? () => {} : guard.requestClose)` kullanılır. Taslak varken proje önce değişmez; Vazgeç mevcut projeyi/taslağı korur, Çık proje değişimini yürütür. Bekleyen işlem proje değişimini durdurur. Eski `setActiveProjectId(previous)` geri alma kaldırıldı; temiz panel gerçek proje değişiminde kapanır.
- `convex/shifts.ts:80,82,279`: izin/tatil ve hem tekli hem eski toplu çakışma hataları `ConvexError({code,message,...})`; kodlar `SHIFT_CALENDAR_CONFLICT` ve `SHIFT_OVERLAP`. `CALENDAR:` / `OVERLAP:n` mesajları korunur, topluda `overlapCount`, takvimde `status` bulunur. Query/mutation arg ve başarı sonuçları değişmedi.
- `src/components/shifts/lib/shiftError.ts:5`, `AssignmentEditDialog.tsx:117,243,253`: önce ConvexError `data.code`, eski backend için mesaj ön eki okunur; onay kutuları kod üzerinden görünür.
- `src/components/shifts/ShiftCalendarView.tsx:216`: sayaç altındaki bağımsız arama etiketi kaldırıldı; FilterBar araması erişilebilir etiket ve açıklayıcı placeholder ile kalır.
- `src/components/shifts/ShiftCalendarGrid.tsx:25`: ResizeObserver gerçek yatay taşmayı ölçer; kaydırma ipucu desktop'ta yalnız taşma olduğunda, mobilde görünür. Klavye ile kaydırılabilir bölge korunur.
- `src/components/access-control/CardReadings.tsx:102`: Canlı/Geçmiş düğmelerinin `aria-pressed` değerine A2 `bg-selected`, `border-primary`, `text-primary` ve kalın yazı bağlandı; hover seçimi korur.
- `src/components/leaves/EmployeePicker.tsx:33`: ikinci görünür “Kişi ara” etiketi kaldırıldı; aramada `aria-label="Kişi ara"` ve ayrı id var. LeaveForm'un Kişi etiketi seçime bağlı kalır.
- `src/components/audit/useAuditUrlState.ts:12`, `auditState.ts:33`: modül mutable scope kaldırıldı; önceki scope yalnız mounted hook state'inde tutulur, yükleme sırasında ilk hazır scope başlangıç kabul edilir. Yeni ziyarette derin bağlantının user filtresi korunur; aynı sayfa içindeki gerçek scope değişiminde temizlenir.
- `src/components/devices/DeviceListErrorBoundary.tsx:9`: yeniden deneme error boundary durumunu sıfırlar, alt bölüm yeniden mount olur; tam sayfa reload kaldırıldı.

## Fonksiyon sözleşmeleri
Yeni saf fonksiyonlar:
```ts
type ShiftErrorCode = "SHIFT_OVERLAP" | "SHIFT_CALENDAR_CONFLICT";
shiftError(error: unknown): { code?: ShiftErrorCode; message: string };
auditScopeParams(params: URLSearchParams, previousScope: string | undefined, scope: string): URLSearchParams;
```
`auditScopeParams` yeni URLSearchParams üretir; girdiyi değiştirmez.

Değişen mevcut fonksiyonlar (API değişikliği yok):
```ts
SlideOverPanel(props: { isOpen: boolean; onClose: () => void; employee: Employee | null; onSave: (payload?: unknown) => void; viewMode?: boolean }): React.JSX.Element;
DeviceDetailsPanel(props: { open: boolean; onClose: () => void; selectedDevice: ServerDevice | null; onSuccess: () => void; projectId: Id<"projects"> | undefined }): React.JSX.Element;
EmployeePicker(props: { projectId: Id<"projects">; value: string; onChange: (value: string) => void; control: FieldControlProps; disabled?: boolean }): React.JSX.Element;
ShiftCalendarGrid(props: { employees: Employee[]; days: string[]; getData: (employee: Employee, date: string) => DayData; onOpen: (employee: Employee, date: string) => void; selected: Set<string>; onSelect: (id: string) => void }): React.JSX.Element;
AssignmentEditDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; assignment: Assignment | null; shifts: Shift[]; shiftName: string; employeeName: string }): React.JSX.Element | null;
Plan(props: { projectId: Id<"projects">; projectName: string; employees: Employee[]; shifts: Shift[]; openDefinitions: () => void }): React.JSX.Element;
ProjectReadings(props: { projectId: Id<"projects"> }): React.JSX.Element;
DeviceListErrorBoundary.render(): React.ReactNode;
validateAssignment(ctx: MutationCtx, employee: Doc<"employees">, shift: Doc<"shifts">, range: ScheduleRange, force?: boolean, excludeId?: string, calendarConfirmed?: boolean): Promise<void>;
useAuditUrlState(scope: string, ready: boolean): {
  params: URLSearchParams; search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  update: (key: string, value: string) => void;
  clear: () => void; changingScope: boolean;
};
```

## Doğrulama
- Frontend tsc, Convex tsc: 0 hata.
- `eslint src convex`: 0 hata.
- `npx vitest run`: 104 dosya, 1066 test geçti; yapılandırılmış ve eski vardiya hataları, tekli/toplu atama ve takvim hatası, audit derin bağlantı/scope geçişi regresyonları dahil.
- `npx vite build`: başarılı; mevcut büyük chunk uyarısı var.
- `git diff --check`: temiz.
- Canlı login, veri yazma, deploy, migration, paket kurma, commit/push yapılmadı. UI gerçek oturum kontrolü koordinatörde.

## Koordinatör gerçek oturum akışları (1440px ve 390px)
1. Kişiler → ekle/düzenle → alan değiştir → üst proje seçiciden diğer projeyi seç: proje ilk onaydan önce değişmemeli; Vazgeç taslağı/projeyi korumalı; tekrar seçip Çık yeni projeyi açmalı. Kaydetme sürerken proje değişmemeli.
2. Cihazlar → yeni cihaz marka formu veya mevcut cihaz Ayarlar → alan değiştir → aynı proje guard akışı. Birden çok marka taslağından biri kirliyken de sorulmalı. Komut sürerken proje değişmemeli.
3. Vardiyalar → mevcut vardiyayla çakışan seriyi düzenle: Türkçe çakışma açıklaması ve açık onay kutusu; izin/tatil gününde ayrı takvim onayı. Onay verilmeden kayıt oluşmamalı.
4. Vardiyalar → arama/filter satırı, sayaç altında yüzen etiket olmamalı; 1440px dar gün aralığında ipucu yok, gerçekten taşan haftalık/aylık tabloda var; 390px ajanda ve filtreler ekranı taşırmamalı.
5. Canlı İzleme → Canlı/Geçmiş arasında geçiş: yalnız seçili düğme bordo metin/kenar ve açık seçili zemin; klavye/ekran okuyucu `aria-pressed` doğru.
6. İzin ekle → tek görünür Kişi etiketi; arama klavye ile erişilebilir ve “Kişi ara” adıyla duyurulur.
7. Denetim → başka kapsamda ziyaret edip sayfadan çık → `?user=<geçerli-id>` derin bağlantısını farklı aktif projede aç: user URL'de kalmalı. Sayfa içi global/proje değişiminde user temizlenmeli.
8. Cihaz liste hatasını simüle edip Tekrar dene: sayfa navigation/reload olmadan bölüm yeniden kurulmalı.

## Kapsam notları
- Ortak ağaçtaki başka worker'ın DateInput değişiklikleri (LeaveForm/AssignmentEditDialog/ShiftCalendarView dahil) korunmuştur; bu rapor C3-ui değişikliklerini kapsar.
- MoveReaderDialog `src/components/access-control/MoveReaderDialog.tsx` ownership dışında bulunduğu için koordinatöre izin soruldu; yanıt bekleniyor. Mevcut target shape kapasite içeriyor; ZoneDoorTree değişikliği gerekmiyor.

### MoveReader için hazır, henüz uygulanmayan değişiklik
Yalnız `MoveReaderDialog.tsx`: menüde `targetDoors.filter(door => door.id !== currentDoorId)` gösterilir; her `SelectItem` için `disabled={door.readerCount >= door.maxReaders}` ve metin `{door.name} ({door.readerCount}/{door.maxReaders}){door.readerCount >= door.maxReaders ? " · Dolu" : ""}` kullanılır. Mevcut `availableTargets` seçilebilirlik/doğrulama amacıyla korunur; submit `isSubmitting || !selectedTarget || conflict` ile kilitlenir. Böylece seçim sonradan dolarsa da istemci eski hedef id ile göndermez; sunucu tekrar kontrolü korunur.

## Sonuç
Ana maddeler 1–6 ve DeviceListErrorBoundary retry düzeltmesi tamamlandı; teknik kapılar yeşil. MoveReaderDialog ownership sorusu `msg_a889b1530ac8` 10 dakikada yanıtlanmadı; aynı soru `--resume` ile bekletilip ayrıca koordinatöre durum/escalation gönderildi. Bu tek düşük öncelikli değişiklik uygulanmadığından tam task sonucu **failed (ownership yanıtı bekleyen kısım)** olarak bildirilir; hazır değişiklik tarifi yukarıdadır. Gerçek oturumdaki görsel/etkileşim doğrulaması koordinatöre bırakıldı; login yasağına uyuldu.

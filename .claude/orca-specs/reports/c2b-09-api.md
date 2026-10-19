# C2b-09-api — Vardiyalar backend sözleşmesi

17.10.2026; worker task_6d389efae6e4 / dispatch ctx_e82977351399. Frontend bu dosyadaki sözleşmeyle çalışabilir; dönüşleri `FunctionReturnType<typeof api.shifts.FUNCTION>` ile tüketin.

## Teslim ve kapılar

- `convex/shifts.ts:42`: tekli, düzenleme, preview ve apply için aynı bounded veri yükleyicisi; `convex/lib/shiftAssign.ts:49` saf karar mantığı.
- `convex/shifts.ts:84`: görünür aralık; `:251` preview; `:270` apply kişi sonuçları; `:351` silme etkisi; `:364` tanım kullanımı.
- Yeni `convex/lib/shiftAssign.test.ts`: 22 test; saf mantık ve gerçek handler gövdelerinin bellek adaptörüyle sınanması. Convex auth/validator/runtime yerine test adaptörü kullanılır; canlı DB'ye erişmez.
- `convex/_generated/api.d.ts`: yalnız `lib/shiftAssign` import ve modül satırı eklendi; diğer worker satırları korundu.
- Son kapılar: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` **0**; `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` **0**; `node_modules/.bin/eslint src convex` **0**; `npx vitest run` **87 dosya / 864 test yeşil** (20:09 yerel çalışma ağacı).
- Önceki genel testte `reportScope.test.ts` mock hatası vardı; koordinatör düzeltti, yukarıdaki tam tekrar yeşil. Önceki `accessRules.ts` null hataları da son tip kontrolünde yok.
- Frontend/build bu backend görevinin kapsamında değil. Commit, push, deploy, migration, `convex run/dev/deploy`, kalıcı DB yazımı ve paket kurulumu yapılmadı. `schema.ts` worker tarafından değiştirilmedi.

## Ortak tipler

Aşağıdaki imzalarda `Id` / `Doc`, `convex/_generated/dataModel` tipleridir. Tarihler dahil TR takvim günü `YYYY-MM-DD`, saatler `HH:MM`.

```ts
type WeekPattern = string[]; // yalnız SUN MON TUE WED THU FRI SAT kabul edilir
interface ScheduleRange {
  startDate: string;
  endDate: string;
  weekPattern?: WeekPattern;
}
type Assignment = {
  _id: Id<"shiftAssignments">;
  _creationTime: number;
  employeeId: Id<"employees">;
  shiftId: Id<"shifts">;
  projectId?: Id<"projects">;
  startDate: string;
  endDate: string;
  weekPattern?: string[];
  createdAt: string;
  updatedAt: string;
}; // Doc<"shiftAssignments">
type PreviewStatus = "will_assign" | "conflict" | "on_leave" | "holiday" | "skipped";
type LeaveType = Doc<"leaves">["leaveType"];
interface AssignmentConflict extends ScheduleRange {
  assignmentId: Id<"shiftAssignments">;
  shiftId: Id<"shifts">;
  shiftName: string;
  startTime: string;
  endTime: string;
}
interface AssignmentDecision {
  status: PreviewStatus;
  reason: string;
  occurrenceCount: number; // vardiyanın BAŞLADIĞI gün adedi, kişi-gün/atama serisi sayısı değil
  conflict: AssignmentConflict | null;
  leave: { leaveId: Id<"leaves">; date: string; leaveType: LeaveType } | null;
  holiday: { holidayId: Id<"holidays">; date: string; name: string; isHalfDay: boolean } | null;
}
type EmployeeDecision = AssignmentDecision & {
  employeeId: Id<"employees">;
  employeeName: string; // bulunamayan/yetkisiz kişide boş; isim sızdırılmaz
};
interface BulkCommonArgs {
  projectId?: Id<"projects">;
  shiftId: Id<"shifts">;
  employeeIds: Id<"employees">[];
  startDate: string;
  weekPattern?: string[];
  forceConfirm?: boolean;
  calendarConfirmed?: boolean;
}
```

## `shifts.listAssignments` — query

```ts
args: {
  projectId?: Id<"projects">;
  employeeId?: Id<"employees">;
  shiftId?: Id<"shifts">;
  rangeStart?: string;
  rangeEnd?: string;
  employeeIds?: Id<"employees">[];
}
returns: Assignment[];
```

`rangeStart` ve `rangeEnd` birlikte verilir; tarih farkı en fazla 365 gündür (dahil gün sayısı en fazla 366). Aralık varsa yalnız fiilen görünür bir güne dokunan seriler döner; hafta deseni de uygulanır. Bir önceki gün başlayan gece vardiyasının devamı dahil, önceki günün gündüzü hariçtir. Seri tarihlerinin görünür aralığa kırpılmış kopyası dönmez; özgün seri belgesi döner.

`employeeIds` en fazla 100 giriş; boş dizi boş sonuçtur. `employeeId`, `employeeIds`, `shiftId` birlikte verilirse kesişimleri uygulanır. Görünür aralıkta kişi filtresi varsa `by_employee_end`, aksi halde `by_project_end`; yalnız izinli proje kayıtları döner. Aralıkta yetkisiz/bulunamayan çalışan ID'si açık hatadır. Proje seçilmezse `resolveProjectScope` ile izinli projeler kullanılır.

**Uyumluluk:** aralık verilmezse önceki tüm dönem/proje davranışı ve `Assignment[]` dönüşü korunur; bu eski yol hâlâ `.collect()` kullanır. Yeni frontend sınırlı okumaya geçmek için her çağrıda görünür aralığı göndermelidir. Aralık yolu sessizce kırpılmaz; bütçe aşılırsa `ConvexError`.

## `shifts.previewBulkAssign` — yeni read-only query

```ts
args: BulkCommonArgs & { endDate?: string };
returns: {
  results: EmployeeDecision[];
  summary: {
    total: number;
    willAssign: number;
    conflict: number;
    onLeave: number;
    holiday: number;
    skipped: number;
  };
};
```

`endDate` yoksa `startDate`. Yeni `projectId`, `forceConfirm`, `calendarConfirmed` opsiyoneldir; apply ile aynı girdiyi önizlemek için iki onay da gönderilebilir. Varsayılan onaylar false. Sonuçlar giriş sırasındadır; kişi başına bir karar ve ilk izin/tatil/çakışma ayrıntısı döner. Bu alanlar bütün sorunların listesi değildir. Birden fazla sorun varsa öncelik `skipped` (pasif/eşleşmeyen gün), `on_leave`, `holiday`, `conflict`, `will_assign`; mevcut diğer sorunların ilk ayrıntıları da alanlarda bulunabilir. Özet bu tek ana durumu sayar. Önizleme yazmaz ve kalıcı rezervasyon oluşturmaz.

## `shifts.bulkAssignShift` — mutation, eski alanlara ek sonuç

```ts
type ApplyStatus = "assigned" | "skipped_conflict" | "skipped_leave" | "failed";
type ApplyResult = Omit<EmployeeDecision, "status"> & {
  status: ApplyStatus;
  previewStatus: PreviewStatus;
  assignmentId: Id<"shiftAssignments"> | null;
};
args: BulkCommonArgs & { endDate: string }; // eski required endDate korunur
returns: {
  insertedCount: number;
  skipped: { employeeId: string; reason: string }[]; // eski alan
  overlapCount: number; // ana durumu conflict olan kişi sayısı; çakışan seri sayısı değil
  results: ApplyResult[]; // yeni
};
```

Eski argümanlar korunur; yalnız opsiyonel `projectId` ve ek `results` vardır. **Aynı transaction içinde tüm kişiler tekrar doğrulanır, sonra ilk yazım yapılır.** Uygun kişiye bir seri eklenir, diğer kişi atlanır. Preview'den sonra oluşan çatışma apply'da tekrar görülür. Bütçe/proje/veri bütünlüğü gibi tüm işlem hataları hiçbir kalıcı kısmi yazım bırakmaz. Kişiye özgü bulunamadı/erişim/proje uyuşmazlığı/pasif/gün yok/tatil durumu ise kişi sonucu üretir.

`on_leave` → `skipped_leave`; `conflict` → `skipped_conflict`; `holiday` veya `skipped` → `failed` (ayrım `previewStatus` ve `reason` ile); `will_assign` → `assigned`, gerçek `assignmentId`, `reason="Atandı"`. Başarısız sonuçların `assignmentId` alanı null. `skipped` bütün atanamayan kişileri kapsar.

**Kasıtlı davranış düzeltmesi:** herkes çakışıyorsa artık `OVERLAP` fırlatmak yerine `insertedCount: 0` ve kalıcı gösterilebilir kişi sonuçları döner. Önceki kısmi başarı politikası devam eder. Otomatik tekrar yapılmaz; frontend `results` panelini tutmalı, yalnız atlanan kişileri açıkça yeniden seçmelidir. `forceConfirm=true` açık çakışma onayıdır ve ek atama yaratabilir; yerine koyma/silme yapmaz.

## Tekli ve seri düzenleme — imzalar korunur, aynı yeni karar mantığı

```ts
// shifts.assignShift — mutation
args: {
  employeeId: Id<"employees">;
  shiftId: Id<"shifts">;
  projectId?: Id<"projects">;
  startDate: string;
  endDate: string;
  weekPattern?: string[];
  forceConfirm?: boolean;
  calendarConfirmed?: boolean;
};
returns: Id<"shiftAssignments">;

// shifts.updateAssignment — mutation, tüm seri
args: {
  assignmentId: Id<"shiftAssignments">;
  startDate?: string;
  endDate?: string;
  shiftId?: Id<"shifts">;
  weekPattern?: string[];
  forceConfirm?: boolean;
  calendarConfirmed?: boolean;
};
returns: null; // wire; handler Promise<void>
```

Tarih/hafta/gece/izin kontrolü bulk ile ortaktır. Düzenlenen seri kendi çakışma kontrolünden çıkarılır. `CALENDAR:` ve `OVERLAP:` hata önekleri mevcut onay akışları için korunur. Sadece aralığı kesişen fakat fiili vardiya gününe dokunmayan izin artık onay istemez. Onay yoksa tüm seri atlanır/reddedilir; izinli günleri sessizce çıkartan seri bölme yoktur.

## `shifts.assignmentDeleteImpact` — yeni query

```ts
args: { shiftId: Id<"shifts"> };
returns: {
  assignmentCount: number;
  employeeCount: number;
  truncated: boolean;
  countLabel: string; // yalnız "Toplam" | "En az" üretilir
};
```

Tanımın **tüm dönemlerde** bağlı seri adedi ve benzersiz kişi adedi. `by_shift` ile en fazla 5001 kayıt (5000 + sentinel) okunur. `truncated=false` tam sayıdır; true olduğunda iki sayı da gözlenen kayıtlardan **alt sınırdır**, kesin toplam değildir. Örnek: `5001, 120, true` → “En az 5001 atama serisi · En az 120 kişi”. Yükleniyor/hata halinde 0 varsaymayın. Yetkisiz tanım veya okunan atamada tanımdan farklı proje bilgisi açık hatadır; kayıtlar sessizce süzülerek etki eksiltilmez.

## `shifts.definitionUsage` — yeni query

```ts
args: { shiftId: Id<"shifts"> };
returns: {
  assignmentCount: number;
  employeeCount: number;
  scannedAssignmentCount: number;
  truncated: boolean;
  countLabel: string; // "Toplam" | "En az"
  asOfDate: string; // sorgu anının İstanbul günü
  affectsHistoricalAssignments: boolean; // daima true
};
```

Bugün veya gelecekte fiilen uygulanan seri/kişi sayısı; dün başlayıp bugüne devam eden gece de aktiftir. Hafta deseninde hiçbir uygulama günü olmayan seri sayılmaz. Tanım pasif olsa bile mevcut/gelecek atamaları kullanım olarak sayılır. Haftalık desen nedeniyle ilk uygun aralığın en fazla bir haftası kontrol edilir; tarihsel uzun seriler bütünüyle genişletilmez.

Aynı 5001 sentinel ve `truncated` alt-sınır sözleşmesi geçerli. Çok tarihsel kayıt varsa gelecekteki kayıtlar okunmuş 5001 içinde olmayabilir: örneğin `assignmentCount:0,truncated:true` **“Kullanılmıyor” değildir**. `scannedAssignmentCount` kontrol edilen tüm dönem satırı adedidir. Tanım saat değişikliği geçmişteki görünümü de değiştirir; sürümleme/dondurma eklenmedi. UI hem aktif/gelecek sayıyı hem bu uyarıyı göstermelidir. `asOfDate` sorgunun çalıştığı gün olduğundan gece yarısı sonrası güncellik için UI yeniden sorgu ihtiyacını gözetmelidir.

`shifts.update` değişmedi; frontend etkiyi güncelleme formundan önce `definitionUsage` ile okuyabilir:

```ts
args: {
  shiftId: Id<"shifts">;
  name?: string;
  startTime?: string;
  endTime?: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  lateToleranceMinutes?: number | null;
  earlyExitToleranceMinutes?: number | null;
  overtimeStartToleranceMinutes?: number | null;
  overtimeEnabled?: boolean;
  isActive?: boolean;
};
returns: null; // wire; handler Promise<void>
```

## Silme mutation'ları

```ts
// shifts.remove — tanımı ve bağlı tüm serileri siler
args: { shiftId: Id<"shifts"> };
returns: { removedAssignments: number };
// Yeni koruma: 5000'den fazla bağlı seride açık ConvexError, hiçbir kısmi silme yok.
// Tanım/atama proje uyuşmazlığında da işlem başlamadan hata.

// shifts.removeAssignment — mevcut, değişmedi
args: { assignmentId: Id<"shiftAssignments"> };
returns: null; // wire; handler Promise<void>

// shifts.bulkRemoveAssignment — mevcut, değişmedi
args: { assignmentIds: Id<"shiftAssignments">[] };
returns: { deleted: number };
```

Silme etkisi query'si yalnız `shiftId` kabul eder; `assignmentIds` seçeneği eklenmedi (spec alternatiflerinden tanım yolu seçildi). Tek seri silme gün değil tüm seridir. Eski toplu silme bulunamayan/yetkisiz kayıtları atlama davranışını korur.

## Kurallar ve durum etiketleri

| Enum | Türkçe etiket |
|---|---|
| `will_assign` | Atanacak |
| `conflict` | Mevcut vardiyayla çakışıyor |
| `on_leave` | Onaylı izinle çakışıyor |
| `holiday` | Tatil gününe denk geliyor |
| `skipped` | Atlanacak — gerekçeyi göster |
| `assigned` | Atandı |
| `skipped_conflict` | Çakışma nedeniyle atlandı |
| `skipped_leave` | İzin nedeniyle atlandı |
| `failed` | Atanamadı — gerekçeyi göster |

- Eksik veya boş `weekPattern` eski davranışla **her gün** demektir. Geçersiz gün kodu, geçersiz tarih, ters tarih veya 365 günden büyük fark reddedilir. Geçerli desen ama aralıkta eşleşen gün yoksa kayıt oluşturulmaz.
- Aralık vardiyanın başlangıç günlerini ifade eder. Pzt 22:00–Sal 06:00, Pzt desenindeyken Sal izin/tatilini de kontrol eder; Sal desenine ayrıca seçilmiş olmak gerekmez. Bitiş tam 00:00 ise ertesi güne çalışma süresi düşmez.
- `[başlangıç,bitiş)` saat aralıkları: bir vardiya tam diğerinin bittiği anda başlarsa çakışma değildir. Molalar saat çakışması aralığını bölmez; mevcut yaklaşım korunur.
- Yalnız `status="approved"` izinler engeldir. SHF-UI-20 örneği (yalnız Pzt/Cum + Çar izin) atamayı engellemez. İzin türünün tam etiketi frontend sözlüğünden alınır.
- Kişinin projesindeki ve global `projectId=undefined` tatiller birlikte kontrol edilir. `isHalfDay` ayrıntıda döner; schema'da yarım günün saat dilimi bulunmadığından mevcut yaklaşım korunarak tüm tarih takvim uyarısı sayılır.
- `calendarConfirmed=true` izin/tatil engelini kaldırır; ayrıntılar hâlâ döner. `forceConfirm=true` yalnız vardiya çakışmasını kaldırır. Bir onay ötekinin yerine geçmez.
- Sonuçlar karar anını yansıtır; preview geçerli apply garantisi değildir. Tek gün istisnası, seri bölme, tarihsel sürümleme ve PDKS hesabı eklenmedi.

## İndeksler, bütçeler ve açık sınırlar

Koordinatör ask yanıtıyla `convex/schema.ts` içine ekledi (worker bu dosyaya yazmadı):

```ts
// shiftAssignments
.index("by_project_end", ["projectId", "endDate"])
.index("by_employee_end", ["employeeId", "endDate"])
```

`endDate >= görünür/atanacak başlangıç - 1 gün` ile bitmiş geçmiş atlanır; `startDate` üst sınırı ve fiili gün/saat kesişimi bellek içinde kontrol edilir. Uzun süreli seriler kaçırılmaz. Proje+kişi+iki taraflı interval kesişimini tek indekste tam çözmek mümkün olmadığından çok gelecek seri bütçeyi tüketebilir; eksik başarı yerine hata döner. Kişi filtresi bunun kapsamını daraltır. Yeni indeksler deployment'a henüz gönderilmedi; koordinatörün backend yayımlamasına dahildir.

`projectId=undefined` eski atamalar `by_project_end` proje yolunda görünmez; eski `by_project` sorgusu da yalnız izinli gerçek proje ID'lerini sorguladığından aynı kayıtları göstermiyordu. Yeni preview/impact orphan tanımı kabul etmez; legacy ilişki/proje tutarsızlıkları açık hatadır.

- Preview ve apply **1–100 kişi**, yinelenen kişi ID'si reddedilir. Önceden bulk kodunda açık bir kişi sınırı yoktu; 100 ortak sınırı koordinatör tarafından onaylandı.
- Görünür liste `employeeIds` en fazla 100; kimliksiz proje yolu da aday bütçelidir.
- Tekli kontrol / preview / apply / aralıklı liste başına **5000 ortak bütçe**: aday atamalar, okunan izin/tatil satırları ve cache dışı bağlı vardiya okumaları. Çalışan/ana tanım/yetki altyapısı okumaları bu aday bütçesine dahil değildir. Cache tekrar eden vardiyayı/proje tatilini yeniden okutmaz.
- İzinlerde mevcut `by_employee` kullanılır; onaysız ve tarihsel izinler de aday bütçesi tüketir. Holiday mevcut `by_project_date` ile tarih aralığına sınırlıdır; gece devamı için son gün +1 dahil.
- Her aday okumasında kalan bütçe +1 sentinel istenir; aşım `ConvexError`, sessiz `take()` eksiltmesi yok. Hata metni: “Atama kontrolü 5000 kayıt okuma sınırını aşıyor. Daha az çalışan veya daha dar bir tarih aralığı seçin.”
- Etki/kullanım ayrı `by_shift` 5001 alt-sınır sözleşmesi kullanır; 5000 üstü tanım silme mutation'ı açıkça reddedilir. Büyük silme için mevcut seri silme akışlarıyla küçük gruplar gerekir; scheduler/migration eklenmedi.
- Eski aralıksız liste/tanım listesi ve yetki yardımcılarının mevcut `.collect()` yolları refactor edilmedi. Bu yüzden bounded garantisi **yeni aralıklı ve kontrol yollarına** aittir; eski çağrının tüm proje geçmişi davranışını korumak için bilinçli uyumluluk sınırıdır.

## Saf yardımcı API

`convex/lib/shiftAssign.ts` DB/auth içermez:

```ts
const BULK_ASSIGN_LIMIT = 100;
const ASSIGNMENT_SCAN_LIMIT = 5000;
type ShiftClock = Pick<Doc<"shifts">, "startTime" | "endTime">;
interface ExistingShiftAssignment extends ScheduleRange {
  assignmentId: Id<"shiftAssignments">;
  shiftId: Id<"shifts">;
  shiftName: string;
  shift: ShiftClock;
}
shiftDateOffset(day: string, offset: number): string;
validateAssignRange(range: ScheduleRange): void;
assignmentIntersectsRange(range: ScheduleRange, shift: ShiftClock, start: string, end: string): boolean;
evaluateShiftAssignment(input: {
  range: ScheduleRange;
  shift: ShiftClock & { isActive?: boolean };
  existing: ExistingShiftAssignment[];
  leaves: Pick<Doc<"leaves">, "_id" | "status" | "startDate" | "endDate" | "leaveType">[];
  holidays: Pick<Doc<"holidays">, "_id" | "date" | "name" | "isHalfDay">[];
  forceConfirm?: boolean;
  calendarConfirmed?: boolean;
}): AssignmentDecision;
```

Çakışma karşılaştırması sıralı saat aralıklarında iki işaretçiyle yapılır; uzun mevcut seriler aday aralığının bir gün öncesi/sonrasına kırpılarak genişletilir. Testler gece/00:00, yıl/ay/leap-day sınırı, farklı tekrar günleri ve ayrık saatler, onayların ayrılığı, eksik/pasif/hedefsiz kişi, sıfır başarılı ve kısmi toplu sonuç, yazımdan önce aşım, doğru indeks seçimi, tam/alt-sınır silme etkisi, TR gün değişimi ve aktif/gelecek sayımını kapsar.

## Koordinatör/frontend kontrolü

Gerçek oturumda aralık payload'ını, preview→iki ayrı onay→apply, bütün kişilerin çakıştığı sıfır başarı panelini ve yalnız atlananları yeniden seçmeyi kontrol edin. “En az” sayıları kesin toplam veya “kullanılmıyor” diye göstermeyin. Tanım değişikliği formunda geçmişin de etkilendiğini belirtin; silme etkisi yüklenene kadar silme onayını açmayın. Canlı Convex transaction/concurrency ve büyük veri performansı burada ölçülmedi; test adaptörü handler mantığını doğrular.

## Düzeltme (api-fix)

- `convex/shifts.ts:271`: `bulkAssignShift` yeni opsiyonel **`resultMode?: "detailed"`** argümanı alır. Yeni frontend bunu göndermeli. Detailed mod tüm kişi sonuçlarını, sıfır başarılı çakışma dahil, döndürür. Arg verilmezse eski davranış birebir korunur: `forceConfirm` yok, çakışma var ve atanabilir hiç kişi yoksa **tam `OVERLAP:n`** hatası yazımdan önce atılır. Eski kısmi başarı davranışı sürer; explicit forceConfirm atamayı sağlar. Önceki “herkes çakışınca artık hata yok” açıklaması yalnız detailed mod için geçerlidir.
- `convex/shifts.ts:64`: relevant eski atamada `projectId` yoksa yalnız o kişi preview'da `status:"skipped"`, apply'da mevcut sözleşmeyle `status:"failed",previewStatus:"skipped"`, `reason:"Eski kayıt proje bilgisi içermiyor"` olur; diğerleri devam eder. Yabancı proje/tutarsız vardiya hataları gizlenmez.
- `assignmentDeleteImpact`, `definitionUsage`, `remove`: projesiz eski atamalar sayılmadan/silinmeden bırakılır; diğer geçerli atamalar işlenir. **Ek dönüş alanı `skippedAssignments:number`** üç endpoint'te vardır. Etki/kullanım sayıları yalnız doğrulanmış proje kayıtlarını kapsar; `scannedAssignmentCount` hariç tutulanları da içerir. 5001 sentinel `truncated` alt sınır kuralı aynı. `remove` tanımı ve proje doğrulanmış serileri siler; projesiz eski seriler DB'de kalır, temizleme/migration bu görevde yoktur. `bulkRemoveAssignment` da projesiz kaydı atlar, yalnız gerçekten silinenleri `deleted` sayar; imzası aynı.
- Eski/detailed/onay modları, legacy kayıt bulunan iki kişilik toplu atama, silme etkisi/kullanımı ve korunan legacy seri için testler eklendi. Convex tsc 0, eslint convex 0; tam Vitest 93 dosya / 943 test yeşil. Sözleşme ekleri koordinatöre bildirildi.

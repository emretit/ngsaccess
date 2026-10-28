# Vardiya Faz 2–4 — Codex tasarım önerisi

23.10.2026 · Salt okunur kaynak incelemesi; yalnız bu belge yazıldı. Satırlar inceleme anını gösterir; paralel Faz 1 değişiklikleri kaydırabilir. Diğer tasarımcı dosyası okunmadı; DB/git yazma/Convex CLI kullanılmadı.

## 1. Ana kararlar

| Konu | Öneri |
|---|---|
| Model | `shifts` saat/kural tanımı olarak kalır; yeni `shiftSchedules` hedef + tarih + tekrar + günlük vardiya listesidir. Eski `shiftAssignments` korunur ve aynı resolver'da okunur. |
| Öncelik | Kişi ataması → en yakın uygulanabilir departman ataması → `employees.shiftId` → proje saatleri; kazanan günlük liste bütünüyle seçilir, farklı atamalar birleştirilmez. |
| Boş gün | `off` kesin dinlenmedir, alt önceliğe düşmez; `inherit` o gün için atama yoktur. Eski boş `weekPattern` yine **her gün** demektir. |
| Çoklu | Başlangıç üst sınırı **16 vardiya/iş günü**; sabit ürün kotası değil sunucu sabiti, ölçümle artırılabilir. Çakışan çalışma aralıkları reddedilir; belirsiz okutma incelemeye gider. |
| Uyumluluk | Eski plan + tek vardiya sonuçları/DTO'ları birebir korunur; yeni planlar ayrı, açık protokol ile tüketilir. İlk vardiyayı seçip diğerlerini gizleyen adaptör yasak. |

## 2. Veri modeli ve geçiş

Mevcut dayanak: `convex/schema.ts:1025` kişi+tek vardiya ataması; `:96` departman, `:99` varsayılan vardiya; `:228` departman ağacı. Faz 1'in `shifts` alanları aynen kalır; rotasyon bu alanları kopyalamaz.

### Şema eklemeleri (`convex/schema.ts` içine)

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

const daySlot = v.union(
  v.object({ kind: v.literal("inherit") }),
  v.object({ kind: v.literal("off") }),
  v.object({ kind: v.literal("work"), shiftIds: v.array(v.id("shifts")) }),
);
const schedulePattern = v.union(
  v.object({ kind: v.literal("weekly"), slots: v.array(daySlot) }),
  v.object({
    kind: v.literal("dayCycle"), anchorDate: v.string(),
    slots: v.array(daySlot),
  }),
  v.object({
    kind: v.literal("weekCycle"), anchorDate: v.string(),
    slots: v.array(daySlot),
  }),
);
const scheduleFields = {
  projectId: v.id("projects"),
  startDate: v.string(), endDate: v.string(), pattern: schedulePattern,
  createdAt: v.string(), updatedAt: v.string(),
};
// defineSchema({...}) içine ekle; mevcut tabloları kaldırma.
const shiftSchedules = defineTable(v.union(
  v.object({ ...scheduleFields,
    targetKind: v.literal("employee"), employeeId: v.id("employees") }),
  v.object({ ...scheduleFields,
    targetKind: v.literal("department"), departmentId: v.id("departments") }),
))
  .index("by_projectId_and_endDate", ["projectId", "endDate"])
  .index("by_employeeId_and_endDate", ["employeeId", "endDate"])
  .index("by_departmentId_and_endDate", ["departmentId", "endDate"]);

// İç içe dizide shiftId indekslenemez; tanım silme/kullanım kontrolü için ters referans.
const shiftScheduleRefs = defineTable({
  scheduleId: v.id("shiftSchedules"), shiftId: v.id("shifts"),
})
  .index("by_shiftId", ["shiftId"])
  .index("by_scheduleId", ["scheduleId"]);

// Günlük pdksRecords tek giriş/çıkışı çoklu vardiyalara kopyalanmaz.
const pdksShiftCorrections = defineTable({
  projectId: v.id("projects"), employeeId: v.id("employees"), date: v.string(),
  scheduleId: v.id("shiftSchedules"), shiftId: v.id("shifts"),
  entryISO: v.optional(v.string()), exitISO: v.optional(v.string()),
  note: v.string(), editedBy: v.id("users"), editedAt: v.number(),
})
  .index("by_employeeId_and_date", ["employeeId", "date"])
  .index("by_scheduleId", ["scheduleId"]);
```

**Mutation doğrulamaları** (`v.array/string/number` tek başına yeterli değil):

- Tarihler gerçek `YYYY-MM-DD`; tarih sırası ve mevcut `validateRange` üst sınırı korunur (`convex/lib/shiftUx.ts:11`; bitiş dahil en çok 366 gün). Departman/personel/vardiyalar aynı yetkili projede; `schedule.manage` ve sunucudan kimlik zorunlu.
- `weekly`: Pazartesi→Pazar tam 7 slot; `dayCycle`: 1–366 slot; `weekCycle`: 7×N slot, N=1–52, anchor Pazartesi; döngüde `inherit` reddedilir. Anchor değişmeden tarih aralığı kırpılabilir.
- `work.shiftIds`: 1–16, benzersiz; plan başına benzersiz vardiya sayısı ≤128, böylece ters referans mutation'ı sınırlı. Boş liste geçersiz; dinlenme yalnız `off`.
- Atanacak vardiyalar aktif, tanımları mevcut olmalı; aynı güne aynı tanım iki kez atanamaz (tekrar saatleri için ayrı saat tanımı gerekir). Gece D+1 taşması dahil sıfırdan büyük süre/çakışma kontrolü.
- Referanslar planla aynı transaction'da eşitlenir; `(scheduleId, shiftId)` eşsizliği mutation tarafından sağlanır, indeks tek başına unique değildir. Tanım silme eski atamalar+varsayılanlar+refs kullanılıyorsa engellenir (`convex/shifts.ts:295,473`). Departman silme yeni atama referansını da kontrol eder (`convex/departments.ts:88`).
- Düzeltmede `editedBy` argümandan alınmaz; `(employeeId,date,scheduleId,shiftId)` tek kayıt, etkili occurrence ve ISO/pencere kontrolü zorunlu. Plan değişirse yetim düzeltme gizlenmez: `staleCorrection` inceleme nedeni olur.

### Widen → migrate → narrow

| Adım | İşlem / geri dönüş |
|---|---|
| Widen | Üç yeni tablo, yeni `shiftSchedules` API modülü ve ortak resolver ekle; eski tablo/alan/endpoint'leri değiştirme. Yeni yazıcılar, hesap motoru hazır olana kadar açılmaz. Faz 1 tamamlandıktan sonra uygulanır. |
| Migrate | **DB backfill gerekmiyor.** Eski atama bellekte `weekly` plana çevrilir: eşleşen gün `[shiftId]`, diğer gün `inherit`; `weekPattern` yok/boşsa 7 gün çalışma. `employees.shiftId` yerinde kalır. Gecikmeli eski istemci yazıları da hemen görünür. |
| Narrow | Önce yeni web yeni plan API'sine geçer; eski API eski tabloyu okumaya/yazmaya devam eder. Faz 2–4 kapsamında eski şema daraltılmaz/silinmez; legacy adapter kalıcı uyumluluk katmanıdır. İleride eski API kapatılırsa ayrı idempotent, cursor'lı migration gerekir; bugün `@convex-dev/migrations` kurulmaz. |

Yeni UI'da eski atamayı dönüştürme: tek mutation içinde kaynağı oku/doğrula, yeni plan+refs yarat, eski kaydı sil; tarih/`updatedAt` korunur, faz önceliği yanlışlıkla değişmez. Eski ID kullanan gecikmiş edit “atama değişti” hatası alır; aynı kayıt iki tabloda etkin bırakılmaz. Legacy endpoint'in dönüş şekline departman kayıtları sokulmaz; eski `bulkAssignShift/updateAssignment` çakışma denetimi yeni planları da görür. `clearAssignments` yalnız eski kayıtları siler; yeni UI tüm kapsamı açıkça belirten yeni preview/clear kullanır. Yeni planlar varken eski yönetim ekranı eksik liste gösterir; dağıtımda yeni web sürümü zorunlu tutulur.

## 3. Çözümleme ve sınırlı okuma

```ts
type ResolvedPlan = {
  kind: "work" | "off" | "project";
  shifts: Doc<"shifts">[]; // saat sıralı
  source: "employee" | "department" | "default" | "project";
  assignmentId?: Id<"shiftAssignments"> | Id<"shiftSchedules">;
  departmentId?: Id<"departments">;
};
// İstenen yüzey: resolve(employee, date) = resolvePlan(employee, date).shifts
// Hesap motoru resolvePlan kullanır: [] tek başına off/proje ayrımı yapamaz.
```

1. Yetkili kapsamı yükle; tarih aralığı dışındaki veya `inherit` slotlu kayıtları aday sayma.
2. Kişinin eski+yeni atamalarını tek kümede `updatedAt DESC, _creationTime ASC, _id ASC` sırala. İlk uygulanabilir atama bütün günü kazanır. Legacy eşit `updatedAt` sırası mevcut indeks okuma sırasıyla karşılaştırmalı test edilir (`convex/lib/shiftResolver.ts:65`).
3. Kişi adayı yoksa kendi `departmentId`'sinden `parentId` boyunca yukarı çık; **o tarihte uygulanabilir** ataması olan ilk departmanda aynı son güncelleme kuralı. En yakın departmanın `inherit` günü üst departmana geçer, `off` günü geçmez.
4. Sonra `employees.shiftId`; sonra `kind: project, shifts: []`. Bozuk yeni referans/hiyerarşi durumunda sessiz varsayılan yok: typed hata/inceleme. Legacy kayıp tanım için mevcut fallback davranışı korunur (`shiftResolver.ts:82`).
5. Slot içi vardiyalar sabitte `startTime`, esnekte `checkInStart` ile, eşitlikte ID ile sıralanır. İstemcinin sürükleme sırası hesap önceliği değildir. Atamalar üst üste gelince otomatik toplama yapılmaz; aynı günün iki vardiyası tek slotta tanımlanır.

**Döngü hesabı:** `ordinal(YYYY-MM-DD)` UTC takvim gün numarası; `mod(x,n)=((x%n)+n)%n`. Gün döngüsü `mod(ordinal(D)-ordinal(anchor), slots.length)`; hafta döngüsü Monday anchor ile aynı formül, uzunluk `7N`; haftalık desen Pazartesi=0. İstanbul yerel tarihi kullanılır, timestamp farkını 24 saate bölerek DST hesabı yapılmaz. `2 sabah · 2 akşam · 2 boş`: `[S,S,A,A,off,off]`, anchor birinci sabah; anchor öncesi tarihler de pozitif mod ile çözülür.

**Önizleme/çakışma:** Etkin takvimi D−1…D+1 ile değerlendir; aynı hedef/tarih üstüne yeni plan farklı saatlerde olsa dahi günün yerine geçeceğini bildir. Kullanıcı override onayı yalnız atama önceliğini kabul eder; aynı kazanan listedeki fiziksel çakışmayı veya 16 sınırını aşamaz. Kişi/departman öncelik gölgelenmesi önizlemede ayrı gösterilir. Departman önizlemesi sayfalı örnekler/etki sayısı verir, tek mutation tüm çalışanları gezmez; yeni departman üyelerinin kişisel planlarıyla oluşan komşu gün çakışması çalışma anında da kontrol edilir.

| Okuma / hesap | Somut sınır ve yöntem |
|---|---|
| Atamalar | Eski `by_employee_end`; yeni employee/department+endDate indeksleri ile `endDate >= from−1`, sonra sınırlı sonuçta `startDate <= to+1`. Başlangıç ve bitiş aralığını tek B-tree ile tam filtreleyebildiğimizi varsayma. |
| Bütçe | İlk öneri: istek ≤100 çalışan, ≤31 görünür gün, hedef başına ≤256 aday, toplam ≤5.000 atama ve ≤1.024 referans tanımı; her okumada kalan bütçe+1 sentinel, aşınca typed limit hatası, **kesilmiş doğruymuş gibi sonuç yok**. Ayrıca toplam okuma byte bütçesi 8 MiB; büyük desenler için paginate `maximumBytesRead` kullan, `.take()` tek başına byte koruması değildir. |
| Departmanlar | İlgili ancestor'ları dedupe/cache; derinlik ≤32, benzersiz node ≤512; cycle/başka proje parent hata. Sabit `level` alanına güvenme. Kişi aktarımı sonraki çözümde otomatik etkili. |
| Tanımlar | Yalnız varsayılanlar+aday slot referansları `db.get`; `Doc|null` için type guard. Tüm `shifts.collect()` kaldırılır (`shiftResolver.ts:35`); planları gün başına DB'den okumak yok. |
| Bellek | Atamaları bir kez sırala, departman/gün ve kişi/gün sonuçlarını cache'le; gün başına ≤16 instance. Atama desenini tüm tarihçeye açma, yalnız sorgu aralığına aç. |
| PDKS geniş aralık | `pdksTableQuery.ts:58,123,217` şu an tüm kapsamı okuyup satır üretir; yeni sayfalı endpoint çalışan sayfası × ay döndürür, sınırları çalışanlar/okutmalar/izinler/manual/availability dahil bütün loader'lara uygular. Eski endpoint DTO'su aynı, büyük kapsam için açık limit hatası. |
| Haftalık bordro | `overtimePeriodRange` ile tam hafta ve gece tamponu yükle; normal sınır 31 görünür güne rağmen hesap aralığı ≤45 gün olabilir. Ay parçalarının fazla mesailerini toplama: tam hafta sonucunu bir kere hesaplayıp görünür günleri seç. Büyük export ayrı cursor'lı job; tutarsız revision görürse yeniden üret. |

**Geçmiş departman politikası (açık karar):** Faz 2 için mevcut `departmentId/parentId` çözümleme anındaki ağacı esas alır; geriye dönük yeniden hesapta bölüm değişikliği geçmişi değiştirebilir. Geçmişi dondurma istenirse üyelik/ağaç effective-date modeli ayrıca gerekir; mevcut veriden doğru geçmiş backfill edilemez. Bu öneri yeni işe/departmana gireni otomatik kapsar, geçmiş üyelik doğruluğu iddiasında bulunmaz.

## 4. Hesap motoru

### Tek vardiya uyumluluk yolu

Eski veriden üretilen planlar, aynı girdilerle mevcut `groupPdksWorkDays → computePdksDay → classifyPdksDay` yolunu kullanır; yeni opsiyonel alanlar eski DTO'ya eklenmez. Faz 1 bitmiş hali referans alınır. Sadece yeni plan günü veya komşu günde çoklu occurrence varsa ortak allocation gerekir; tüm aralık legacy tek vardiya ise eski yol birebir çalışır. Yeni tek vardiyalı rotasyon aynı çekirdek hesabını kullanır, yalnız explicit `off` farklıdır.

### Ortak occurrence / okutma dağıtımı

Yeni saf `pdksScheduleDay.ts` + `pdksOccurrenceAllocation.ts`; tablo/detay/bordro/rapor/mobil hepsi aynı sonuçtan beslenir.

1. İş günü D, vardiyanın başladığı yerel tarihtir. D−1…D+1 instance'larını oluştur: kimlik `scheduleId:workDate:shiftId`; bitiş `<= başlangıç` ise eski sabit kural gibi ertesi gün. Döngünün slotu her zaman başlangıç tarihinden gelir. Ham okuma aralığı gece kuyruğu için genişletilir; yalnız istenen iş günleri döndürülür.
2. Her aday için kendi iş gününün PDKS kural sürümüyle `matchesPdksCheckpoint/effectiveDirection` uygula; erişimi reddedilen okuma süre üretmez. Önce tüm okutmayı takvim gününün kuralıyla filtreleyip gece verisini kaybetme (`pdksWorkDay.ts:200`).
3. Çoklu günün sabit vardiyalarında **Faz 1 `validWindow` zorunlu**; esnekte mevcut pencereler kullanılır. Pencere olmayan sabit tanım tekli kalabilir; çoklu atamada kullanıcı tanım penceresini tamamlar. Bu, belirsiz “gün boyu geçerli” varsayımını kaldırır.
4. Yönlü okumanın giriş/çıkış rolüne uyan adayları bul; tek aday varsa ata. Birden fazla sabit aday varsa kendi planlı giriş/çıkış saatine mesafe en küçük olanı seç; eşitse `ambiguousPunch`. Yönsüz okuma ancak tek instance adayı varsa o instance'ın mevcut pairing algoritmasına gider. Hiç aday yoksa `outsideWindow`; okuma silinmez, inceleme sepetine gider. Tüketilen okuma ID'si employee+aralık boyunca tek sahipli tutulur.
5. Esnek ile sabit/esnek karışımı desteklenir; esneğin mümkün oturum zarfı `[checkInStart, checkOutEnd(+offset)]` diğer instance'ın zarfıyla çakışıyorsa atama reddedilir. Çıkış, ilgili esnek giriş ve `maxSpanMinutes` ile ayrıca doğrulanır; belirsiz esneği “en yakın” diye tahmin etme. Gece komşuluğu aynı kontrolden geçer.
6. Instance içinde mevcut `firstLast/eachPunch` uygulanır. Farklı instance'lara dağılmış giriş/çıkış eşleştirilmez; vardiya sınırında sanal okutma yaratılmaz. Örnek 08–12 + 13–17 ve yalnız 08 giriş/17 çıkış → iki eksik instance ve inceleme; otomatik 8 saat yazılmaz. Tamamlanan iki instance'ın gerçek aralıkları birbirini keserse ikisinin çakışan hesapları incelemeye alınır, aynı dakika iki kez sayılmaz.
7. Pencere dışı/belirsiz okutma D'nin inceleme listesinde tek kayıt; muhtemel etkilenen instance'lara ID referansı verilir. Kesin iş günü belirlenemiyorsa ham takvim gününde saklanır/gösterilir, aday günler işaretlenir; süre/devamsızlık tahmini yapılmaz.

### Mola, mesai, birleşik durum

| Konu | Kural |
|---|---|
| Süre/mola | Net süre instance netlerinin toplamı; ilk giriş–son çıkış farkı **değil**. `eachPunch`: ara çıkış zaten düşülür, ikinci mola yok (`pdksDay.ts:157`). `firstLast`: sabitte kendi planlı mola veya mevcut otomatik mola, esnekte kendi duration/existingLegal; vardiyalar arası boşluk çalışma değildir, ek mola olarak bir daha düşülmez. Otomatik molanın instance başına uygulanması bilinçli ürün kararıdır. |
| Geç/erken/eksik | Faz 1 devamsızlık ve pencere kuralları her instance'a uygulanır. `lateMinutes`, `earlyExitMinutes`, ölçülebilen eksik dakika toplanır; vardiya sayısı ve eksik vardiya sayısı ayrıca döner. Devamsız bir vardiya çalışılmış diğer vardiyanın süresini silmez. |
| Gün statüsü | Önce employment/future/veri-yok/izin korumaları; zorunlu instance'ların herhangi biri incelemelikse `incomplete`; tamamı devamsızsa `absent`; bir kısmı devamsızsa `incomplete` + `partialAbsence`; hepsi tamamlanmış ve biri geçse `late`, aksi `present`. Açık/pending instance varken gün kesin present/absent sayılmaz (`future` + alt sonuçlar). İzin/tatil etiketleri yanında review ayrıca görünür. |
| Dinlenme | `off`: beklenen süre=0, proje/default fallback yok. Yeni DTO `planKind: off`; eski statü enum'u genişletilmeden `weekend` uyumluluk karşılığı + UI'da “Planlı dinlenme”. Okutma varsa `unplannedWork` incelemesi; onaylanmadan otomatik normal gün/mesai yapılmaz. |
| Takvim | Eski haftalık atama + proje `workingDays` davranışı aynen kalır. Yeni `work` slotu çalışma beklentisini açıkça belirler; normal hafta sonuna denk gelse zorunludur, hafta sonu mesai sınıflaması ayrı korunur. Resmi tatil beklentisini Faz 1 `holidayWorkRequired`, izin ve yarım tatil kuralları belirler. |
| Fazla mesai | Sabitte bitiş+tolerans sonrası, esnekte net hedef+tolerans üstü; yalnız o instance'a ait net aralıklar. Başka vardiyanın normal süresi öncekinin mesaisi değildir. `overtimeEnabled`, tatil/gece katsayıları instance düzeyinde. `overtimeSegments` birleştirilip mevcut `calculatePeriodOvertime` **kişi/dönem başına bir kere** çağrılır; haftalık eşik vardiya başına sıfırlanmaz (`overtimeCalc.ts:118`). |
| Tatil/gece | `shiftStartDay/splitAtMidnight` seçeneği aynen; gerçek gece/tatil dakika sınırları korunur (`pdksDay.ts:218`). Gün sayıları bir kez, süreler segment bazlı; karma tatil zorunluluğunda vardiya sonuçları görünür, tek `classification` alanı bordronun tek dayanağı olamaz. |
| Manuel kayıt | Legacy `pdksRecords` tekli günde aynen. Çoklu güne eski günlük manuel kayıt varsa otomatik çoğaltma yok: `unscopedManual` review; kullanıcı yeni vardiya düzeltmelerine açıkça dönüştürür. Eski manuel mutation çoklu güne yazmayı açıklayıcı hatayla reddeder; yeni API ISO tarihli occurrence düzeltmesi alır. |

### Değişiklik haritası (satırlar mevcut kod)

| Dosya:line | Uygulama değişikliği |
|---|---|
| `convex/lib/shiftResolver.ts:24,29,51,77` | Yeni resolver'a geçiş; `resolvePlan/resolveMany`, legacy tekli wrapper yalnız uygun yerde. |
| `convex/lib/pdksWorkDay.ts:27,50,141,182` | Çoklu occurrence gün sahipliği, esnek keşfi, kural sürümü; legacy yol korunur. |
| `convex/lib/pdksDay.ts:52,132,158,186,276` | Tek instance çekirdeği korunur; Faz 1 ortak kuralları kullanılır; aggregation ayrı modülde. |
| `convex/lib/pdksPunchPairs.ts:30,47` | Tek instance pairing; kaynak ID/ownership izi yeni allocation modülünde, globale ikinci pairing yapılmaz. |
| `convex/lib/pdksFlexible.ts:50,53,68` | Pencere, max span, pending hesabı instance başına reuse. |
| `convex/lib/pdksTable.ts:41,108,241,292` | Gün reducer'ı, `shiftResults`, review gerekçeleri, günlük sayımlar; tablo statüsü ile alt statüler ayrılır. |
| `convex/lib/pdksDetail.ts:16,108`, `pdksPayroll.ts:15` | Aynı birleşik hesap; tek günlük bordro kodu kısmi devamsızlığı gizleyemez (`—` + review). |
| `convex/lib/pdksTableQuery.ts:123,217`, `pdksPayrollQuery.ts:89,143`, `cardReadings.ts:579,640` | Aynı bounded plan loader/allocator; komşu gün ve hafta bağlamı, yeni detay DTO'su. |
| `convex/lib/reportAttendance.ts:68,90,282,364`, `reportScope.ts:94` | Sadece legacy atama/esnek keşfine dayanan feature gate kaldırılır; tüm yeni planlar ortak motor yoluna girer. |
| `convex/dashboard.ts:244,267,312,641`, `pdksRecords.ts:63,149`, `lib/processCardReadingCore.ts:467`, `lib/pdksManualWrite.ts:16` | Tek vardiya varsayımı olan diğer çağıranlar; bildirim geçlik kararı occurrence bazlı, ham okutma kayıt biçimi değişmez. |

## 5. Arayüz ve API sözleşmesi

| Yüzey | Davranış |
|---|---|
| `AssignShiftDialog.tsx:48,77,351` | Hedef: Kişiler / Departman; departman seçiminde “Alt departmanlar miras alır; kişi ataması önceliklidir”. Başlangıç/bitiş, weekly/dayCycle/weekCycle, anchor; günlük hücrede çoklu vardiya seçimi ve açık Dinlenme/Miras seçeneği. |
| Önizleme | Yeni `shiftSchedules.preview/apply/update/remove/previewClear/clear` API'leri; scope+desen özeti, en az bir tam döngü, önceki/sonraki gece, override/gölgelenme/izin/tatil/eksik pencere. Apply yeniden doğrular; preview sonucu yetki veya çakışma kilidi değildir. |
| Takvim | `calendar/useShiftCalendarData.ts:26` artık `resolvedCalendar` sorgular; `shiftCalendarModel.ts:15` istemcide başka resolver yazmaz. Hücrede ilk 2 renkli vardiya + “+N”, off çizgili hücre, miras kaynak etiketi; detay tüm vardiyaları saat sıralı gösterir. Vardiya filtresi çözümlemeden **sonra** uygulanır. |
| Ağaç/sheet | `ShiftTree.tsx:20`, `ShiftPlanSheet.tsx:22`: tanım listesi korunur; kişi/departman plan kapsamı görünür, miras düzenlemesi kaynağa götürür; kişiye özel istisna ayrı eylemdir. |
| PDKS | `dashboard/PDKSTableView.tsx`, `PDKSEmployeeDetailDrawer.tsx`: hücrede toplam net + vardiya sayısı + durum; gün detayında vardiya planı/gerçekleşen/net/mola/geç/eksik/mesai, altında atanmamış okutmalar. İlk-son saatler “toplam çalışma” olarak sunulmaz. |
| DTO | Eski tekli cevap aynen; yeni plan gününe opsiyonel `planKind`, `shiftResults`, `reviewReasons`, `missingShiftCount`, `pendingShiftCount` eklenir. Sabit+esnek toplamında top-level `scheduleType: flexible` yazılmaz; alt sonuçlar türünü taşır. React tipleri `FunctionReturnType`, formlar kendi `z.infer` şeması; camelCase korunur. |

## 6. Mobil etkisi — grep kanıtı

İnceleme komutu: `rg -n 'shiftAssignments|shifts:|shiftId|shiftName|scheduleType|hasShiftSummary|employeeAttendance:|mobileAttendance:|employeeCheckIn:' mobile/lib --glob '*.dart'`.

| Kanıt | Sonuç / koruma |
|---|---|
| `mobile/lib/repositories/attendance_repository.dart:70,87,133` | `mobileAttendance:listPage`, `summary` ve listPage subscription kullanılıyor; doğrudan vardiya/atama çağrısı eşleşmedi. |
| `mobile/lib/providers/attendance_provider.dart:503` | `hasShiftSummary => false`; mobil vardiya planı UI'sı yok. |
| `mobile/lib/repositories/qr_repository.dart:30,39` | `employeeCheckIn:createMyCheckInToken/getMyCheckInTokenStatus`; ham erişim/token protokolü değişmez. |
| `convex/mobileAttendance.ts:124,135,151,156` | Dolaylı vardiya bağımlılığı var: bounded resolver/workday/table engine. Yeni planları sadece flexible/versioned gate arkasında bırakmak hatadır; gate yeni plan varlığını da kapsamalı. |
| `mobile/lib/models/attendance_summary.dart:51,70` | Nullable timestamp alanları mevcut olmalı ve `days[].date` ile aynı İstanbul takvim gününde kalmalı. Gece çıkışını iş günü D'nin `lastExit` alanına taşımak Flutter parse hatası yaratır. |

`listPage` ham hareket sırası/pagination/cursor sözleşmesi değişmez. `summary.days` ve giriş/çıkış sayıları ham **takvim günü** olarak kalır; `presentDays` yeni ortak hesapta tamamlanmış gün sayısını kullanır, vardiya sayısı olmaz. `summary` return validator'ına shiftResults eklenmez; vardiya detayını mobilde sunmak ileride ayrı endpoint/sürüm işidir. Eski tekli günde summary snapshot aynı; yeni planlı günlerde yalnız planın gerektirdiği devam kararı değişir. `mobile/**` dosyalarında bu faz için değişiklik gerekmez, mevcut Flutter parser fixtures ile backend JSON uyumu doğrulanır.

## 7. En çok üç uygulama paketi — ayrık ownership

Faz 1 merge/gate tamamlanmadan bu paketler kod yazmaz. Aşağıdaki dosya kümeleri **paketler arasında ayrık**; aynı sahip Faz 2+3 ve Faz 4 turunda tekrar çalışabilir.

| Paket | Ownership | Sıra / tahmin |
|---|---|---|
| P1 — plan modeli ve atama | `convex/schema.ts`, `convex/shifts.ts`, `convex/departments.ts`; yeni `convex/shiftSchedules.ts`, `convex/lib/shiftScheduleModel.ts`, `shiftPlanResolver.ts`, `shiftScheduleStore.ts`; `convex/lib/shiftAssign.ts`, `shiftUx.ts`; bunların testleri | İlk; 12–16 sa. Şema Faz 4'ü baştan taşır; önce tek vardiyalı rotasyon yazımı açılabilecek API, çoklu yazım ayrı activation. Mevcut `shiftResolver.ts` P2'nindir. |
| P2 — ortak hesap ve backend entegrasyon | `convex/lib/shiftResolver.ts`; `convex/lib/pdks*.ts`, `reportAttendance.ts`, `reportScope.ts`, `overtimeCalc.ts`, `processCardReadingCore.ts`; yeni allocation/gün reducer; `convex/cardReadings.ts`, `dashboard.ts`, `pdksRecords.ts`, `mobileAttendance.ts`; yeni `convex/pdksShiftCorrections.ts`; bunların testleri | P1 sözleşmesinden sonra; 24–32 sa. Önce Faz 2+3 tekli/off/departman entegrasyonu ve uyumluluk kapısı; sonra Faz 4 allocation+çoklu sonuç. Şema değişikliği istemez, P1 düzeltme tablosunu baştan ekler. |
| P3 — web ve tüketici doğrulaması | `src/components/shifts/**`, `src/components/pdks/**`, `src/hooks/usePdksTableData.ts`, `src/hooks/usePdksFilterOptions.ts`, `src/lib/shiftExport*`, `src/lib/pdks*`, `src/utils/pdksExport.ts`; gerekiyorsa ilgili sayfa girişleri ve `src` testleri; `mobile/**` salt okunur | P1 API kontratıyla başlayabilir, P2 çıktısıyla entegre; 12–16 sa. Önce departman/rotasyon, sonra çoklu UI. |

Toplam 48–64 mühendis-saat tahmini; inceleme/düzeltme payı hariç. Faz 2+3 canlıya çıkışında P1+P2+P3'ün o dilimi birlikte hazır olmalı; çoklu yazımlar Faz 4 motoru ve tüm rapor tüketicileri geçmeden açılmaz. `_generated` elle düzenlenmez; codegen/deploy bu salt okunur tasarım işinin dışındadır.

## 8. Test planı

| Katman | Kabul örnekleri |
|---|---|
| Geri uyumluluk | Faz 1 sonrası bütün mevcut testler değişmeden geçer; eski fixed/flexible, eachPunch/firstLast, gece, tatil/izin, manual, null/default ve eşit updatedAt fixture'larında eski/yeni DTO **deepEqual**. Yalnız süre değil anahtarların varlığı da karşılaştırılır. |
| Resolver | Kişi > çocuk > ebeveyn > default > proje; yeni üye otomatik alır; inherit üst kaynağa geçer/off geçmez; haftalık boş pattern her gün; aynı hedef son güncelleme; ağaç cycle/32 derinlik/başka proje reddi. |
| Rotasyon | 2S2A2off altın örneği, anchor öncesi, ay/yıl/leap-day, 1 gün/366 gün, 1/52 hafta; Pazartesi doğrulama; tarih kırpınca faz korunur. |
| Allocation | 08–12+13–17 dört okutma; yalnız 08/17 → inceleme; pencereler arası dış okuma; eşit uzaklık; yanlış yön/undirected; D gece + D+1 sabah; tam sınır dakika; maxSpan; iki instance'ın aynı okumayı/süreyi alamaması. |
| Kurallar | Bir vardiya geç+diğeri normal; biri absent+diğeri present → incomplete; tüm absent; pending son vardiya; farklı holidayWorkRequired; off gün okuma; Faz 1 absent/minWork/missingCheckIn her occurrence'da. |
| Mola/mesai | firstLast planlı/otomatik mola; eachPunch ikinci mola yok; sabit+esnek disjoint; haftalık eşik bir kez; splitAtMidnight hafta/ay sınırı; gece katsayısı, overtimeEnabled=false, toplam dakika korunumu. |
| API/veri | Proje sızıntısı yok; eski ve yeni endpoint shape; plan+refs atomik; silme referans koruması; eski→yeni dönüşüm iki kez çalışınca çift plan yok; yetim/manual düzeltme review; preview/apply arası değişiklik yeniden kontrol. |
| Performans | 100 kişi×31 gün×16 slot; ortak departman yalnız bir kez yüklenir; 257 hedef adayı/5.001 toplam/8 MiB aşımlarında açık hata; eski geniş tarihçe sonrası yeni tarih daraltma; sorgu sayısı gün sayısıyla çarpılmaz. |
| Tüketiciler | Tablo=detay=bordro=rapor ortak alt sonuçları; mobil gece JSON parser sözleşmesi; web takvim filtre sonrası doğru öncelik; miras+off klavye kullanımı; eski gün manuel formu aynı. |

Uygulama kapıları: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/tsc --noEmit -p convex`, `node_modules/.bin/eslint src convex`, `node_modules/.bin/vitest run`, `node scripts/find-node-leak.mjs`. Bu tasarım çalışmasında kod değişmediği için test/build çalıştırılmadı; yukarıdakiler uygulama kabul koşullarıdır.

## 9. Riskler ve netleştirilecek kararlar

1. Güncel departman ağacı geçmiş hesabını değiştirebilir; Faz 2 başlangıcında bu davranış açıkça kabul edilmeli veya effective-date üyelik işi kapsama eklenmelidir.
2. Birleşik okutmalar iki vardiyayı tamamlamaya yetmeyebilir; sanal sınır okutması yerine inceleme ve occurrence düzeltmesi sunulmalıdır.
3. Legacy+yeni iki atama kaynağı yönetim ekranlarında farklı kapsam yaratır; yeni web zorunlu sürüm, ortak çakışma servisi ve atomik dönüşüm kullanılmalıdır.
4. Büyük döngü/organizasyon/okutma hacmi Convex bütçesini aşabilir; count+byte sınırı, sayfalama ve tam hafta bağlamlı export zorunludur.
5. Anlık rapor/notification gibi ikincil tüketiciler ilk vardiyada kalabilir; grep ile tüm resolver çağıranları taşıma ve tablolar arası sonuç eşitliği activation kapısı yapılmalıdır.

Koordinatör kararına açık öneriler: **16 üst sınır**, yeni `work` slotunun hafta sonu beklentisini belirlemesi, çoklu sabitte pencere zorunluluğu, esnek zarf çakışmasını reddetme, kısmi devamsızlığı `incomplete` sayma ve geçmiş departman politikası. Tasarım bunlar için uygulanabilir varsayımları yukarıda seçer; kodlamadan önce sentezde sabitlenmelidir.

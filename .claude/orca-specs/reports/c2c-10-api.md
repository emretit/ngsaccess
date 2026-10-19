# C2c W-10-api teslimi

İzin create/update doğrulaması, ortak onaylı izin örtüşme kontrolü, cursor liste, bounded özet ve aktif kişi seçici tamamlandı. Kaynaklar: `convex/leaves.ts:20`, `convex/leaves.ts:105`, `convex/leaves.ts:206`, `convex/lib/leaveValidation.ts:7`; testler `convex/lib/leaveValidation.test.ts:100`. Frontend, schema, PDKS hesapları değişmedi; commit/push/deploy/migration/gerçek DB yazımı yapılmadı. `convex/_generated/api.d.ts` içinde yalnız `lib/leaveValidation` import ve modül satırı eklendi; diğer worker satırları korunuyor.

## Frontend için kesin API sözleşmesi

Gerçek tipleri `FunctionReturnType<typeof api.leaves.listPage>` vb. ile alın; aşağıdaki isimler dönen camelCase alanlarıdır. Yeni okumalar `authedQuery`, create/update `adminMutation` (super_admin/project_admin).

```ts
type LeaveType = "annual" | "sick" | "excuse" | "unpaid" | "parental"
  | "marriage" | "bereavement" | "paternity" | "lactation" | "compensatory";
type LeaveStatus = "pending" | "approved" | "rejected";
type Filters = {
  projectId: Id<"projects">;
  rangeStart: string; // gerçek YYYY-MM-DD
  rangeEnd: string;   // gerçek YYYY-MM-DD, rangeStart <= rangeEnd
  leaveType?: LeaveType;
  employeeId?: Id<"employees">;
  status?: LeaveStatus; // verilmezse üç durum birlikte
};
type PaginationOpts = {
  numItems: number; // 1..200 tam sayı; UI 25/50 kullanabilir
  cursor: string | null;
  endCursor?: string | null;
  id?: number;
  maximumRowsRead?: number; // sunucu her zaman 200 ile sınırlar
  maximumBytesRead?: number;
};
type LeaveRow = {
  _id: Id<"leaves">;
  employeeId: Id<"employees">;
  employeeName: string;
  departmentName?: string;
  employeeMissing: boolean;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  calendarDays: number | null;
  status: LeaveStatus;
  notes?: string; // yönetici dışında undefined (yanıtta alan yok)
  notesHidden: boolean; // super_admin/project_admin: false; diğer roller: true
  createdAt: string;
  updatedAt: string;
};

// convex/leaves.ts:105
leaves.listPage(args: Filters & { paginationOpts: PaginationOpts }): {
  page: LeaveRow[];
  isDone: boolean;
  continueCursor: string;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
  scannedCount: number;
  filterScope: "candidatePage";
};

// convex/leaves.ts:127
leaves.summary(args: Filters): {
  recordCount: number;
  employeeCount: number; // eşleşen kayıtlarda distinct employeeId
  truncated: boolean;
  scannedCount: number;
};

// convex/leaves.ts:206
leaves.update(args: {
  leaveId: Id<"leaves">;
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  notes?: string | null;
  expectedUpdatedAt: string; // listPage satırından aynen
}): { leaveId: Id<"leaves">; updatedAt: string };

// convex/leaves.ts:143
leaves.employeeOptions(args: { projectId: Id<"projects">; search?: string }): {
  options: { _id: Id<"employees">; employeeName: string; departmentName?: string }[];
  truncated: boolean;
};
```

`calendarDays` yeni/geçerli kayıtlarda kapsayıcı takvim günüdür; hafta sonu/tatil çıkarılmaz. Eski kayıt geçersiz veya ters tarih taşıyorsa listeyi çökertmemek için `null` döner; UI “—” gösterip düzeltme gereğini açıklamalı. Geçerli 366 günden uzun eski kayıtların gerçek gün sayısı korunur. Silinmiş veya başka projeye taşınmış kişinin adı/departmanı gösterilmez: `employeeMissing=true`, `employeeName="Personel bulunamadı"`; izin tarih/tür alanları korunur; `listPage` notları yalnız super_admin/project_admin için döndürür, diğer rollerde `notes` undefined ve `notesHidden=true` olur. Yönetici için `notesHidden=false`; eski `list`/`listForRange` notları aynen korur. Departman da seçili projede olmalı. Sayfadaki her benzersiz employeeId ve departmentId bir kez yüklenir.

## Cursor, filtre ve kapsam

- Kesişim: `startDate <= rangeEnd && endDate >= rangeStart`; tür, kişi ve durum eşitliği aynı predicate ile listPage/summary'de kullanılır. Dönem kaydın süresini kırpmaz; sorgu dönemi 366 günle sınırlanmaz.
- `by_project_start(projectId,startDate)` üzerinde `startDate <= rangeEnd`, descending. Eşit başlangıçlarda Convex index'in yerleşik `_creationTime`/doküman sırası ve cursor'u kararlı sırayı sağlar; frontend sayfa içinde ayrı ID sıralaması yapmamalı.
- **Koordinatör onaylı spec değişikliği:** eski create süre sınırı koymadığından `rangeStart−365` alt sınırı uygulanmıyor. `orca orchestration ask` yanıtı bounded-cursor stratejisini açıkça onayladı. Yeni kayıtta 366 gün sınırı var; legacy uzun kayıtlar listPage/summary/listForRange'de gizlenmiyor (`convex/lib/leaveValidation.test.ts:201`).
- Her çağrı en fazla 200 aday izin okur; `numItems` filtre öncesi aday hedefidir. Süzekten sonra 0..numItems sonuç olabilir; reaktif endCursor/split davranışında Convex sayfa boyutunu değiştirebilir. `scannedCount`, süzgeç öncesi bu çağrıda dönen aday sayısıdır.
- **`page=[]` ve `isDone=false` sonucun tamamının boş olduğunu söylemez.** “Bu sayfada eşleşen izin yok; sonraki kayıtları tarayın” ve Sonraki eylemini gösterin. Devam için `continueCursor` kullanın; `page.length===0` ile sayfalama bitirilmez. Filtre/proje/pageSize değişince cursor sıfırlanmalı. Normal boş sayfa + devam testi `convex/lib/leaveValidation.test.ts:227`.
- Yerleşik `splitCursor/pageStatus` aynen aktarılır; `usePaginatedQuery` bunları yönetebilir. Elle pagination yazılıyorsa SplitRequired durumunda split sözleşmesi izlenmeli; cursor'lar başka sorguya taşınmamalı.
- `resolveProjectScope` tüm yeni query'lerde çağrılır. Kapsam dışı proje mevcut sayfa kalıbındaki `Error("Bu projeye erişim yetkiniz yok")` ile reddedilir; boş sonuç/null değildir. Query error boundary bu durumu karşılamalı; bu ortak auth hatası `LEAVE_*` kodlu değildir.

## Yazma ve örtüşme kuralları

- `create`: imza aynı: `{ employeeId, projectId?, leaveType, startDate, endDate, notes?: string } -> Id<"leaves">`. Kişinin mevcut projesi gerekli ve kullanıcı kapsamında olmalı; projectId verilirse aynı olmalı. Proje kişiden, `status=approved` ve `approvedBy` oturumdaki yöneticiden gelir. Create'in mevcut aktiflik politikası değişmedi; seçici ise yalnız aktif personel sunar.
- Gerçek YYYY-MM-DD tarihi, 0001..9999 yılları, başlangıç ≤ bitiş ve **kapsayıcı en fazla 366 takvim günü** create'te ve update'te yalnız startDate veya endDate arg'ı mevcut değerden farklıysa uygulanır. Tarih değişmezse notes/leaveType düzenlemesi legacy uzun, geçersiz veya çakışan kayıtta da yapılabilir; aynı tarihleri tekrar göndermek de tarih değişimi sayılmaz. Sınır bir artık yılı kapsar ve tek kayıtta kazara çok yıllı izin açılmasını engeller; daha uzun yeni izin gerekirse ortak günü olmayan ardışık kayıtlar kullanılabilir.
- Aynı employeeId için yalnız **approved** kayıtlar, izin türü veya kayıt projesinden bağımsız, ortak en az bir gün varsa engeller. Sınır günleri dahil; 1–3 ile 3–5 çakışır, 1–3 ile 4–5 çakışmaz. **Legacy pending ve rejected engellemez.** Pending rezervasyon/talep iş akışı eklenmedi.
- Ortak `assertNoLeaveOverlap` create, tarihi değişen update ve legacy pending approve işleminde kullanılır (`convex/leaves.ts:31`). `by_employee_start` ile employeeId eşit + startDate≤yeni end, desc, en fazla 5001 aday; endDate≥yeni start bellek süzgeci. Update ve approve kendi leaveId'sini dışlar. Çakışma bulunursa LEAVE_OVERLAP; 5000 üzeri adayda çakışmasızlık kanıtlanamıyorsa LEAVE_SCAN_LIMIT ile yazma yapılmaz. Okuma ve yazma aynı Convex mutation transaction'ında; prod OCC/transaction motoru yerel bellek testinin kapsamında değil.
- Aynı kişi+tür+aralık tekrar gönderimi LEAVE_OVERLAP döner, ikinci insert yapılmaz; başarılı ilk ID'yi döndüren bir idempotency-key protokolü değildir. Handler testi `convex/lib/leaveValidation.test.ts:125`.
- Update yalnız approved üzerinde; kişi/proje arg'ı yok ve sabit. Kayıt projesi kullanıcı kapsamında, bağlı kişi de hâlâ aynı projede olmalı. `expectedUpdatedAt` tam eşleşmezse LEAVE_STALE. Başarıda `updatedAt` eski değerden en az 1 ms ilerler; aynı milisaniyede iki ayrı kayıt işlemi de eski sürümü reddeder (`convex/lib/leaveValidation.test.ts:152`).
- **Notes:** alanı göndermemek/undefined mevcut değeri korur; `null` `toPatch` yoluyla alanı siler; `""` açık boş metin saklar; dolu string değiştirir. Diğer optional alanlar undefined ise korunur.
- Eski `approve({leaveId,notes?})` / `reject({leaveId,notes?})` imzaları korunuyor; RPC sonucu `null`. Yalnız pending kararı kabul eden mevcut iş kuralı aynen duruyor. Yeni UI bunları kullanmamalı; approve artık ortak örtüşme kontrolünü kendini hariç tutarak uygular; LEAVE_OVERLAP veya LEAVE_SCAN_LIMIT durumunda onay yazılmaz.
- Audit taraması: `writeAudit` ve auditLog insert çağrılarında izin create/approve/reject için mevcut entegrasyon yok. Talimat gereği update için de yeni audit yazımı eklenmedi; UI düzenleyen kişi/geçmiş uydurmamalı.

## Hata sözleşmesi

Yeni izin iş kuralı hataları mevcut `cardReadings.assignCardFromReading` kalıbıyla `ConvexError({ code, message, ... })` döner. `LEAVE_ERRORS` saf ortak modülden import edilebilir; frontend `error.data` için unknown+narrowing kullanmalı. Rol/auth/proje-kapsam hataları mevcut ortak wrapper mesajlarıdır.

| Kod | Türkçe mesaj |
|---|---|
| LEAVE_INVALID_DATE | Geçerli bir tarih girin. |
| LEAVE_RANGE_REVERSED | Bitiş tarihi başlangıçtan önce olamaz. |
| LEAVE_TOO_LONG | Tek bir izin kaydı en fazla 366 takvim günü olabilir. |
| LEAVE_OVERLAP | Bu kişi için seçilen tarihlerle çakışan izin var. |
| LEAVE_READ_ONLY | Yalnız onaylı izin kayıtları düzenlenebilir. |
| LEAVE_STALE | Bu izin kaydı değiştirildi. Güncel kaydı açıp tekrar deneyin. |
| LEAVE_NOT_FOUND | İzin kaydı bulunamadı. |
| LEAVE_EMPLOYEE_UNAVAILABLE | Bu çalışana erişim yetkiniz yok. |
| LEAVE_PROJECT_MISMATCH | İzin ve çalışan aynı projede olmalıdır. |
| LEAVE_SCAN_LIMIT | İzin kontrolü okuma sınırına ulaştı. Daha dar bir dönem seçin veya yöneticinizle iletişime geçin. |
| LEAVE_INVALID_PAGE_SIZE | Sayfa boyutu 1–200 arasında tam sayı olmalı. |

LEAVE_OVERLAP ek verisi: `conflictLeaveId: Id<"leaves">`, `conflictStartDate: string`, `conflictEndDate: string`, `conflictLeaveType: LeaveType`. Diğer LEAVE_* verisi yalnız code/message. Form bunları tarih alanları yanında gösterebilir; stale durumda açık formu koruyup güncel kaydı yükleme seçeneği sunmalı.

## Bounded özet, kişi seçici ve eski API

- `summary`: `by_project_end`, projectId eşit + endDate≥rangeStart, en fazla 5001 aday. İlk 5000 aday üzerinde aynı filtreler ve distinct employeeId. `truncated=false` ise kesin toplam; true ise sayılar alt sınırdır, “bu dönemde kesin N kayıt/kişi” gösterilmez. Sayı limiti eşleşme sayısına değil **aday tarama sayısına** uygulanır; gelecekte başlayan kayıtlar da bütçe tüketebilir.
- `employeeOptions`: `employees.list` aktif-only/hafif/bounded değildi; `listLightForImport` proje arg'ı/aktif filtresi/departman sağlamıyor. Yeni endpoint project index'inden 1001 aday okur, ilk 1000'de isActive!==false ve isVisitor!==true uygular (legacy undefined aktif sayılır). Ad-soyad/departmanda Türkçe küçük harf substring araması, ada göre Türkçe sıralama + ID eşitlik sırası, en fazla 50 seçenek. Departmanlar tekilleştirilir ve kapsam doğrulanır. 1000 aday veya 50 seçenek aşıldıysa truncated=true; UI eksiksiz liste/arama iddiasında bulunmamalı. **1000'den sonraki personel aramada da bulunmayabilir**; büyük projeler için sonraki fazda uygun arama/pagination index'i gerekir.
- `listForRange({startDate:string,endDate:string,projectId?:Id<"projects">}) -> Doc<"leaves">[]`: imza ve ham belge dönüş şekli aynı. `by_project_end` endDate≥startDate, approved + kesişim süzgeci. Her izinli proje **ayrı ayrı** en fazla 5001 aday; herhangi bir projede 5000 aşılırsa eksik takvim döndürmek yerine LEAVE_SCAN_LIMIT. Tarihler doğrulanır; uzun legacy kayıtlar dahil. Dizi sırası önceki by_project sırasından farklı olabilir; takvim şekli/alanları aynı.
- `list({projectId?,employeeId?,status?}) -> Doc<"leaves">[]` değişmedi; eski sınırsız collect davranışı yeni frontend'e taşınmamalı. `getBalances` değişmedi.
- Veritabanı satır sınırları açık; çok büyük eski notes alanları ayrıca Convex byte limitine takılabilir. Yeni byte boyutu/süre datası veya migration eklenmedi. Malformed legacy tarihlerin kesişim sıralaması hâlâ kayıtlı metin üzerinden; otomatik veri onarımı yapılmadı.

## Etiketler ve PDKS

Durumlar: approved → Onaylı, pending → Beklemede, rejected → Reddedildi. Türler: annual → Yıllık izin; sick → Hastalık izni; excuse → Mazeret izni; unpaid → Ücretsiz izin; parental → Doğum izni; marriage → Evlilik izni; bereavement → Vefat izni; paternity → Babalık izni; lactation → Süt izni; compensatory → Telafi izni. Hiçbir etiketten ücret/saat/hak ediş hesabı çıkarılmaz. Süre: “N takvim günü”.

PDKS kaynak incelemesi: `convex/cardReadings.ts:478` onaylı izinleri dönem sorgusunda, `:713` diğer PDKS hesaplarında ve `:1533` kişi detayında okuyor. `src/hooks/usePdksTableData.ts:95` ve `src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:94` useQuery abonelikleri olduğundan create/update bu sorguların leaves bağımlılığını reaktif geçersiz kılar; kod düzeyinde değişiklik görünür. Dışa aktarma paneli `src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx:98` aylık puantajı tıklamada tekrar sorgular, normal Excel/CSV/PDF güncel records prop'undan üretilir; önceden indirilmiş dosyalar güncellenmez. Gerçek oturumda kaydetme → gün/dönem/detay/yeni export tutarlılığı bu DB yazmasız görevde çalıştırılmadı; koordinatör entegrasyon kabulünde bakmalı. PDKS öncelik/hesap mantığı değiştirilmedi.

## Doğrulama ve kalan entegrasyon

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: exit 0.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: exit 0.
- `node_modules/.bin/eslint src convex`: exit 0, çıktı yok (0 hata/uyarı).
- `npx --no-install vitest run`: **97 dosya / 991 test geçti**; ortak ağaçtaki diğer worker testleri dahil bu koşu anının sonucu.
- Hedefli `leaveValidation.test.ts` + `leaveRules.test.ts`: **40 test geçti**. Gerçek admin/authed wrapper'ları kullanılır; auth ve DB transport'u bellekte taklit edilir. `convex-test` kurulu olmadığından ve paket kurmak yasak olduğundan mevcut liveReadings test kalıbı izlendi. Gerçek Convex cursor motoru/transaction yarışı ve canlı PDKS güncellemesi ayrıca entegrasyon doğrulaması ister.
- Frontend worker: boş aday sayfası+devam, truncated sayaç/seçici, null calendarDays, stale taslak, notes:null ve eski salt okunur durumları sözleşmeye göre işleyecek. Koordinatörün gerçek oturumda 1440/390 görünümü ve izin+devam / izin+tatil PDKS sonucunu kontrol etmesi kalıyor.

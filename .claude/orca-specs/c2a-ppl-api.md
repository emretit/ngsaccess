# C2a W-ppl-api — 02 Kişiler backend (B2): kişi bazlı cihaz senkron durumu + son geçişler
Önce `.claude/orca-specs/c2-common.md` ve `convex/_generated/ai/guidelines.md` oku. Bağlam: `docs/ui-scan/pages/02-kisiler/REPORT.md`
"Backend gereksinimi" madde 1-2 ve "Kişi ayrıntısı". Bu worker'ın çıktısını 02 frontend worker'ı (paralel çalışıyor) kişi ayrıntısındaki
"Cihaz senkron durumu" ve "Son geçişler" bölümlerinde tüketecek; sözleşmeyi raporda kesin yaz.

## Hedef (test edilebilir)
Yeni `convex/peopleActivity.ts` modülünde iki authedQuery: (1) `employeeSyncStatus({ employeeId })` kişinin hedef cihazları bazında
dürüst senkron durumu; (2) `employeeRecentReadings({ employeeId, limit? })` son N (varsayılan 10, en çok 50) erişim okuması, yeni→eski,
cihaz adı çözülmüş. İkisi de çalışanın projesine yetkiyi doğrular, sınırlı (bounded) okur; vitest ile saf mantık kanıtlanır.

## İş
1. **Yetki:** çalışanı `db.get` → yoksa `null` döndür (frontend "kayıt bulunamadı" gösterir); projesi `resolveProjectScope`
   (`convex/lib/projectScope.ts`) ile kullanıcının kapsamında değilse `ConvexError` ("Bu personele erişim yetkiniz yok").
2. **employeeSyncStatus:** hedef cihazlar = kişinin erişim kuralı üyelikleri → grup cihazları (aynı mantık: `convex/lib/peopleHikSnapshot.ts`,
   `employees.getEmployeeWithDevices` — tekrar yazma, mümkünse ortak yardımcıyı kullan/çıkar). Her hedef cihaz için durum:
   `queued | processing | failed | verified | unknown` + `lastChangedAt` (ms) + `errorMessage?` + cihaz `{ id, name, brand }`.
   Kaynak: `hikPendingOperations` / `idePendingOperations` (payload içindeki employeeId; şemada employeeId index'i yok). Proje+durum
   index'leriyle (`by_project_status_created` vb.) **sınırlı** tara (`take`), payload'dan kişiye süz; tarama sınırı dolduysa ve
   kişi bulunamadıysa sonuç `unknown` (asla "senkron" çıkarımı). `verified` yalnız IDE `acked` + `ackedAt` gibi gerçek cihaz onayı
   ile; Hikvision `done` teslim kanıtı DEĞİL (`convex/syncStatus.ts:19` yorumu) → Hik başarılı en fazla "gönderildi/teslim kanıtı yok"
   = `unknown` (veya ayrı `sent` durumu; seçimini raporla). Dönüş ayrıca `summary: { total, failed, pending, verified, unknown }`.
   Index gerekirse (ör. op tablolarına `employeeId` alanı + index) DUR, `ask` — şema widen-migrate-narrow gerektirir.
3. **employeeRecentReadings:** `cardReadings` kişi index'i (`by_employee_status_time` iki durum için ayrı aralık + birleştir, ya da
   uygun başka index) ile `order("desc").take(limit)`; dönen alanlar: `_id, accessTime, accessStatus, direction, deviceId,
   deviceName, hikDenialReason`. Cihaz adlarını tekil `db.get` ile çöz (N+1'i limit sınırlar). Projesi farklı okumaları süz.
   Biyometrik ayrım burada YOK (bu PDKS değil, erişim geçmişi). `cardReadings.ts`'e DOKUNMA (08 worker'ının dosyası).
4. Saf mantığı `convex/lib/peopleActivity.ts`'e çıkar (op satırlarından cihaz bazlı durum kararı, iki listenin birleştirilmesi) +
   `convex/lib/peopleActivity.test.ts`: Hik done → verified OLMAZ; IDE acked+ackedAt → verified; failed son durum; tarama sınırı → unknown;
   sıralama ve limit.
5. `convex/_generated/api.d.ts`'e yeni modül satırlarını ekle (yalnız peopleActivity / lib/peopleActivity).

## Ownership
yeni convex/peopleActivity.ts · yeni convex/lib/peopleActivity.ts (+test) · convex/_generated/api.d.ts (yalnız kendi satırların) ·
convex/lib/peopleHikSnapshot.ts (yalnız ortak hedef-cihaz yardımcısını dışa açmak gerekirse; davranış değişmez)

## Kapsam dışı
Frontend · cardReadings.ts · employees.ts liste ölçeklemesi/cursor · personel import · syncStatus.ts proje özeti · schema.ts.

## Rapor (worker_done)
≤10 satır + `.claude/orca-specs/reports/c2a-ppl-api.md`: iki query'nin tam arg/dönüş tipi, durum enum'unun anlamı ve Türkçe etiket önerisi,
tarama sınırları.

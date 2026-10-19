# Denetim — Raporlar D1 (review-rep1)

**Özet:** Kritik veri sızıntısı yok; Ham Okutmalar backend'i doğru proje kapsamında ve biyometrik okumaları süzüyor. Ama 1 YÜKSEK hata var: kişi/departman filtresi değişince yüklenmiş sayfalar siliniyor. Bunun dışında 4 ORTA (aylık sorgunun gereksiz yeniden abonesi, PDF'te devam sayfalarında kişi adının olmaması, büyük PDF'te bellek, maaş verisinin project_user'a açılması) ve 3 DÜŞÜK bulgu var.

## Kapılar (kendi koşumum, 2026-10-19)
| Kapı | Sonuç |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | exit 0, 0 hata |
| `tsc --noEmit -p convex/tsconfig.json` | exit 0, 0 hata |
| `eslint src/lib/reports src/components/reports src/pages/Reports.tsx src/components/layout convex/cardReadings.ts convex/lib/reportAttendance.ts` | exit 0, çıktı yok |
| `vitest run src/lib/reports src/components/reports src/components/layout convex/lib/reportAttendance.test.ts` | 9 dosya, 71 test geçti |

## Bulgular (önem sırasıyla)

1. **[YÜKSEK] src/components/reports/ReportScreen.tsx:53 (+ :66 `key={queryKey}`)** — Ham Okutmalar'da kişi/departman filtresi istemcide (yüklenmiş sayfalar üzerinde) uygulanıyor. Ama `person` ve `dept` aynı zamanda `queryKey`'in içinde ve `ReportResults` bu key ile remount ediliyor. Remount olunca `useReducer` snapshot'ı ve cursor sıfırlanıyor.
   Senaryo: 6 kez "Daha fazla yükle" → 300 kayıt yüklü → arama kutusuna "Ayşe" yazılıyor → bileşen remount → yalnız ilk 50 kayıt kalıyor, Ayşe'nin 2.-6. sayfadaki geçişleri görünmüyor. Ekrandaki "Kişi ve departman filtreleri yüklenen kayıtlara uygulanır" notu yanlış oluyor, dışa aktarma da eksik çıkıyor. Kullanıcı kaydın olmadığını sanabiliyor.
   Düzeltme: `transactions` için key'den `person` ve `dept`'i çıkar (key = proje + slug + from/to + result + revision). Kişi/departman filtresi yalnız `rows` hesabında kalsın.

2. **[ORTA] src/components/reports/ReportScreen.tsx:53 → ReportResults.tsx:25-26 (kota, OLASI)** — Aylık Durum'da kişi/departman filtresi de yalnız istemcide çalışıyor, ama yine `queryKey` içinde. Debounce'lu her arama değişikliğinde `MonthlyResults` remount oluyor, `getMonthlyPayrollSheet` aboneliği kapanıp aynı argümanla yeniden açılıyor. Bu sorgu ayın tüm proje okumalarını `.collect()` ile okuyor (cardReadings.ts:627 ve sonrası).
   Senaryo: "Mehmet" yazarken debounce adımlarında 2-3 yeniden abonelik oluşuyor; her birinde tüm ay okumaları yeniden okunabilir. Convex Free kotası daha önce aşılmıştı. Remount kesin; sunucunun gerçekten yeniden çalışıp çalışmadığı Convex istemci önbelleğine bağlı, bu yüzden OLASI.
   Düzeltme: Bulgu 1'deki gibi key'i yalnız sunucu argümanlarından kur. Günlük raporda `person` zaten sunucu argümanı olduğu için o rapor etkilenmiyor.

3. **[ORTA] src/lib/reports/export.ts:30-32** — PDF'te geniş tablo yatay parçalara bölünüyor ve her parçada "tanımlayıcı" olarak görünür ilk kolon tekrarlanıyor. Günlük raporlarda ilk kolon `Tarih`, Ham Okutmalar'da `Zaman`; `Ad Soyad` ilk parçada kalıyor.
   Senaryo: Günlük Puantaj (16 kolon) PDF'i 3 parçaya bölünüyor. 2. ve 3. parça sayfalarındaki satırlar yalnız "19.10.2026 + Plan çıkış/İlk giriş…" içeriyor. Aynı gündeki 300 kişinin satırları birbirinden ayırt edilemiyor.
   Düzeltme: Tekrarlanan kolonlar `date` ve `name` olsun (aylıkta `name`). Ya da `ReportDefinition`'a `pinnedColumns` alanı ekle.

4. **[ORTA] src/lib/reports/export.ts:27-96** — PDF her sayfayı 1684×1190 canvas → PNG dataURL olarak, tek eşzamanlı döngüde üretiyor. Satır sınırı ya da kullanıcıya uyarı yok.
   Senaryo: Günlük Puantaj, 31 gün × 300 kişi ≈ 9.300 satır, sayfada ~16 satır, 3 kolon parçası → ~1.700 PNG sayfası. Sekme dakikalarca donar, yüzlerce MB bellek kullanır, büyük ihtimalle çöker; "Hazırlanıyor…" göstergesi de çizilemez.
   Düzeltme: PDF'e satır üst sınırı koy (ör. 2.000 satır), üstünde "Excel kullanın" mesajı göster. Ya da jsPDF metin + autotable ve gömülü TTF font kullan.

5. **[ORTA] src/components/reports/ReportResults.tsx:25 (yetki/veri minimizasyonu)** — Aylık Durum, `getMonthlyPayrollSheet` sonucunu her role çekiyor. Sorgu yalnız `authedQuery` + proje kapsamıyla korunuyor, rol kontrolü yok. Dönen veride `rows[].hourlyRate`, `cells[].overtimePayTRY` ve `totals.overtimePayTRY` (ücret bilgisi) var (cardReadings.ts:763 `hourlyRate: emp.hourlyRate`).
   D1 öncesi bu sorguyu yalnız Ayarlar → Raporlar kullanıyordu ve o sekme yalnız adminlere açık (`capabilities.settingsTabs`). Artık `project_user` her Aylık Durum açılışında projedeki herkesin saatlik ücretini ağ yanıtında alıyor; tabloda gösterilmese de devtools'ta görünüyor.
   Senaryo: project_user rolü `/reports/aylik/aylik-durum` sayfasını açar → Network sekmesinde tüm çalışanların `hourlyRate` değeri görünür.
   Düzeltme: Sunucuda admin olmayan rollerde ücret alanlarını null'a çevir. Ya da ücret alanı içermeyen ayrı bir `getMonthlyStatusSheet` yaz. (Not: `getPdksTableData` da `hourlyRate`/`overtimePayTRY` döndürüyor ve PDKS Kayıtları üzerinden zaten açık; bu eski bir sorun, ama D1 ikinci bir yol ekliyor.)

6. **[DÜŞÜK] src/components/layout/AppSidebarNav.tsx:23** — `/reports/<grup>` altındayken üst "Raporlar" butonu `isActive=false` oluyor; aktiflik alt menüye geçiyor. İkon modunda (`collapsible=icon`) `SidebarMenuSub` gizli olduğundan rapor sayfalarında hiçbir menü öğesi vurgulanmıyor.
   Senaryo: Sidebar daraltılmış, `/reports/gunluk/gec-kalanlar` açık → hiçbir ikon aktif görünmüyor.
   Düzeltme: Üst butonda `isActive={active}` kullan. Alt menü vurgusu ayrıca kalsın; `aria-current` mevcut haliyle doğru.

7. **[DÜŞÜK] src/components/reports/ReportResults.tsx:45** — "N kayıt gizlendi" sayısı sunucuda, kişi/departman filtresinden önce hesaplanıyor (yalnız proje + sonuç filtresi uygulanmış oluyor).
   Senaryo: "Ayşe" filtresi açık → ekranda "12 kayıt gizlendi" yazıyor, ama bu 12 kaydın hepsi başka kişilerin biyometrik geçişleri olabilir. Kullanıcıya Ayşe'nin gizlenmiş kaydı varmış gibi görünüyor.
   Düzeltme: Metni "Yüklenen sayfalarda N biyometrik kayıt gizlendi (filtreden bağımsız)" yap.

8. **[DÜŞÜK] Kişi aramasında Türkçe büyük/küçük harf tutarsızlığı** — Günlük raporlar arama için sunucudaki `getPdksTableData` filtresini kullanıyor (cardReadings.ts:413-416, `toLowerCase()`). Aylık ve Ham Okutmalar ise istemcide `toLocaleLowerCase('tr-TR')` kullanıyor.
   Senaryo: Adı "IŞIK" olan biri "ışık" diye aranıyor → Aylık Durum'da bulunuyor, Günlük Puantaj'da "Kayıt bulunamadı" çıkıyor (`"IŞIK".toLowerCase()` sonucu `"işik"` oluyor).
   Düzeltme: Bu eski bir sunucu davranışı. Sunucuda `toLocaleLowerCase("tr-TR")` kullan ya da iki tarafta aynı normalize fonksiyonunu kullan.

## Temiz çıkanlar (doğrulandı)
- **Yetki:** `listReportTransactions` önce `resolveProjectScope` çalıştırıyor. Tüm indeksler `projectId` önekli; satır düzeyinde `row.projectId === args.projectId` kontrolü var. `employeeId` proje uyumu kontrol ediliyor. `numItems` doğrulanıyor; çağrı başına en fazla 200 satır okunuyor. `.filter`/`.collect` yok.
- **Resmi grup:** Rol kontrolü `capabilities().settingsTabs.includes('reports')` ile yapılıyor; project_user'a kart yerine "Bu raporlar yöneticiler içindir." gösteriliyor.
- **KVKK:** `splitPdksEligible` → `isPdksEligibleReading`, enrich işleminden önce uygulanıyor; biyometrik satır çıktıya ya da dışa aktarıma girmiyor. Günlük ve aylık sorgular `filterPdksReadings` kullanıyor. Metinlerde "uygundur" türü bir hukuki iddia yok.
- **Tarih/saat:** Presetler `todayInTurkey()` değerine sabitleniyor, yerel takvim hesabı tutarlı; hafta Pazartesi başlıyor (test bunu doğruluyor). `formatTransactionTime` `Europe/Istanbul` kullanıyor. 31 günü aşan aralıkta `ReportResults` hiç render edilmiyor, yani sorgu gerçekten durduruluyor.
- **Cursor reducer:** Aynı anda tek abonelik açık; snapshot `_id` ile tekilleştiriliyor; yükleme sırasında buton disabled; boş sayfada `isDone=false` olunca devam edilebiliyor.
- **CSV:** BOM, `;` ayracı, tırnak kaçışı ve `=+-@` formül koruması var; yalnız görünür kolonlar dışa aktarılıyor.
- **Tip/a11y:** `any`, `!` ve `filter(Boolean)` yok; `th scope="col"`, `nav aria-label` ve `aria-current` mevcut; `useToast` yerine `notify` kullanılıyor.

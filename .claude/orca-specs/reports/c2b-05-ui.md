# C2b-05-ui teslim raporu

17.10.2026 — yalnız 05 frontend Ownership dosyaları değiştirildi; commit/push/deploy/migration/DB yazımı veya npx convex çalıştırılmadı.

## Uygulama

- `src/pages/AccessControl.tsx:1`, `unified/AccessRulesList.tsx:352`: tek h1 PageHeader, proje adı, admin Yeni kural ve ikincil Cihazlara gönder; StatInline yalnız “Bu sayfada N kural”; FilterBar, 42px masaüstü tablo, mobil 64px satır ve tek satır menüsü. Eski RuleCard ve backfillAllRulesToDevices sayfa çağrısı kaldırıldı.
- `unified/AccessRulesList.tsx:217`: listSummaries ve cursor önceki/sonraki gezinme korunur. q/by/durum/tur URL parametreleri, filtre temizleme; personel/ziyaretçi türü, kısa panel/tüm kapılar veya seçili/toplam kapı kapsamı. Aktif yalnız kural ayarıdır; cihazda uygulandı iddiası yoktur.
- Tür filtresi API'de bulunmadığı için **mevcut cursor sayfası içinde** uygulanır; UI bunu açıklar ve boş ara sayfada Sonraki kullanılabilir. Global tür filtresi ya da global toplam uydurulmadı.
- `unified/AccessRuleDetails.tsx:1`: kişiler, paneller, açık kapı seçimleri ayrı usePaginatedQuery/listRuleMembers cursor'larıyla 25'er yüklenir; Daha fazla yükle düğmeleri vardır. Ayrıntı getDetails'in sınırsız üyelik listelerini indirmez. Backend raporuna göre membersTruncated alanı mevcut değildir; sahte kırpma bilgisi üretilmedi.
- `unified/CreateRuleDialog.tsx:27`: Temel → Kimler → Nerede/Ne zaman, düzenlemede serbest adım erişimi, ad/kişi geçiş kontrolü, final Zod doğrulaması, alan altı mesajlar ve odağa geçiş, tek gövde scroll'u/sabit footer, pending/çift submit kilidi. useUnsavedChangesGuard Escape/çarpı/dış tıklama/Vazgeç/proje değişimine bağlıdır.
- `unified/hooks/useRuleForm.ts:30`: form başlangıç snapshot'ına göre dirty; proje kimliği form açılışında sabitlenir. Proje değişip kullanıcı taslağı korursa seçim/kayıt kilitlenir ve eski projeyi yeniden seçme açıklaması gösterilir; yeni projeye yanlışlıkla kaydetmez. Düzenleme yalnız tam getDetails verisiyle açılır; priority 0, hedef türü, yön ve ziyaretçi üyelik koruması sürer. Saat temizleme null davranışı korunur.
- `unified/components/TimeSchedule.tsx:1`: Tüm gün/Saat aralığı radio, görünür başlangıç/bitiş label'ları, Türkiye saati, gün ve saat hataları; gece aşımı açıklaması. DepartmentTree/ZoneDeviceTree araması ve selectionHelpers tri-state algoritması değişmedi; toplu seçimin **projedeki tüm adaylar** kapsamı açıklandı, bağımsız ağaç scroll'ları kaldırıldı.
- `unified/SyncRuns.tsx:55`: reaktif get({runId}) sonuç Sheet'i, her hedef için marka/ad/durum/sebep, sıfır hedef açıklaması; Hik “Gönderildi · teslim kanıtı yok”, IDE “Cihazda doğrulandı”, başarısız/atlandı/bilinmiyor ayrı.
- `unified/SyncRuns.tsx:88`: Son gönderimler; backend sahibinin koordinatör onayıyla eklediği opsiyonel listRecent({projectId, ruleId?, limit?}) argümanı bağlandı. Kural ayrıntısı ruleId + limit:1 ile kesin son run'ı okur; proje listesi limit:10.
- `unified/SyncRuns.tsx:144`: onayda cihaz sayısı/marka dağılımı, tüm proje cihaz kapsamı, filtrelerin kapsamı daraltmadığı ve kanıt ayrımı; onaydan sonra yalnız startProjectResync.
- `src/hooks/access-rules/useComplexAccessRuleMutations.ts:65`: kayıt sonrası yalnız startRuleSync; legacy syncWeekPlan/syncIdeRule çağrıları kaldırıldı. Kayıt başarı bildirimi ile arka plan başlatma/hata bildirimi ayrıdır. Dışa açık mutateAsync/isPending imzaları korunur; GroupMembers/GroupDevicesManager tüketicileri kırılmadı.
- `src/components/sync/DeviceSyncStatusBanner.tsx:7`: geriye uyumlu props'suz API, sade A2 proje durum şeridi; geçmiş onayın yeni gönderim sonucu olmadığı açık.
- `UnifiedRuleTable.tsx` silindi: silmeden önce `rg 'UnifiedRuleTable' src` yalnız dosyanın kendi tanımı/export'unu buldu; silme sonrası tarama sıfır eşleşme.
- `unified/lib/presentation.ts` + test: hedef etiketi/tone, kanıtlı özet ve tür filtresi saf mantığı; mevcut şema/seçim testleri de korunur.

## Kapılar

- Kendi Ownership kapsamı ESLint: **0 hata/uyarı**.
- Tam `node_modules/.bin/eslint src convex`: **0** (son çalışma).
- Convex tsc: **0**; Convex dosyası değiştirilmedi.
- App tsc ilk çalışma **0**; paralel worker değişimleri sonrası çalışmalarda yalnız `src/components/visitors/visitors.test.tsx:19` sensitiveMasked fixture eksikliği görüldü, 05 dosyalarında hata yok. Son kontrol: yalnız aynı visitors.test.tsx:19 hatası; 05 hata sayısı 0.
- `npx vitest run`: son tam çalışma **93 dosya / 934 test geçti**. Önceki ara 07/09 test hataları diğer worker'ların düzeltmesiyle kapandı.
- `npx vitest run src/components/access-control/unified`: **3 dosya / 16 test geçti** (şema 7, seçim 7, sunum 2).
- `npx vite build`: **0**, mevcut >500kB chunk uyarısı var.
- Ownership kapsamı `git diff --check`: **0**.

## Koordinatörün oturumlu ekranda kontrol edecekleri

1440/390px listede tablo hücreleri ve uzun kural adları; mobil tür/kim/zaman kolonlarının gizlenmesi, kapsamın ad altında görünmesi; menü/Sheet klavye odağı; üç adımın ileri/geri/düzenleme dolaşımı; dirty kapatma ve proje değişiminde taslak koruma; ziyaretçi şablonu ve priority 0 düzenlemesi; tüm panel fallback'i → açık kapı seçimi tri-state; kayıt hatasında taslak; Hik sent ve IDE verified sonuçları, atlanan/başarısız nedenleri, sıfır hedef ve son gönderimler.

Kodda min-w-0, table-fixed, breakpoint kolonları, sarılan filtre/footer/günler, dar ekranda tek sütun saatler ve yalnız tablo kabında yatay scroll kullanıldı. 390px'te tablo kalan ad alanını kullanır; seçim ağaçları tek form scroll'u içindedir. Bu teslimde oturumlu tarayıcı/donanım testi yapılmadı; gerçek ekran görüntüsü veya fiziksel teslim doğrulaması iddiası yoktur.

## Açık sınırlar

Tür filtresi sayfa içidir (UI'de açıklanır); bütün proje tür filtresi için ayrı backend argümanı gerekir. getDetails'in tam üyelik okuma maliyeti backend koordinatör kararıyla C3'e bırakılmıştır; yalnız düzenleme açılışında kullanılır. Arka plan gönderim başlatılamazsa kayıt geri alınmaz; hata bildirimi verir ve admin Cihazlara gönder üzerinden yeni run başlatabilir. Backend raporundaki 200 cihaz/100 kural/500 üye ve 10 dakika kanıt sınırları geçerlidir.

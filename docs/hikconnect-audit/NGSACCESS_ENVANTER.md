# NGSAccess sayfa ve özellik envanteri

Kod incelemesi: `src/App.tsx` route tanımları (29 route), `src/lib/routeMeta.ts` menü etiketleri/visibility ve sayfa ile ilgili bileşen/hook kaynakları. Route başlıklarındaki `file:line` App.tsx satırlarıdır; ana bileşen dosyası da belirtilmiştir. “Yok” yalnız incelenen bileşende görünür bir işlem bulunmadığını belirtir.

### `/` — Tanıtım sayfası
- Route/ana bileşen: `src/App.tsx:56` → `src/pages/LandingPage.tsx`; menü: yok (public). Convex: yok; public tema hook'u.
- İçerik: ürün özellikleri, nasıl çalışır, güvenlik, fiyat, SSS ve CTA; liste/filtre/form CRUD/dışa-içe aktarma yok.
- Rol kapısı: yok.

### `/login` — Giriş
- Route/ana bileşen: `src/App.tsx:57` → `src/pages/Login.tsx`; menü: yok. Convex: `users.hasSuperAdmin`, `emailVerification.requestVerification` (ayrıca kimlik doğrulama `AuthProvider` üzerinden).
- Form: e-posta, şifre; doğrulama e-postası yeniden isteme ve ilk yönetici durumuna göre akış. Liste/filtre/CRUD/dışa-içe aktarma yok. Rol kapısı: yok.

### `/register` — Kayıt
- Route/ana bileşen: `src/App.tsx:58` → `src/pages/Register.tsx`; menü: yok. Convex sayfa dosyasında doğrudan çağrı yok; kayıt `AuthProvider` akışında.
- Form: ad, soyad, firma adı, e-posta, şifre. Liste/filtre/CRUD/dışa-içe aktarma yok. Rol kapısı: yok.

### `/verify-email` — E-posta doğrulama
- Route/ana bileşen: `src/App.tsx:59` → `src/pages/VerifyEmail.tsx`; menü: yok. Convex: `emailVerification.verifyEmail`, `emailVerification.requestVerification`.
- E-posta alanı ve doğrulama/yeniden gönderme eylemi; liste ve CRUD/dışa-içe aktarma yok. Rol kapısı: yok.

### `/auth` — Giriş yönlendirmesi
- Route/ana bileşen: `src/App.tsx:60` → `Navigate` (`/login`); menü: yok. Convex/özellik/form/liste yok; rol kapısı yok.

### `/check-in` — Personel geçiş bildirimi
- Route/ana bileşen: `src/App.tsx:61` → `src/pages/CheckIn.tsx`; menü: yok. Convex: `employeeCheckIn.checkInWithToken`.
- URL tokenı ile tek kullanımlı check-in sonucu; liste/filtre/arama/form alanları (token URL’den) ve yönetim CRUD/dışa-içe aktarma yok. Rol kapısı: oturum rolü görünür değil.

### `/demo-request` — Kayıt yönlendirmesi
- Route/ana bileşen: `src/App.tsx:62` → `Navigate` (`/register`); menü: yok. Convex/özellik/form/liste yok; rol kapısı yok.

### `/user-setup` — Kullanıcı hesabı kurulumu
- Route/ana bileşen: `src/App.tsx:63` → `src/pages/UserSetup.tsx`; menü: yok. Convex: `invites.verify`, `invites.consume`, `invites.claimSetupAccount`.
- Davet tokenı doğrulama ve hesap/şifre kurulum akışı; form alanları davet durumuna göre, listeler ve dışa-içe aktarma yok. Rol kapısı: geçerli davet ve kimlik doğrulama durumu.

### `/admin-setup` — İlk yönetici kurulumu
- Route/ana bileşen: `src/App.tsx:64` → `src/pages/AdminSetup.tsx`; menü: yok. Convex: `users.hasSuperAdmin`, `users.initializeAdmin`.
- Form alanları: yönetici e-postası, şifre, kurulum kodu. Liste/filtre/CRUD/dışa-içe aktarma yok; ilk yönetici yokluğu/kurulum kodu koşulu.

### `/employee-setup` — Personel hesabı kurulumu
- Route/ana bileşen: `src/App.tsx:65` → `src/pages/EmployeeSetup.tsx`; menü: yok. Convex: `employeeAuth.getByToken`, `actions.setPassword.setEmployeePassword`.
- Token ile personel doğrulama ve parola belirleme; yönetim listesi/filtre/dışa-içe aktarma yok. Rol kapısı: token geçerliliği.

### `/home` — Ana Sayfa
- Route/ana bileşen: `src/App.tsx:67` → `src/pages/Index.tsx`; menü: **Ana Sayfa**. Convex: `dashboard.getStats`, `getActivitySummary`, `getTodayTimeline`, `getRecentReadings` (useDashboard); diğer dashboard bileşenleri üzerinden.
- Proje özeti, bugünkü geçişler, canlı akış, cihaz sağlığı ve hızlı bağlantılar; liste yönetimi, filtre, CRUD, içe/dışa aktarma yok. Rol kapısı: Layout’ta oturum ve doğrulanmış profil.

### `/system-admin` — Admin
- Route/ana bileşen: `src/App.tsx:68` → `src/pages/SystemAdmin.tsx`; menü: **Admin** (superAdminOnly). Convex: `users.adminList/list`, `invites.listExpired`, `projects.adminList/list/create/update/remove/getDeletionImpact`, `adminDevices.adminListPage/listForClaim/register/remove/backfillExisting`, `devices.claimDevice/reassignDevice`, `users.updateRole/deleteUser`, davet e-posta action’ı.
- Sekmeler: kullanıcılar, projeler, cihazlar; arama/sayfalama bileşenlere göre. Kullanıcı rolü güncelleme/silme/davet; proje ekle/düzenle/sil; cihaz kaydı/atama/silme. CSV/Excel/PDF içe/dışa aktarma görünmüyor. Formlar ilgili yönetim panellerinde; proje adı/ayarları, kullanıcı daveti ve cihaz kayıt/atama alanları. Rol kapısı: yalnız sistem yöneticisi.

### `/employees` — Kişiler
- Route/ana bileşen: `src/App.tsx:69` → `src/pages/Employees.tsx`; menü: **Kişiler**. Convex: `employees.list/remove/bulkDelete/bulkUpdateDepartment`, `departments.list/create/update/remove`, form seçenekleri için `companies.list`, `accessRules.list`, `positions.list`; senkronizasyon action’ı `actions.hikvisionSync.syncEmployeeToDevices`.
- Departman ağacı ve kişi tablosu/sayfalama; departman filtresi ve tablo filtreleri, kişi arama. Eylemler: ekle/düzenle/sil, seçili toplu silme/departman değiştirme, cihazlara senkronizasyon; dışa/içe aktarma görünmüyor. Tablo alanları kaynakta: kişi adı, iletişim/kurum/pozisyon ve işlem menüsü; form: ad, soyad, e-posta, kart numarası, T.C. no, bordro kodu, firma, departman, pozisyon, erişim kuralı, aktiflik, fotoğraf, ücret/bordro bilgileri, eski vardiya notu, notlar. Kapı: `useProjectAccess`/`AccessDenied` proje yetkisi; menü rol filtresi burada ayrıca belirtilmemiş.

### `/devices` — Cihazlar
- Route/ana bileşen: `src/App.tsx:70` → `src/pages/Devices.tsx`; menü: **Cihazlar**. Convex: `devices.list/create/update/remove/releaseDevice/claimDevice/createIdePanel/createHikDevice/getById/regenerateApiToken`, `zones.list/remove`, `doors.list/readerStatus/remove`, `readers.remove`; gateway action’ları kayıt, kapı açma ve reader yapılandırma.
- Hiyerarşik bölge/kapı/cihaz görünümü; liste kolonları proje (uygunsa), cihaz adı, marka/model, seri no/UUID, bölge, bağlantı ve işlemler. Filtreleme/arama DeviceContent ve filter hook’larında; ekle/düzenle/sil, seçme/toplu eylemler, cihaz talep/serbest bırakma, QR, konum atama, kapı/reader işlemleri. Form: ad/tip/seri, bölge/konum/kapı sayısı, IP/port/kullanıcı/parola ve marka özel alanları (IDE/Hikvision); dışa/içe aktarma görünmüyor. Kapı: proje erişimi (`useProjectAccess`).

### `/virtual-readers` — Sanal Okuyucular
- Route/ana bileşen: `src/App.tsx:71` → `src/pages/VirtualReaders.tsx`; menü: **Sanal Okuyucular** (Yakında rozeti). Convex çağrısı: sayfada görünür değil.
- Sayfa içeriği/aksiyonları sınırlı placeholder; listelenebilir okuyucu tablosu, filtre, arama, form, CRUD ve dışa/içe aktarma kodda saptanmadı. Rol kapısı: Layout oturumu.

### `/access-control` — Geçiş Kontrol
- Route/ana bileşen: `src/App.tsx:72` → `src/pages/AccessControl.tsx`; menü: **Geçiş Kontrol**. Convex: `accessRules.listSummaries/getDetails/listRuleMembers/create/update/remove/createWithGroups/updateWithGroups/updateWithGroupsTracked/projectDeviceCounts`, `deviceSyncRuns.get/listRecent/startProjectResync/startRuleSync`; ayrıca zones/doors/readers işlemleri.
- Erişim kuralı listesi kolonları: kural, tür, kim, kapsam/kapılar, zamanlama, durum, işlemler. Arama; tür/durum ve kapsam filtreleri; kural ekle/düzenle/sil, senkronizasyon/yeniden eşitleme. Form: kural adı/açıklama, kişi/departman kapsamı, kapı/bölge seçimi, grup ve zaman çizelgesi/gün-saat. Dışa/içe aktarma görünmüyor. Kapı: seçili proje bağlamı ve erişim yetkileri.

### `/visitors` — Ziyaretçiler
- Route/ana bileşen: `src/App.tsx:73` → `src/pages/Visitors.tsx`; menü: **Ziyaretçiler**. Convex: `visitors.listPage/summary/getDetail/create/update/checkOut/releaseCard/presetRules/kvkkNotice`, `employees.list`, `cardReadings.getLastUnknownByDevice`, erişim kuralı oluşturma.
- Ziyaret listesi ve özet/kart okuyucu durumu; filtre ve arama mevcut list bileşeninde. Ekle/düzenle/sil (silme akışında `employees.remove` çağrısı), check-out/kartı bırak; toplu işlem ve dışa/içe aktarma görünmüyor. Form: erişim bölgesi/kuralı, geçerlilik bitiş tarih-saat, kart no, aktiflik, ad, soyad, şirket, ziyaret edilen kişi, amaç, telefon, not, KVKK rızası. Kapı: aktif proje gerekir; yetki yoksa erişim engeli.

### `/live-monitoring` — Canlı İzleme
- Route/ana bileşen: `src/App.tsx:74` → `src/pages/LiveMonitoring.tsx`; menü: **Canlı İzleme**. Convex: `devices.list`, `doors.list`, `cardReadings.searchMonitoringPeople/lastMonitoringReading` (`CardReadings`).
- Son geçiş akışı; kişi, cihaz ve kapı filtreleri; olay sonucu/ayrıntıları. Kayıt CRUD, toplu işlem, dışa/içe aktarma görünmüyor. Rol kapısı: Layout oturumu ve proje kapsamı.

### `/pdks-records` — PDKS Kayıtları
- Route/ana bileşen: `src/App.tsx:75` → `src/pages/PDKSRecords.tsx`; menü: **PDKS Kayıtları**. Convex: `cardReadings.getPdksTableData/getEmployeeAttendanceDetail/getMonthlyPayrollSheet`, `departments.list`, `companies.list`, `positions.list`, `shifts.list`, `dashboard.getRepeatLateOffenders/getAnnualOvertimeBalance/getBreakViolations`, `auditLog.getPdksAuditForEmployee`, CSV import action’ları `actions.pdksImport.previewPdksCsv/importPdksCsv`, `sgkExport.buildAphbForMonth`, kayıt düzenleme `pdksRecords.upsertManual`.
- Tablo/çizelge/grafik/ısı haritası görünümleri; tarih gezinme, kişi arama, departman/şirket/pozisyon/vardiya/durum ve dönem filtreleri; satır seçimi/toplu menü, çalışan ayrıntısı, kaydedilmiş görünümler ve presetler. İçe aktarım CSV; dışa aktarım panelinde bordro/SGK çıktısı, PDF/Excel biçimleri mevcut. Düzeltme ekle/düzenle (manuel kayıt). Tablo alanları `PDKSTableView` satır modelinden gelir; kolon başlıkları dinamik sunulur. Rol kapısı: proje kapsamı.

### `/shifts` — Vardiyalar
- Route/ana bileşen: `src/App.tsx:76` → `src/pages/Shifts.tsx`; menü: **Vardiyalar**. Convex: `employees.list`, `shifts.list/listAssignments/create/update/remove/definitionUsage/definitionImpacts/previewBulkAssign/bulkAssignShift/updateAssignment/removeAssignment`, `leaves.listForRange`, `holidays.listForRange`.
- Takvim vardiya atamaları; tarih aralığına göre vardiya, çalışan, izin ve tatil örtüşmeleri. Atama önizleme/toplu vardiya atama, atamayı düzenleme/silme, vardiya tanımı ekle/düzenle/sil. Filtre ve CSV/Excel/PDF dışa aktarma görünmüyor. Form alanları vardiya adı ve vardiya saatleri/atama kapsamı (tanım ve toplu atama diyaloglarında). Rol kapısı: proje bağlamı.

### `/leaves` — İzinler
- Route/ana bileşen: `src/App.tsx:77` → `src/pages/Leaves.tsx`; menü: **İzinler**. Convex: `leaves.summary/listPage/employeeOptions/listForRange/create/update`.
- İzin listesi/özet; kişi/departman arama, izin türü, dönem/ay ve başlangıç-bitiş filtreleri. Ekle/düzenle; sil/toplu işlem/dışa-içe aktarma görünmüyor. Form: kişi, izin türü, başlangıç-bitiş, durum ve açıklama/not alanları (LeaveForm). Rol kapısı: aktif proje.

### `/settings` — Ayarlar
- Route/ana bileşen: `src/App.tsx:78` → `src/pages/Settings.tsx`; menü: **Ayarlar** (adminOnly). Convex: `settings.getGeneral/upsertGeneral/getWork/saveOvertime/getDarkMode`, `holidays.list/create/remove/seedTurkishHolidays/getOvertimeRates`, `reports.getSgkMonthlyReport/getOvertimeSummaryReport/getAttendanceSummaryReport/getDepartmentCostReport/getReportSchedule/saveReportSchedule`, `hikBridge.listBridges/createBridge/revokeBridge`, `privacyBiometric.getBiometricModule/setBiometricModule`, `privacyRetention.getRetentionAndAssistant/setCardReadingRetention/setAssistantMasking`, `biometricDestruction.previewBiometricDestruction/startBiometricDestruction/getDestructionRun`; admin paneli `projects.list`, `users.list`.
- Bölümler: genel, çalışma/bordro, raporlar, bildirim, e-posta, entegrasyonlar, gizlilik; alt sekme/bölüm filtreleri. Ayarları kaydetme; tatil ekleme/silme/Türkiye tatillerini oluşturma; entegrasyon oluşturma/iptal etme; gizlilik ve biyometrik işlem başlatma. Genel/çalışma/rapor/bildirim/e-posta/entegrasyon/gizlilik alanları bölüm formlarında; liste/Excel dışa aktarma genel ayar sayfasında yok (rapor bölümü PDF üretir). Kapı: admin yetkisi; olmayan bölümler AccessDenied.

### `/audit-log` — Denetim Kaydı
- Route/ana bileşen: `src/App.tsx:79` → `src/pages/AuditLog.tsx`; menü: **Denetim Kaydı** (adminOnly). Convex: `auditLog.list` (sayfalı), `auditLog.actorOptions`.
- Denetim olayları; aktör, proje ve zaman aralığı/URL state filtreleri, sistem kayıtlarını dahil etme anahtarı; sayfalama/devamını yükleme. Ekle/düzenle/sil, toplu işlem ve dışa/içe aktarma yok. Form yok. Kapı: `capabilities(profile.role).auditLog` (yönetici yetkisi).

### `/reports` — Raporlar
- Route/ana bileşen: `src/App.tsx:80` → `src/pages/Reports.tsx`; menü: **Raporlar**. Convex: `departments.list`, `cardReadings.getPdksTableData/getMonthlyPayrollSheet/listReportTransactions`; resmi rapor bileşenlerinde `reports.getSgkMonthlyReport/getOvertimeSummaryReport/getAttendanceSummaryReport/getDepartmentCostReport`.
- Rapor grupları/katalog veya rapor sonucu; kişi arama, ay/dönem (hazır veya özel başlangıç-bitiş), departman ve işlem raporunda sonuç filtresi. CSV/Excel/PDF rapor indirme rapor türüne göre; CRUD ve içe aktarma yok. Rol kapısı: `capabilities` rapor erişim kontrolü.

### `/reports/:group` — Rapor grubu
- Route/ana bileşen: `src/App.tsx:81` → aynı `src/pages/Reports.tsx`; menü: **Raporlar**. Convex: grup ekranından seçilen rapora göre `/reports` ile aynı sorgular; gruba göre rapor listesi/özel resmi rapor görünümü, filtre ve export türü rapor tanımına bağlı. CRUD/içe aktarma yok. Rol kapısı: rapor yetenek kontrolü.

### `/reports/:group/:slug` — Rapor ayrıntısı
- Route/ana bileşen: `src/App.tsx:82` → aynı `src/pages/Reports.tsx`; menü: **Raporlar**. Convex: rapor tanımı veri kaynağına göre `cardReadings.getPdksTableData/getMonthlyPayrollSheet/listReportTransactions` veya resmi rapor modülü sorguları.
- Filtreler: kişi, ay/dönem, departman, işlem türünde izin/ret/bilinmiyor. İlgili formatta dışa aktarım; CRUD/içe aktarma yok. Rol kapısı: rapor yetenek kontrolü.

### `/profile` — Profil
- Route/ana bileşen: `src/App.tsx:83` → `src/pages/Profile.tsx`; menü: **Profil** (`menu:false`, yan menüde gizli). Convex: `users.updateProfile`, `files.generateUploadUrl/claimUpload/saveUserPhoto`.
- Profil fotoğrafı, profil formu, güvenlik ve proje üyelikleri; listede CRUD/dışa-içe aktarma yok. Form alanları: profil bileşeninde ad/soyad/e-posta ve profil fotoğrafı; rol kapısı: Layout oturumu.

### `/engineering-department` — Mühendislik Departmanı İncelemesi
- Route/ana bileşen: `src/App.tsx:84` → `src/pages/EngineeringDepartment.tsx`; menü: **Mühendislik** (`menu:false`). Convex: `departments.list`, `employees.list`.
- Departman/personel inceleme görünümü; düzenleme/ekleme/silme, filtre/arama ve dışa/içe aktarma sayfa bileşeninde görünmüyor. Rol kapısı: Layout oturumu ve proje scope’u.

### `*` — Bulunamadı
- Route/ana bileşen: `src/App.tsx:86` → `src/pages/NotFound.tsx`; menü: yok. Convex/arama/liste/form/CRUD/dışa-içe aktarma yok; rol kapısı yok.

# C2c frontend denetimi (10 İzinler · 11 Denetim · 12 Admin · 13 Ayarlar)

Kapsam: `git diff -- src` + yeni dosyalar, salt okuma. Canlı oturum yok (kod düzeyi).

## Kapılar (kendi koşum)
- tsc app: exit 0 · tsc convex: exit 0 · eslint src convex: exit 0
- vitest: 102 dosya / 1042 test yeşil · vite build: exit 0 (yalnız chunk-size uyarısı)
- grep: `any`/`as any`/`!` yok, `useToast` tüketimi yok (yalnız toaster altyapısı), sabit hex/gradyan/emoji yok. Silinen 6 Ayarlar dosyasının tüketicisi yok, ölü `?tab=` bağlantısı yok.

## Özet: Canlıya hazır mı — HAYIR (koşullu)
1 yüksek (Ayarlar'da sessiz taslak kaybı), 3 orta; gerisi düşük. Yüksek bulgu düzelmeden/bilinçli kabul edilmeden deploy önerilmez. Orta bulgular deploy'u engellemez ama #2 hızlı düzeltilmeli.

## YÜKSEK

### 1. Ayarlar'da rota değişimi korumasız → kaydedilmemiş taslak sessizce kaybolur
- `src/pages/Settings.tsx:41` — yalnız `useUnsavedChangesGuard` (beforeunload) + sekme (`handleTabChange`) + proje değişimi bağlı. Yan menüden başka sayfaya geçiş, `<Link>`, tarayıcı geri/ileri **engellenmiyor**; Genel/Mesai/Bildirim/Hatırlatma taslakları onaysız silinir. İzinler (`LeaveForm`) ve Admin (`useAdminFormGuard`) bu boşluğu `navigationGuard` adaptörüyle kapatmış; Ayarlar atlanmış.
- Düzeltme: `useAdminFormGuard` benzeri ortak hook'u (aşağıda #2/#10 ortaklaştırma) Settings'te `dirty || pending` ile çağır (`pending`'de no-op). Sekme/proje guard'ı zaten var.

## ORTA

### 2. Navigation guard'ları LIFO olmayan kapanışta kalıcı sızıntı → tüm gezinme ölür
- `src/components/admin/hooks/adminNavigationGuard.ts:12-19,44-48` ve `src/components/leaves/lib/navigationGuard.ts` (aynı kod): cleanup yalnız `navigator.push === guardedPush` ise geri yazıyor. İki guard üst üste kurulup **önce alttaki** kaldırılırsa, alttaki restore etmez; üsttaki kaldırılınca `push`'u alttakinin (ölü) sarmalayıcısına geri yazar. Sarmalayıcı eski closure'daki `pending=true`'yu görür → `request` hiçbir şey yapmaz → sayfa yenilenene kadar tüm `Link`/`navigate` sessizce ölür.
- Erişilebilir senaryo: Cihaz havuzu → "Envanteri senkronize et" (`AdminDevicesPanel.tsx:92`, pending guard A) → sync sürerken cihaz Sheet'i aç ve alan değiştir (dirty guard B) → sync biter (A kalkar, restore etmez) → Sheet'i "Çık" ile kapat (B kalkar, A'nın ölü sarmalayıcısını geri yazar). Benzer: `DeleteUserDialog` (hep mount, pending guard) + `UserFormDialog`; `ProjectDeletion` + `ProjectEditor`.
- Düzeltme: tek modül-seviyesi kayıt defteri (Set/stack) ile **tek** sarmalayıcı kur; ya da her sarmalayıcıya `active` bayrağı koyup cleanup'ta `active=false` (pass-through) yap ve zinciri id ile çöz. Test: A kur, B kur, A kaldır, B kaldır → `navigator.push === orijinal` ve gezinme çalışıyor.

### 3. Cihaz düzenleme: eski anlık görüntüyle `reassignDevice` → başkasının taşıdığı cihazı geri taşır + kapıları siler
- `src/components/admin/AdminDeviceDialog.tsx:165` (+ `AdminDevicesPanel.tsx` `setDialog({device})` canlı olmayan satır kopyası). Yalnız ad değişse bile `reassignDevice({projectId: <diyalog açılırkenki proje>})` gönderiliyor; backend (`convex/devices.ts:944`) canlı `assignedProjectId`'yi karşılaştırır. Başka bir admin cihazı A→B taşıdıysa, ad-only kayıt cihazı **A'ya geri taşır ve B'deki kapıları/okuyucuları purge eder**. `claim` vs `reassign` seçimi de eski `device.assignedDeviceId`'ye bakıyor (`:151`).
- Düzeltme: proje değişmediyse proje göndermeyen ayrı ad-güncelleme yolu (backend'e `renameOnly` ya da `expectedAssignedProjectId` argümanı) ; en azından diyalog canlı satırı `useQuery` ile okuyup açılışta değişmişse "Cihaz başka yerde değişti, yenileyin" desin.

### 4. Tatil yılı alanına elle yazılamıyor
- `src/components/settings/sections/components/HolidayCalendarManager.tsx:73`: kontrollü `type=number` input'ta ara değerler (örn. "2" → 2 <1900) reddediliyor, alan eski değere geri dönüyor; yalnız ok/spinner çalışır. 
- Düzeltme: yerel `yearText` string state; geçerli 4 haneli yıl olunca `setYear`, blur'da geçersizse geri yükle.

## DÜŞÜK

5. **Arama kutuları debounce'suz → her tuşta yeni abonelik** (kota): `AdminUsersPanel.tsx:169`, `AdminProjectsPanel.tsx:414`, `AdminDevicesPanel.tsx:154`, `LeaveFilters.tsx:96` (employeeOptions), `ReportsSettings.tsx:147` (saatlik ücret → ağır `getDepartmentCostReport`). Audit zaten `useDebouncedValue(300)` kullanıyor; aynısını uygula.
6. **Ortaklaştırma**: `adminNavigationGuard.ts`/`.test.ts` ile `leaves/lib/navigationGuard.ts`/`.test.ts` yalnız fonksiyon adı farkıyla birebir aynı. Tek `src/lib/navigationGuard.ts` + #2 düzeltmesi + Settings kullanımı.
7. **Ölü kod**: `admin/components/UserTableHeader.tsx` (tüketicisi yok; `text-2xl font-bold`, `bg-primary` A2 dışı) ve `UserPasswordResetDialog.tsx` kullanılmıyor → sil. (Koordinatöre iletilen 390px taşma açığı bu yüzden fiilen kapandı; dosya silinmeli.)
8. **Yetki yükseltme onaysız**: `UserFormDialog.tsx:81` `reducing` yalnız rol/üyelik azaltmada onay istiyor; `super_admin`'e yükseltme tek tıkla kaydediliyor → yükseltmede de ConfirmDestructive.
9. **Üyelik kör üzerine yazma**: `updateRole` tam `projectIds` listesi gönderir; form açıkken başka admin üyelik eklediyse silinir (sürüm kontrolü yok). Backend'e `expected` token ya da diff (added/removed) göndermek.
10. **Genel ayarlar tüm alanları yazar**: `generalPayload` değişmeyenleri de gönderir; "başka oturumda değişti" bildirimi var ama Kaydet o alanları ezer. Yalnız değişen alanları gönder (kısmi patch). Diğer bölümlerin (workingDays vb.) ezilmediği doğrulandı (payload'da yok).
11. `AdminDeviceDialog`: kayıt başarılı + atama başarısızsa (`registeredId` set) kapatırken "değişiklikler silinecek" onayı çıkar (cihaz zaten kayıtlı); `Sheet`'te `SheetDescription` yok (Radix aria-describedby uyarısı).
12. `UserFormDialog.tsx:65` dirty'yi `JSON.stringify` sırasına bağlıyor: aynı projeyi işaretle→kaldır→işaretle sıra değiştirir, değişiklik yokken "dirty" görünür. `projectIds`'i sıralayıp karşılaştır.
13. `useAuditUrlState.ts:8` modül-seviyesi mutable `lastAuditScope` (test/SSR kırılgan); eski ziyaretten kalan scope derin bağlantıdaki `user` filtresini siler. Kabul edilebilir, not.
14. `ActorFilter` (AuditFilters.tsx): seçili kullanıcı varken seçenekler yüklenirken Select `all` gösteriyor (filtre uygulanıyor ama etiket "Kullanıcılar yükleniyor…").

## Doğrulananlar (sorun yok)
- **10 İzinler**: `expectedUpdatedAt` her güncellemede gönderiliyor; `notes: values.notes || null` temizlemeyi doğru yapıyor; tarih yalnız değiştiyse gönderiliyor (legacy tarih korunuyor); pending/rejected satırlarda Düzenle yok (`Leaves.tsx` onEdit + `LeaveList`/`LeaveDetails`), backend de `LEAVE_READ_ONLY`; overlap hatası formu kapatmıyor, alan hatası + "Kaydı aç"; `notesHidden` açıklaması var; sayaç yalnız `truncated=false`; boş-ama-bitmemiş sayfada "daha eski kayıtları tarayın" + manuel Devam (otomatik devam yok); `LeaveQueryBoundary`/`QuerySectionBoundary` var; PDKS URL sözleşmesi (`report/from/to/date/person`) `usePdksFilterParams` ile uyumlu; `listForRange` tüketicisi bozulmamış.
- **11 Denetim**: "Filtreleri temizle" `filterKeys` dışını (allProjects) korur, proje URL'de değil bağlamda → korunur; `actor:'system'` ve "Silinmiş kullanıcı" ayrımı doğru; `actorOptions` yalnız seçici açılınca/seçili aktörle yükleniyor; **dışa aktarma butonu yok**; sayaç "yüklendi · daha fazla olabilir" dürüst; satır açma gerçek `<button>` + aria-label; tarih aralığı hatası `role=alert`+`aria-describedby`.
- **12 Admin**: kullanıcı düzenleme tek atomik `updateRole({role, projectIds})`; kendi rolü select `disabled` (`isSelf`) + kendi hesabı silme kapalı (menü + onConfirm); rol/üyelik azaltmada ConfirmDestructive; üyelikler yüklenmeden Kaydet kapalı (`editReady`) ve snapshot bir kez alınıyor; proje silme `getDeletionImpact` canlı sorgusuyla, `canDelete=false`'ta buton kapalı ve onConfirm tekrar kontrol ediyor; `deviceCount` kolonu yok; 3 sekme URL'den türetiliyor (URL↔state `useEffect` yok, panel kapanma riski yok); `AdminUsersPanel` default export + Ayarlar'da `useAdminPrimaryAction` yoksa yerel buton (props değişmemiş); dakikalık yenileme yalnız `connection` filtresinde `id` ile ve `useStableAdminPage` ile sayfa korunuyor, `useNow` 30 sn ama sorgu argümanı dakikaya yuvarlı.
- **13 Ayarlar**: `useSettingsDraft` abonelik güncellemesinin taslağı ezmesini engelliyor; sekme/proje guard'ı `dirty||pending` ve pending'de no-op; dikey menü `nav aria-label` + `aria-current`, mobilde etiketli `select`; kayıt yüklenmeden kaydetme engelli (`settings===undefined` throw); köprü anahtarı maskeli; `ReportDownloadSettings` kapsamı proje değişince sıfırlanıyor.
- **Ortak**: `useProjectChangeGuard` (`dirty||pending`, pending'de no-op, `latest` ref ile eski closure yok) doğru kullanılmış (LeaveForm, useAdminFormGuard, Settings); `projects.list`, `leaves.listForRange`, `auditLog.getPdksAuditForEmployee` tüketicileri bozulmamış; `projects.listActive/getById` authedQuery'ye döndü, tek tüketici `ActiveProjectContext` zaten giriş yapmış kullanıcıyla çağırıyor.

## Notlar
- Canlı doğrulanamayanlar (deploy sonrası bakılmalı): 390px yatay taşma (Ayarlar vardiya/raporlar formları, Audit tablosu), popstate geri/ileri akışı (`navigationGuard`) gerçek tarayıcıda, Radix Select ARIA.
- Backend deploy edilmeden bu UI'ın `leaves.listPage/summary/employeeOptions`, `auditLog.actorOptions`, `projects.adminList/getDeletionImpact`, `users.adminList`, `adminDevices.adminListPage` çağrıları canlıda "function not found" verir; sıra: Convex deploy → frontend.

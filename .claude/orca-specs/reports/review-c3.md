# Faz C3 denetim raporu (salt-okuma)

Özet: Veri kaybı / idempotentlik / yarış kontrollerinde **kritik bulgu yok**. Tek engel: diff kaydı cihaz gönderimini izlenemez bırakıyor (YÜKSEK #1). Kapılar yeşil.

## Kapılar (kendi koşumum)
| Kapı | Sonuç |
|---|---|
| `tsc -p tsconfig.app.json` | 0 hata |
| `tsc -p convex/tsconfig.json` | 0 hata |
| `eslint src convex` | 0 hata (exit 0) |
| `npx vitest run` | 106 dosya / 1101 test yeşil |
| `npx vite build` | OK (yalnız chunk>500kB uyarısı, eski) |
| `git diff --check` | temiz |
| CLAUDE.md taraması (eklenen satırlar) | `any`/`as any`/`!` yok; yeni `useToast` yok; palet sınıfı yok |

## YÜKSEK

### 1. Diff kaydı cihaz gönderimini izlenemez bırakıyor (sessiz hata)
- `src/hooks/access-rules/useComplexAccessRuleMutations.ts:111-115`, `convex/accessRules.ts:1040-1046`
- Sorun: diff kaydı `startBackgroundSync` çağırmıyor → yeni `deviceSyncRuns` ("Son gönderimler") kaydı yok. Hik `syncEmployeeToDevicesInternal` / `deleteEmployeeFromDevicesInternal` sonuçları hiçbir yerde saklanmıyor (yalnız IDE `idePendingOperations` bannerı var). Toast "Değişen yetkilerin cihaz işlemleri arka planda yürütülür" der; başarısız Hik gönderimi kullanıcıya hiç görünmez. Ayrıca aynı değişikliği tekrar kaydetmek boş diff üretir → yeniden gönderim de olmaz (retry yolu yok).
- Doğrulama: eklenen kişi → `syncEmployeeToDevicesInternal` + `reconcileRemovedEmployeeIde` (içinde her zaman `syncEmployeeToIdePanels`) ✔; çıkarılan → `deleteEmployeeFromDevicesInternal` + IDE orphan `deleteIdeUserFromPanels` ✔; kapsam/cihaz/kapı/aktiflik değişimi → tam `syncWeekPlan` (grup çalışanlarını yeniden sync eder) + `syncPermissionToIdePanels` + tüm kalanlar + roster reconcile ✔. Yani gönderim GERÇEKTEN yapılıyor; sorun görünürlük.
- Düzeltme (en küçük): diff başarılıysa `startBackgroundSync(params.id)` yine çağır ama yalnız "yeni run kaydı" için (tam gönderim gerekmiyorsa hafif bir `recordRun`/`startRuleSync` varyantı `onlyMembers: addedIds`), ya da sunucuda diff işleri bir `deviceSyncRuns` satırına bağlansın. En az: toast'a "Sonucu Son gönderimler / cihaz sayfasında kontrol edin" + boş-diff'te yeniden gönderim butonu (mevcut `ProjectSyncButton`) yönlendirmesi.

## ORTA

### 2. Denetim kaydı: proje değişiminde `user` filtresi artık temizlenmiyor
- `src/components/audit/useAuditUrlState.ts:12`, `src/components/Layout.tsx:46`
- Sorun: `Layout` ErrorBoundary'si `key={pathname|activeProjectId}` → proje değişince sayfa REMOUNT olur, `useState(previousScope)` sıfırlanır (`undefined`). Eski modül değişkeni (`lastAuditScope`) tam bu yüzden vardı. Yeni kod yalnız "aynı mount içinde scope değişimi"ni görüyor, ki gerçekte olmuyor → derin bağlantıdan gelen/seçili `user` başka projeye taşınır (boş sonuç / yanlış aktör). Test (`auditScopeParams`) saf fonksiyonu sınıyor, remount'u değil.
- Düzeltme: derin-bağlantı ile proje-değişimini ayır: modül-düzeyi `lastScope` tut, `useEffect` cleanup'ında `setTimeout(()=>{lastScope=undefined},0)` ile sayfadan ayrılmada sıfırla (remount'ta yeni mount aynı tick'te `clearTimeout`); ya da `user` paramını proje değişiminde `ActiveProjectContext` değişim anında sil.

### 3. `getDetails` kesilme bayrakları tüketilmiyor / kaba
- `convex/accessRules.ts:163-164` (`devicesTruncated: deviceRows.length > 0`, `doorsTruncated: doorRows.length > 0`), `:571` (`membersTruncated`)
- Sorun: bayraklar yalnız `loadRuleEditor` içinde yok sayılıyor (editör zaten cursor ile tam yüklüyor) — veri kaybı yok. Ama `scopeTruncated` dalında cihaz satırı varsa HER İKİ bayrak true oluyor (yalnız biri aşmış olsa bile) → bayraklar "dürüst" değil; ileride tüketen UI yanıltılır.
- Düzeltme: `devicesTruncated: deviceRows.length > SUMMARY_RELATION_LIMIT`, `doorsTruncated: doorRows.length > SUMMARY_RELATION_LIMIT`.

### 4. Diff yolunda cihaz çıkarılınca eski kapı bağı temizliği istemciye bağlı
- `convex/accessRules.ts:1001` (`doorIds === undefined && removedDeviceIds.length>0` yalnız legacy yolda koşar)
- Sorun: diff modunda `doorIds` hep tanımlı → `deleteStaleGroupDoors` hiç çalışmaz. İstemci cihazı kaldırıp o cihazın açık kapılarını `doors.removed`'a koymazsa (ya da eşzamanlı başka yönetici o cihaza kapı eklediyse) `groupDoors` satırı kalır; kapı bacağı (`doors.deviceId → groupDoors`) yetki üretmeye devam eder. Normal ZoneDeviceTree akışı kapıları da düşürüyor (eski davranışla eşdeğer); API/başka istemci için açık.
- Düzeltme: diff modunda da `removedDeviceIds` için, `doors.added` içinde olmayan ve o cihaza ait eski `groupDoors` satırlarını sil (eşzamanlı eklenenler hariç tutulabilir) ya da bunu bilinçli sınır olarak dokümante et.

## DÜŞÜK

5. `useRuleForm.ts:14` istemci paketi `convex/lib/accessRuleDiff.ts`'i (→ `ConvexError`, `reconcileMath`) içe alıyor; build geçiyor, sorun değil. İleride sunucu-only import eklenirse bundle kırılır — saf yardımcıyı `src/lib` ya da `convex/lib/pure` altında tutmak daha güvenli.
6. Hik: hiç senkronlanmamış (hikWeekPlanNo atanmamış) kurala yalnız üye eklenirse `syncRule=false` → hafta planı atanmaz, kişi plansız gider. Nadir (kural ilk kez kaydında zaten tam sync); yine de `!rule.hikWeekPlanNo` ise `syncRule=true` yapın.
7. `useExportUtils.ts` PDF renkleri CSS değişkeninden: koyu temada dışa aktarılan PDF koyu zeminli çıkar. Çıktı için sabit açık tema değerleri daha uygun.
8. `src/App.css` silindi: tek içerik `#root{width:100%;min-height:100vh}`; import kaldırıldı, başka referans yok. `Layout` yüksekliği kendisi veriyorsa sorun yok; 1440/390'da boş sayfa (kısa içerik) dipte beyaz kalıyor mu bakılmalı.
9. `mobile/lib/**` ve `mobile/test/**` değişiklikleri (4 dosya + `mobile/test/config/`) C3 kapsamında değil — commit'e C3 ile karıştırmayın.

## Doğrulananlar (sorun yok)
- **Veri kaybı (rules diff)**: sunucu yalnız açık `added/removed` uygular; kırpılmış editör listesi hiçbir şeyi silemez (`applyRelationDiff` canlı listeye uygular, eşzamanlı ekleme korunur). `loadRuleEditor` yalnız tüm cursor sayfaları başarılıysa açar, `getDetails` önizlemesini üyelik saymaz. Kayıt yinelenmez: `diffIds` Set tabanlı, `added` yalnız canlıda olmayanı ekler; aynı istek 2. kez → boş diff (test `accessRuleDiff.test.ts` kapsıyor). `RULE_DIFF_CONFLICT` ve `RULE_DIFF_MIXED_MODE` yazmadan önce fırlıyor.
- **Eski tam-liste yolu**: sayım kontrolü (take(101/51/51)) patch/silmeden ÖNCE ve aynı transaction'da; sınır aşılırsa `RULE_MEMBERS_TRUNCATED`, hiçbir şey yazılmaz; mesaj eski istemcinin `errorMessage`'ı ile görünür. Sınır içinde legacy da artık diff-uygular (değişmeyen satır silinip yeniden yazılmıyor).
- **Toggle**: `toggleDoors` yalnız dokunulan panel için "tüm panel" yedeğini somutlaştırıyor; aday listede olmayan açık seçimler korunuyor (test var).
- **users.updateRole**: `membershipChanged` sırasız küme karşılaştırma + tekrar eden satır toleranslı; `expectedProjectIds` yoksa eski davranış; hata `ConvexError(MEMBERSHIP_CHANGED)` form `error` alanına düşüyor; `editReady` baseline yüklenmeden kaydı engelliyor.
- **Genel ayarlar**: `companyName` opsiyonel; kayıt yoksa (`settings` null) tam payload + varsayılan "NGS Access"; `null`=temizle, eksik=değişmedi; eski istemci tam payload ile aynı sonuç; baseline donmuş açılış anlık görüntüsü (uzak değişiklik korunuyor, test var).
- **Vardiya**: `ConvexError.data.message` "OVERLAP:N" / "CALENDAR: …" ön ekini koruyor; eski istemcinin `errorMessage(...).includes("OVERLAP:"|"CALENDAR:")` kontrolü hâlâ eşleşir. Tek atamada çakışma artık `SHIFT_OVERLAP` kodlu (mesaj ön eksiz — eski istemcide de öyleydi).
- **Proje değişimi koruması**: `SlideOverPanel` ve `DeviceDetailsPanel` `useProjectChangeGuard`; "projeyi geri al" (`setActiveProjectId(previous)`) kalıntısı yok; pending'de `() => {}` (no-op); dirty/pending panel kapanınca sıfırlanıyor.
- **Sweep**: `notify` eşleme metinleri korunmuş (destructive→`notify.error`, "Kısmi" hâlâ error); renk token'ları var (`success`, `warning-bg`, `danger-bg`, `info-bg`, `selected`, `successSubtle`) ve anlamı koruyor (hata kırmızı → destructive); IDE kurulum kartı mantığı (scan/provision/status) değişmemiş, yalnız toast+sınıf.
- **UI**: Canlı/Geçmiş `aria-pressed` + seçili stil; `EmployeePicker` tek etiket (`aria-label`, ikinci `FormFieldWrapper` yok); `DeviceListErrorBoundary` retry `setState({failed:false})` (reload yok); `MoveReaderDialog` dolu hedef `disabled` + "Dolu", `selectedTarget` yalnız dolu olmayanlar arasından → submit kilidi sağlam; `shiftError` her iki kodu da tanıyor.

## Canlıya hazır mı
**Hayır — tek engel #1** (diff kaydı sonrası cihaz gönderimi izlenemiyor). #2–#4 engel değil ama #2'nin canlıda gerçek davranışı (proje değişiminde `user` kalıyor) kullanıcıya yansır. Veri kaybı riski bulunmadı.

# Düzeltme-2 — Kapı / asistan / saklama / kart metinleri (denetim bulguları)
ÖNCE `.claude/orca-specs/kvkk1-common.md`, sonra `.claude/orca-specs/reports/review-kvkk1-backend.md` (Y1, Y3, O1, O3, O5, D1, D2, D5) ve `review-kvkk1-frontend.md` (YÜKSEK-1/2, #4, #5, #7, #9) oku.
Kod yazılı ve kapıları yeşil; bu görev YALNIZ aşağıdaki düzeltmeler (yeniden yazma YOK). Başka worker aynı anda `biometricDestruction*` ve `BiometricDestructionCard` üzerinde çalışıyor: onlara DOKUNMA.

## Koordinatör kararları
- **Saklama alt sınırı 1825 gün (5 yıl)**, üst 3650 (10 yıl): okuma kayıtları puantaj/bordro/rapor hesabının KAYNAĞI; daha kısa süre silme yasal kanıtı yok eder. Sabit `convex/lib/privacySettings.ts` `MIN_CARD_READING_RETENTION_DAYS` (bu görevde o dosyayı SEN değiştirebilirsin) + tüm testler/metinler.
- **Asistan, `projectId`siz eski istemci**: sunucuda kullanıcının erişilebilir projeleri çözülür (`getProjectIdsForUser`); TAM 1 proje varsa o proje ve MASKELİ sunucu bağlamıyla devam eder; 0 veya >1 ise OpenAI'a gitmeden açık mesaj ("Hangi proje için sorduğunuzu belirlemek üzere sayfayı yenileyin"); istemcinin `dbContext`'i yine YOK sayılır.

## Ownership (yalnız bunlara yaz)
`convex/onboarding.ts`, `convex/actions/openaiChat.ts`, `convex/actions/getChatData.ts`, `convex/actions/hikGatewayDevice.ts` (yalnız `captureFaceFromDevice`), `convex/hikvisionSync.ts` (yalnız D1 satırı), `convex/actions/hikQueueWorker.ts` (yalnız D2),
`convex/privacyBiometric.ts` (D5), `convex/lib/privacySettings.ts`, `convex/privacyRetention.ts`, `convex/lib/cardReadingRetention.ts`, `convex/lib/chatMasking.ts`, ilgili testler,
`src/components/settings/sections/privacy/{RetentionAssistantCard,BiometricModuleCard}.tsx` (+ testleri), `src/components/employees/EmployeeConsentsCard.tsx`, `src/components/pdks/chat/**`, rapor.

## Düzeltmeler
1. **Y1**: `onboarding.ts` iki `ctx.db.insert("projects", …)` sonrası `upsertPrivacySettings(ctx, projectId, { biometricEnabled: false })` + `writeAudit` (aynı transaction; `projects.create` kalıbı). Test.
2. **Y3**: yukarıdaki asistan kararı (`openaiChat.ts` ~61-63). `processMessage` imzası aynı kalır; `source` sözleşmesi korunur. Test: projectId yok + 1 proje → çalışır; >1 → dış çağrı YOK.
3. **O1**: maskelemeyi `getCardReadings`'ten KALDIR (kullanıcının kendi ekranı gerçek adları göstermeli); maske yalnız OpenAI sınırında (`getAssistantContext`/`processMessage`) kalsın. `chatMasking.ts` testleri uyarlansın.
4. **O3**: `captureFaceFromDevice` (`hikGatewayDevice.ts`) cihazın projesi için biyometri kapısından geçsin (`assertBiometricSyncAllowed`/`assertBiometricAllowed` kalıbı; kapalıysa `BIOMETRIC_DISABLED`). Çağıranı yok ama public.
5. **O5 + FE YÜKSEK-1**: alt sınır 1825; `RetentionAssistantCard` metni düzelt: "PDKS kayıtları silinmez" İFADESİNİ KALDIR; yerine "Okuma kayıtları puantaj, bordro ve raporların hesap kaynağıdır; süre dolunca daha eski dönemler yeniden hesaplanamaz ve raporlanamaz. Gerekli raporları önce dışa aktarın; yasal saklama süresini (5–10 yıl) yasal danışmanınıza sorun."
   Aynı cümle `ConfirmDestructive` etkilerinde de olsun. Mevcut sınır doğrulama testleri 1825–3650'ye güncellensin.
6. **FE YÜKSEK-2**: `EmployeeConsentsCard.tsx:84,93`: `e.message` yerine `notify.error(başlık, e)` (ConvexError ham JSON göstermesin). Biyometrik "Rıza Al" düğmesi modül kapalıyken (`getBiometricModule.enabled === false`) PASİF + açıklama. Rıza iptali tek tık: kısa onay ekle (`ConfirmDestructive`). a11y #7: `label htmlFor`/`id`, düğmelere `aria-label={`${meta.label} rızasını iptal et`}`.
7. **FE #5**: asistan maskesini KAPATIRKEN `ConfirmDestructive` ("çalışan adları üçüncü taraf yapay zeka servisine gönderilir") — saklama kısaltma kalıbı.
8. **D1**: `hikvisionSync.ts` ~560-563 modül kapalıyken engellenen bridge ekleme op'ları `failed` + `attemptCount: 5` (ya da eşdeğer) olsun ki `cleanupStaleSyncIssues` bunları kapatsın. **D2**: `hikQueueWorker.ts` ~154 `addFingerprint` çalıştırmadan hemen önce kapıyı yeniden kontrol et. **D5**: `setBiometricModule` eski (satırsız) açık projede `enabled:true` + gerekçe gönderilirse gerekçeyi YAZ (no-op değil).
9. **FE #9** (küçük): saklama kaydı sonrası form kısa süre eski değeri göstermesin (reset'i sorgu güncellenince yap ya da iyimser güncelle).

## Kapsam dışı
İmha aracı (Düzeltme-1), schema, bridge. Hepsi için test ekle/uyarla. Canlıya çalıştırma YOK. Rapor: `.claude/orca-specs/reports/kvkk1-fix-misc.md`.

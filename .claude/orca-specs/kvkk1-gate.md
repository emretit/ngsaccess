# Worker A — Biyometri modülü kapısı + rıza/aydınlatma metni
ÖNCE `.claude/orca-specs/kvkk1-common.md` oku (zorunlu).

**Hedef:** Projenin biyometri modülü kapalıyken (`isBiometricEnabled` = false) yüz/parmak izi eklemek ve cihazlara göndermek backend'de REDDEDİLİR; admin modülü yalnız zorunlu gerekçe +
uyarı metniyle açabilir/kapatabilir; çalışan rıza kartında biyometri PDKS gerekçesi olarak sunulmaz ve aydınlatma metni şablonu vardır; yeni projeler biyometri KAPALI başlar.

## Ownership (yalnız bunlara yaz)
- `convex/privacyBiometric.ts` (YENİ: `getBiometricModule` adminQuery, `setBiometricModule` adminMutation) + `convex/lib/biometricGate.ts` (+test) (YENİ)
- `convex/employeeFaces.ts`, `convex/employeeFingerprints.ts`, `convex/employeeConsents.ts` (yalnız kapı eklemek için)
- `convex/projects.ts` (yalnız `create`: yeni projede `upsertPrivacySettings(ctx, id, { biometricEnabled: false })`), `convex/hikvisionSync.ts` + `convex/actions/hikvisionSync.ts`
  (yalnız biyometrik op enqueue/yürütme girişine kapı; mevcut akışı yeniden yazma)
- `src/components/settings/sections/privacy/BiometricModuleCard.tsx` (+ test), `src/components/employees/EmployeeConsentsCard.tsx` (yalnız metin + aydınlatma şablonu bağlantısı),
  `src/lib/consentNotice.ts` (YENİ: aydınlatma metni şablonu, düz Türkçe, sabit string + test)

## Davranış
1. `biometricGate.ts`: `assertBiometricAllowed(ctx, projectId)` → kapalıysa `ConvexError({ code: "BIOMETRIC_DISABLED", message })`. `addFace`, `addFingerprint`, biyometrik Hik op enqueue
   (`addFace/addFingerprint`) yollarında çalışan/cihaz projesine göre çağır. **Silme yolları (`removeFace`, `removeFingerprint`, `deleteFace`, `deleteFingerprint`) KAPALIYKEN de çalışmalı**
   (kapatılan modülde veri silinebilmeli). Modül kapalıyken zaten kayıtlı şablonlar otomatik silinmez (silme Worker B'nin imha aracıdır) — kartta bunu açıkça yaz.
2. `setBiometricModule({ projectId, enabled, reason })`: projeye erişim kontrolü; açarken `reason` zorunlu (3–500 karakter, kırp) — "kritik alan erişimi gerekçesi"; kapatırken gerekçe opsiyonel.
   `upsertPrivacySettings` ile `biometricEnabled/Reason/ChangedAt/ChangedBy` yaz + `writeAudit` (eski/yeni değer). Aynı değeri tekrar yazmak sessizce no-op.
3. `BiometricModuleCard`: durum (Açık/Kapalı) + gerekçe + son değişiklik; aç/kapat akışı gerekçe alanlı onay penceresi; AÇARKEN sabit uyarı metni:
   "Yüz ve parmak izi yalnız fiziksel erişim kontrolü içindir. Mesai/puantaj takibinde kullanılamaz; bu verilerden puantaj kaydı üretilmez (KVKK Kurulu 2026/921). Yasal danışmanınıza doğrulatın."
   Mevcut (eski) projelerde satır yokken modül AÇIK görünür; kartta "Bu proje eski ayarla açık; gerekmiyorsa kapatın." notu çıkar. Kaydedilmemiş taslak koruması: `SettingsFormState` kalıbı (diğer kartlara bak).
4. `EmployeeConsentsCard.tsx`: biyometriyi PDKS/mesai gerekçesi olarak sunan her metni kaldır (grep: pdks, mesai, puantaj, devam); biyometri rızası satırlarına "yalnız erişim kontrolü" açıklaması ekle;
   `consentNotice.ts` şablonunu "Aydınlatma metni şablonu" olarak göster (kopyalanabilir, yazdırılabilir değil — kopyala düğmesi yeter). Rıza verme/geri alma mantığına DOKUNMA.

## Kapsam dışı
Şablon imha/toplu silme (Worker B). Saklama süresi + asistan (Worker C). `pdksSource` ve PDKS hesapları. Mobil. Mevcut projelerin otomatik kapatılması (yok: grandfather).
Yeni testler: `biometricGate.test.ts` (açık/kapalı/satır yok/projectId yok), `consentNotice.test.ts`, `BiometricModuleCard.test.tsx` (gerekçe zorunlu, uyarı metni, kapalı durumu).

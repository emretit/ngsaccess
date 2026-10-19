# Düzeltme-1 — İmha aracı (denetim bulguları)
ÖNCE `.claude/orca-specs/kvkk1-common.md` (ortak kurallar; "Worker B" raporu `.claude/orca-specs/reports/kvkk1-biometric-destruction.md`), sonra denetim raporlarını oku:
`.claude/orca-specs/reports/review-kvkk1-backend.md` (Y2, O2, O4, D3, D4) ve `review-kvkk1-frontend.md` (#3, #6, #8, #10). Kod ZATEN yazılı ve kapıları yeşil: bu görev yalnız aşağıdaki düzeltmelerdir, yeniden yazma YOK.
Not: `common`daki "yeni dosya/ownership" ifadeleri bu görevde şu listeyle yer değiştirir. Saklama alt sınırı kararı (1825 gün) bu görevi ilgilendirmez.

**Hedef:** (1) bridge çevrimdışıyken bile bir imha run'ının Convex fonksiyon çağrısı sayısı şablon sayısıyla DOĞRUSAL ŞİŞMEZ (run başına tek cihaz-kontrol zinciri, geri çekilen aralık); (2) projesiz eski şablonlar görünür; (3) denetim satırı şişmesi kalkar; (4) imha kartı cihaz sonucunu yanıltmaz ve taslağını Settings'e bildirir.

## Ownership (yalnız bunlara yaz)
`convex/biometricDestruction.ts`, `convex/actions/biometricDestruction.ts`, `convex/lib/biometricDestruction.ts`, `convex/lib/biometricDestructionState.ts`, `convex/lib/biometricDestruction.test.ts`,
`convex/lib/auditLogQuery.ts` (yalnız `AUDIT_TARGET_LABELS` etiketleri), `src/components/settings/sections/privacy/BiometricDestructionCard.tsx` (+ test), rapor.
`convex/schema.ts` koordinatörde: yeni tablo/index gerekirse `ask` + TAM tanım (mümkünse gerektirme).

## Düzeltmeler
1. **Y2 (en önemli)**: `finishBatch` her şablonda ayrı `checkDeviceOperations` zinciri açıyor (`biometricDestruction.ts` ~225-252, `DEVICE_WAIT_MS` 24 saat × 30 sn). Değiştir: run başına TEK kontrol zinciri.
   Bekleyen op id'lerini state'te (sınırlı: örn. son N kimlik + sayaç) ya da `hikPendingOperations`'ta imha run id'si taşıyan mevcut alanla izle; kontrol aralığı geri çeken olsun (30 sn → 5 dk → 30 dk, tavan 30 dk); köprü çevrimdışı/uzun süredir görünmüyor
   (`hikBridges`/`devices` heartbeat alanlarına bak) ise 24 saat beklemeden `cihazDogrulanamayan` olarak kapat ve run'ı `completed`a taşı. ŞART: run başına planlanan kontrol çağrısı sayısı 24 saatte ≤ ~100, şablon sayısından BAĞIMSIZ — bunu testte sayısal doğrula (ör. 500 şablon simülasyonu).
2. **D3**: `hasActiveDestructionRun` 24 saati geçen `running` run'ı "aktif değil" sayıyor; büyük imhada modül erken açılabilir. Bayatlığı yaşa değil `heartbeatAt`'a bağla (örn. son ilerleme > 30 dk ise bayat); sağlıklı uzun run kilitli kalsın. Test ekle.
3. **O2**: `employeeFaces/employeeFingerprints.projectId` opsiyonel; `projectId`'siz eski şablonlar önizleme/imhada görünmüyor, tutanak `completed` diyor. Önizlemeye "projesiz şablon" sayısını ekle (projenin çalışanları `employees.by_project` → `employeeFaces.by_employee` / `employeeFingerprints.by_employee` ile sınırlı tarama) ve UI'da ayrı uyarı olarak göster; imhaya bu satırlar yalnız çalışanı hedef projeye ait olduğunda dahil edilsin. Sınırlı sorgu (take) kuralı.
4. **O4**: şablon başına ≥2 auditLog satırı + gateway cihaz başına 2 satır. İlerleme/ara notları audit olarak YAZMA (yalnız durum satırını patch'le); audit'te yalnız başla / bitir / hata (ve cihaz özetini run sonunda tek satır). Sayıları testte doğrula.
5. **D4**: `AUDIT_TARGET_LABELS`'a `biometricDestructionRun`, `biometricDestruction`, `biometricDestructionCheck` (gerçek hedef adları kodda) için Türkçe etiketler ekle; Denetim sayfasında ham JSON yerine okunur görünmeli (`src/components/audit/auditLabels.ts` ben bakarım — dokunma; yalnız convex tarafı).
6. **UI #3**: `deviceOperations === 0` iken rozet/özet "Convex'ten silindi; cihazlardaki şablonlar ayrıca silinmeli" demeli ("Tamamlandı" tek başına yanıltıcı); `destructionSummary` "silindi" → "Convex'ten silindi". Hikvision dışı cihazların (IDE Smart vb.) hedeflenmediğini kartta açık yaz.
7. **UI #6**: kart `useSettingsFormState("destruction-"+projectId, reason!==""||confirmText!=="", starting||counting)` ile Settings'e dirty/pending bildirsin (diğer kartlardaki kalıbı kopyala).
8. **UI #8/#10**: `ConfirmDestructive`'e giden gerekçe efektinde uzun boşluksuz metin için kart tarafında kırpma/`break-words` ile sar (ortak bileşene DOKUNMA); onay diyaloğu hata yolunda satır içi hata göster.

## Kapsam dışı
Bridge'e silme desteği (ayrı iş); 50 cihaz sınırı değişmez; schema; `employeeFaces/Fingerprints` dosyaları (başka worker). Canlıya çalıştırma YOK.
Testler: Y2 çağrı-sayısı, D3 bayatlık, O2 projesiz sayım, O4 audit sayısı, UI rozet metni. Rapor: `.claude/orca-specs/reports/kvkk1-fix-destroy.md`.

# SİSTEM AUDIT — M1 KİŞİLER, ERİŞİM KURALLARI, ZİYARETÇİ

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/sistem-audit-ortak.md` dosyasını OKU; oradaki kurallar (YASAK listesi dahil) bağlayıcı.

**Rapor:** `docs/sistem-audit-2026-10-25/M1-kisi-erisim.md` (yalnız bu dosyayı yazabilirsin). Bulgu ID öneki `K-`.

## Kapsam
- Backend: `convex/{employees,employeeImport,employeeTermination,employeeConsents,employeeBiometrics,employeeFingerprints,employeeFaces,fingerprintEnrollment,departments,positions,accessRules,accessScheduleTemplates,accessGrantStatus,visitors,peopleActivity}.ts`,
  `convex/actions/hikFingerprint.ts`, `convex/lib/{access*,employee*,people*,visitor*,departmentTree,fingerprint*,ruleSchedule,grantStatus,employment,biometricGate,nullablePatch}.ts`.
- Web: `src/components/{employees,access-control,visitors,departments}/**`, `src/pages/{Employees,AccessControl,Visitors}.tsx`,
  `src/hooks/{useEmployees,useEmployeeTable,useDepartments,useVisitors,access-rules}*`, `src/lib/employees/**`.
- Eski audit: `docs/genel-akis-audit/A-kisi-erisim.md` (tamamı) + OZET Faz 1-2 maddeleri.

## Özellikle bak
- Kişi oluştur/güncelle/pasifleştir/işten çıkar/sil: bağlı kayıtlar (kural üyeliği, kart, parmak izi, yüz, PDKS, mobil oturum,
  ziyaretçi ev sahipliği) ne oluyor; cihazdan geri alma tetikleniyor mu (Hik + IDE).
- Excel import → kural üyeliği / cihaz gönderimi; kart tekilliği (proje içi / global) tutarlı mı.
- Erişim kuralı: departman vs kişi seçimi, zaman şablonu, kapı kapsamı; kural silme/değiştirme → cihazdan kaldırma.
- Yetki Durumu (grant status) doğru mu yansıtıyor; yeniden dağıtım.
- Ziyaretçi: süre bitişi cihaza yazılıyor mu (eski bulgu A6/2.4), QR/PIN, ev sahibi silinirse.
- Parmak izi/biyometri: rıza (consent) kontrolü her yolda, KVKK silme ile ilişki.
- Rol/proje kapsamı her yazma ucunda (`convex/lib/customFunctions.ts`, `roleCatalog.ts`).

## İlişkiler (bölüm 4'te mutlaka işle)
M2 Cihaz/senkron (hikvisionSync, ideSync, deviceSyncRuns, gateway persons/cards), M3 PDKS (çalışan durumu/işe giriş-çıkış tarihi,
departman/vardiya planı ataması), M4 roller/denetim log/KVKK, M5 mobil (çalışan oturumu, ziyaretçi davet, mobil erişim).

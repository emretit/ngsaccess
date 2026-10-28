# SİSTEM AUDIT — M4 HESAP/OTURUM, ROLLER, PROJE, AYARLAR, KVKK, DENETİM LOGU, ALARM, PUBLIC SAYFALAR

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/sistem-audit-ortak.md` dosyasını OKU; oradaki kurallar (YASAK listesi dahil) bağlayıcı.

**Rapor:** `docs/sistem-audit-2026-10-25/M4-hesap-yonetim.md` (yalnız bu dosyayı yazabilirsin). Bulgu ID öneki `Y-`.

## Kapsam
- Backend: `convex/{auth,auth.config,users,roles,invites,projects,userProjects,companies,onboarding,accountAccess,emailVerification,settings,userPreferences,privacyRetention,privacyBiometric,biometricDestruction,auditLog,alarms,files,crons,migrations,maintenance,seedCardReaderTest,seedHikvisionLanDevice,seedTestCardAccess,schema}.ts`
  (schema.ts: genel tutarlılık — index'ler, kullanılmayan tablo/alan, opsiyonel alan borcu),
  `convex/actions/{biometricDestruction,sendAlarmEmail,sendEmail,setPassword,openaiChat,getChatData}.ts`,
  `convex/lib/{customFunctions,auth*,permissions,roleCatalog,adminGuards,adminLists,projectScope,accountAccess,sessionRevoke,passwordPolicy,rateLimit,audit*,alarmNotify,privacy*,biometricDestruction*,chatMasking,publicUser,emailVerification,escapers,settingsUx}.ts`.
- Web: `src/App.tsx` (route koruması), `src/components/{admin,settings,audit,alarms,auth,profile,public,landing,layout,shared}/**`,
  `src/pages/{Settings,SystemAdmin,AuditLog,Alarms,Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,Profile,LandingPage,EngineeringDepartment,CheckIn,NotFound}.tsx`,
  `src/hooks/{usePermissions,useProjectAccess,useActiveProjectScope,useAuthState,useNotificationSettings}*`, `src/services/authService.ts`,
  `src/lib/{capabilities,permissionsUI,roleLabels,routeMeta,navigationGuard,consentNotice,auditExport}.ts`, `src/convexClient.ts`.
- Eski audit: `docs/genel-akis-audit/C-kurulum-cihaz-yonetim.md` (kullanıcı yönetimi/KVKK/alarm kısımları) + OZET Faz 1/5.

## Özellikle bak
- Yetki modeli: `customFunctions.ts` sarmalayıcıları (authedQuery/adminMutation/...) TÜM convex dosyalarında doğru seçilmiş mi —
  bunun için `grep -rn "export const .* = \(query\|mutation\|action\|internal\|authed\|admin\)" convex` ile SAYIM çıkar: çıplak
  `query`/`mutation`/`action` (sarmalayıcısız public uç) listesi ve her biri neden public. Bu tarama tüm modülleri kapsar (senin işin).
- Web route koruması ↔ backend yetkisi; rol yetki kataloğu (`roleCatalog`) ile UI `capabilities` eşleşmesi.
- Oturum: davet, e-posta doğrulama, şifre sıfırlama/belirleme, hesap dondurma, oturum iptali (7 gün), super_admin akışı, rate limit.
- KVKK: saklama süresi (retention) cron'ları, biyometrik imha, rıza; denetim logu bütünlüğü ve proje kapsamı.
- Alarm: kaynaklar, tekrar/debounce, e-posta hatası görünürlüğü.
- crons.ts genel: her işin sıklığı × tahmini fonksiyon çağrısı/ay (Convex Free 1M kota) tablosu; yorum satırına alınmış/ölü işler.
- AI sohbet (`openaiChat`/`getChatData`): veri maskeleme, proje kapsamı, secret yönetimi.
- Seed/debug/maintenance dosyaları public mi (üretimde açık kapı).

## İlişkiler (bölüm 4'te mutlaka işle)
Tüm modüller bu modülün yetki/proje/denetim altyapısını kullanır: M1/M2/M3/M5 için "hangi uç hangi sarmalayıcıyı kullanıyor,
tutarsız olan" tablosu; alarm ← M2 olayları; KVKK imha ↔ M1 biyometri + M2 cihazdaki şablonlar; e-posta raporları ← M3.

# Roller W-F1 — frontend altyapı + Ayarlar › Roller + kullanıcı/davet rol seçimi

## Hedef
(1) Ayarlar'da yeni "Roller" sekmesi: 5 rol × 13 yetki kutucuk matrisi, Yönetici sütunu kilitli (🔒, değiştirilemez), her rolde "Varsayılana dön", değişiklik `api.roles.setRolePermissions` ile kaydedilir. (2) Ayarlar › Kullanıcılar: aktif projedeki üyeler `api.roles.listProjectMembers` ile, her satırda proje rolü seçimi (`api.roles.setMemberRole`; son yönetici hatası toast'ta Türkçe). Davet formunda 5 rol seçeneği (`sendUserInviteEmail` `role` artık `ProjectRole` alır). (3) Ayarlar sekme görünürlüğü ve menü/rota görünürlüğü `usePermissions().can(...)` ile (karar 10).

## Ownership (yalnız bunlar + yeni dosyalar)
src/lib/capabilities.ts · src/lib/roleLabels.ts · src/lib/routeMeta.ts · src/pages/Settings.tsx · src/components/settings/SettingsSidebar.tsx · src/components/settings/sections/ReportsSettings.tsx · src/components/settings/sections/hooks/useGeneralSettings.ts · src/components/settings/sections/integrations/BridgeIntegrationCard.tsx · src/components/settings/sections/components/{HolidayCalendarManager,OvertimeSettingsForm,PdksRulesSettings}.tsx · src/components/settings/sections/reports/exportReport.ts · src/components/admin/** · src/components/auth/{AuthProvider,ProjectFilter}.tsx · src/services/authService.ts · src/contexts/ActiveProjectContext.tsx · src/hooks/{useProjectAccess,useActiveProjectScope,useNotificationSettings}.ts · src/components/layout/{AppHeader,AppSidebarNav,CommandPalette,ProjectSwitcher}.tsx · src/pages/{SystemAdmin,AuditLog,Profile}.tsx · src/components/profile/UserProjectsCard.tsx · src/pages/UserSetup.tsx · bu dosyaların mevcut testleri · YENİ: src/components/settings/sections/RolesSettings.tsx (+ alt bileşen/test dosyaları aynı klasörde)

## Tasarım
- Kaynak: `convex/lib/roleCatalog.ts` (`PROJECT_ROLES`, `PERMISSIONS`, `ROLE_LABELS`, `PERMISSION_LABELS`, `ROLE_DEFAULTS`). Etiketleri kopyalama, buradan içe aktar. `src/lib/roleLabels.ts` proje rolleri + "Süper Admin" için bu kataloğa dayansın.
- Hook: `src/hooks/usePermissions.ts` (hazır; `can(perm)`, `role`, `loading`). `capabilities(role)` kaldırılıp yerine hook'tan türeyen bir yardımcı gelebilir; ama BAŞKA worker'ın dosyaları (W-F2) hâlâ `isAdmin` / `capabilities` kullanabilir → `ActiveProjectContext.isAdmin` ve `capabilities` export'unu SİLME; içini "aktif projede admin.manage" anlamına çevirebilirsin (aynı imza).
- Görsel dil: mevcut Ayarlar bölümlerinin bileşenleri/sınıfları (ör. NotificationSettings/PrivacySettings) — yeni stil icat etme. Matris: satır = yetki (13, PERMISSIONS sırası), sütun = rol (5). Kaydet: kutucuk değişince anında ya da sütun başına "Kaydet" — biri; iyimser güncelleme + hata toast'ı. Açıklama metni: "Varsayılan yetkiler önerilir; ihtiyaca göre değiştirebilirsiniz."
- Sekme görünürlüğü (karar 10): genel/kullanıcılar/roller/gizlilik/bildirim → admin.manage; çalışma-bordro → schedule.manage; entegrasyon → devices.manage; rapor → reports.view; mail → super_admin.
- Rota/menü: Raporlar → reports.view; Kişiler → employees.view; Denetim kaydı → admin.manage; Sistem yönetimi → super_admin. Yetkisiz rotada mevcut "erişim yok" davranışı.
- Erişilebilirlik: kutucuklar `<input type=checkbox>`/Checkbox + görünür etiket, kilitli sütun `disabled` + aria açıklaması.

## Kapılar
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` 0 · `node_modules/.bin/eslint <dosyaların>` 0 error · `node_modules/.bin/vitest run src/components/settings src/components/admin src/pages src/lib src/hooks` yeşil · YENİ testler: RolesSettings (kilitli sütun disabled, kutucuk → setRolePermissions argümanı, Varsayılana dön → ROLE_DEFAULTS) ve kullanıcı rol seçimi.
Kabul grep'i: `grep -nE "project_admin|project_user" <ownership dosyaları (test hariç)>` → yalnız geri uyum/platform satırları (raporda gerekçeli).
Tarayıcı doğrulaması YOK (koordinatör yapacak).

Rapor yolu: `docs/roles/report-wf1.md`

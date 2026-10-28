# UI-audit-2 commit paketi (koordinatör ngsaccess-dd → CEO)

- `pure-paths.txt`: tam içerikle eklenecek yollar (M + ?? ; silme yok). docs/ui-audit-2/** + .claude/orca-specs/fix2-* dahil; bu klasör (ui-audit-2-commit) HARİÇ.
- `mixed-paths.txt` + `mixed/<yol>`: e9 (Hik-Connect kıyas) hunk'ları ÇIKARILMIŞ sürümler; `build_mixed.py` HEAD + seçili -U0 hunk'larından üretir (ağaç değişirse yeniden koş: `python3 -I .claude/ui-audit-2-commit/build_mixed.py`; assert hata verirse hunk numaraları kaymıştır, KEEP'i güncelle).
  - schema.ts: e9 = deviceEvents ack alanları + alarmNotifiedAt + by_project_category_event_time, alarmSettings, leaves.source, attendanceCorrections
  - api.d.ts: HEAD + yalnız lib/pdksAvailability, lib/pdksDay, lib/pdksWorkDay (e9 modülleri yok)
  - routeMeta.ts: e9 = BellRing import + /alarms satırı · Employees.tsx: e9 = İçe/Dışa aktar/Şablon · EmployeeBulkActions.tsx + EmployeeTable.tsx: e9 = Toplu kart ata / BatchCardAssignDialog
- HARİÇ (e9 / başkası): src/App.tsx, convex/deviceEvents.ts, themeBootstrap.ts(+test), index.html, navigationSearch.test.ts, src/pages/Alarms.tsx, convex/{alarms,employeeImport,leaveRequests,attendanceCorrections}*, convex/actions/sendAlarmEmail*, convex/lib/{alarmNotify,employeeImportValidation,requestRules,employeeCardChange}*, src/lib/employees/**, src/components/{alarms,employees/import}/**, docs/hikconnect-audit/**, docs/mobile-audit/**, docs/mobile-release/**, mobile/**, package.json/lock, convex/employeeAuth*, convex/lib/{employeeAuth,mobileErrors,rateLimit,mobileVisitors}.ts, convex/mobileVisitors.ts (mobil yayın oturumu; yeni dosya çıkarsa ekle), .claude/orca-specs/kiyas-*

Kurulum (main index'e dokunmadan):
```
export GIT_INDEX_FILE=/tmp/ua2-index; rm -f $GIT_INDEX_FILE; git read-tree HEAD
git add -- $(cat .claude/ui-audit-2-commit/pure-paths.txt)
for f in $(cat .claude/ui-audit-2-commit/mixed-paths.txt); do git update-index --cacheinfo 100644,$(git hash-object -w .claude/ui-audit-2-commit/mixed/$f),$f; done
git write-tree; unset GIT_INDEX_FILE
```
Kuru koşu (koordinatör, 2026-10-19 ~21:45, HEAD 53bd859): tree c6dc15ba → temiz worktree /tmp/ua2-verify: tsc 0 · eslint 0 · vitest 199 dosya / 2099 test yeşil · vite build OK. 363 dosya, +10330/−2429.

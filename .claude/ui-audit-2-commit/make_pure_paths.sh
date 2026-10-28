#!/bin/zsh
# pure-paths.txt'yi çalışma ağacından yeniden üretir (bizim tam-içerik yollar). Repo kökünden: zsh .claude/ui-audit-2-commit/make_pure_paths.sh
cd "$(git rev-parse --show-toplevel)"
C=.claude/ui-audit-2-commit
MIXED=$(cat $C/mixed-paths.txt)
git status --porcelain -uall | awk '{print $2}' | sort -u > /tmp/ua2-changed.txt
{
grep -vE '^(mobile/|docs/mobile-audit/|docs/mobile-release/|docs/hikconnect-audit/|\.claude/)' /tmp/ua2-changed.txt \
 | grep -vE '^(src/App\.tsx|convex/deviceEvents\.ts|src/lib/themeBootstrap(\.test)?\.ts|index\.html|src/components/layout/navigationSearch\.test\.ts|src/pages/Alarms\.tsx|convex/lib/employeeCardChange\.ts|package\.json|package-lock\.json|convex/employeeAuth(\.test|\.mobile\.test)?\.ts|convex/lib/(employeeAuth|mobileErrors|rateLimit|mobileVisitors)\.ts|convex/mobileVisitors(\.test)?\.ts|convex/actions/sendAlarmEmail(\.test)?\.ts)$' \
 | grep -vE '^convex/(alarms|employeeImport|leaveRequests|attendanceCorrections)(\.test)?\.ts$|^convex/lib/(alarmNotify|employeeImportValidation|requestRules)(\.test)?\.ts$|^src/lib/employees/|^src/components/(alarms|employees/import)/' \
 | grep -vxF -f <(echo "$MIXED")
grep -E '^\.claude/orca-specs/fix2-' /tmp/ua2-changed.txt
} > $C/pure-paths.txt
wc -l < $C/pure-paths.txt
# Yeni e9 dosyası çıktıysa (ör. yeni convex modülü) yukarıdaki HARİÇ listesine ekle: `comm -13 <eski liste> <yeni liste>` ile kontrol et.

# Denetim — Refaktör dalgası 2 (W4-W6, Codex yazdı)

Rol: SALT-OKUMA denetçi. Hiçbir dosyaya yazma (yalnız rapor dosyası). commit/push/deploy/DB/`npx convex` YOK.
Çalışma dizini /Users/emreaydin/ngsaccess (main; başka oturumların commit'siz convex/* işleri var — yalnız aşağıdaki dosyaları denetle).

Amaç: üç refaktörün SAF olduğunu (davranış birebir) kanıtla ya da sapmaları file:line ile göster.
Eski hâl: `git show HEAD:<dosya>`; yeni hâl: çalışma kopyası + yeni untracked dosyalar.

- W4 (BACKEND, en kritik): convex/actions/hikGatewayDevice.ts (1316→351) + YENİ convex/lib/gatewayCommand.ts, gatewayBackfill.ts, gatewayReconcile.ts(+test). Rapor /tmp/refaktor-w4-rapor.md
  Özel kontrol: 18 registered action'ın adı/args validator'ı/returns tipi/authedAction-internalAction türü aynı mı; yetki kontrolü (allowedProjectIds, cihazın projeye ait olması) taşınan gövdelerde aynı sırada mı ve hiçbir yolda atlanmıyor mu; audit kaydı (auditDeviceCommand) her komutta aynı mı; hata mesajları aynı mı; `convex/_generated` değişmemiş mi; lib dosyaları "use node" gerektiren import içeriyor mu ve bunlar yalnız node action'larından mı çağrılıyor (lib'i V8 runtime'daki bir query/mutation import ederse deploy kırılır — grep ile kontrol et).
- W5: src/components/access-control/unified/AccessRulesList.tsx + rules-list/** ; src/components/employees/EmployeeTable.tsx + employees/table/** . Rapor /tmp/refaktor-w5-rapor.md
- W6: src/components/shifts/ShiftCalendarView.tsx + shifts/calendar/** ; src/components/access-control/EditDoorDialog.tsx + access-control/door-dialog/** . Rapor /tmp/refaktor-w6-rapor.md
  Özel kontrol: useQuery argümanları ve "skip" koşulları aynı (yeni abonelik yok); EditDoorDialog kaydet akışında mutation/action çağrı SIRASI aynı.

Kontrol listesi (her worker): efekt bağımlılıkları; Convex çağrıları (aynı fonksiyon/argüman/sayı); UI metin/aria/className/disabled/Dialog open mantığı; export'lar ve importer'lar (grep); test assertion'ı değişmemiş; `any`/`as any`/`!` yok; ownership dışı yazım yok.

Kapılar (kendin koş):
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`
- `node_modules/.bin/eslint convex/actions/hikGatewayDevice.ts convex/lib/gatewayCommand.ts convex/lib/gatewayBackfill.ts convex/lib/gatewayReconcile.ts src/components/access-control src/components/employees src/components/shifts`
- `node_modules/.bin/vitest run convex/actions convex/lib src/components/access-control src/components/employees src/components/shifts`
- `node_modules/.bin/vite build`

Rapor: /tmp/refaktor-denetim-2.md — bulgu seviyesi (ENGEL/DÜZELT/NOT), file:line, eski vs yeni, önerilen düzeltme; worker başına "SAF / SAF DEĞİL" hükmü + kapı özetleri.
worker_done (≤10 satır): ENGEL/DÜZELT/NOT sayıları + hükümler + kapılar.

# R-B3 — Orphan erişim kapıları denetimi (Claude, salt-okuma)

**Özet:** Projesiz kaynakta yalnız super_admin kuralı 6 dosyada doğru uygulanmış; kontroller tüm DB/scheduler etkisinden önce, project_admin'e sızan istisna yok.
Ancak `accessRules.remove/removeGroupMember/removeGroupDevice` artık **silinmiş** kapı/cihaz/çalışana işaret eden sarkan (dangling) bağda super_admin dahil HERKESİ reddediyor; kod tabanı bu bağları rutin akışta üretiyor (kapı/panel silme kaskadı `groupDoors`'u temizlemiyor). Kural bir kez bu duruma düşünce UI'dan silinemez.
Canlıda şu an 0 sarkan bağ var (salt-okuma sayım) → sorun gizli ama ilk kapı/panel silmesinde tetiklenir.
**Yayına engel: VAR** — Y1 düzeltilmeden B3 yayınlanmamalı (düzeltme küçük: `null` ilişkiyi yetki kontrolünden muaf tut). Yayın 4 commit'lerine (`04023d3`,`7059078`,`1a0c112`) etkisi YOK; B3 commit'siz.

Diff kontrolü: `git diff` (6 dosya) = `/tmp/ceo-audit/b3.diff` birebir (`diff -q` → SAME).

## Bulgular
| Önem | dosya:satır | Senaryo | Öneri |
|---|---|---|---|
| **Yüksek** (Y1) | convex/accessRules.ts:764,770,775 · 1238,1245 · 1344,1350 | `doors.remove` (doors.ts:258-277) ve `purgeDeviceCascade`/`releaseDevice` (lib/deviceHelpers.ts:33-39, devices.ts:1015-1019) kapıyı siler ama `groupDoors` satırını silmez (mevcut `deleteStaleGroupDoors` accessRules.ts:43 `door===null`'ı zaten tolere ediyor). Yeni kod `!door \|\| …` / `!device \|\| …` koşulunu rol kontrolünden ÖNCE değerlendiriyor → super_admin dahil "Bu kapıya/cihaza erişim yetkiniz yok". Repro (`/tmp/ceo-audit/rb3/dangling.test.ts`, gerçek handler): remove + removeGroupMember, project_admin ve super_admin → 4/4 red, 0 silme. | Eksik kapı/cihaz → atla (`if (!door) continue;`), yalnız var olan kaydın projesini doğrula. Sarkan bağ silmede zaten temizlenir. |
| **Yüksek** (Y2) | convex/accessRules.ts:760,1223,1336 | `requireEmployeeAccess` çalışan yoksa "Çalışan bulunamadı" atar (lib/auth.ts:153) — super_admin için de. `employees.remove` groupMembers'ı `by_project_employee(emp.projectId)` ile siler (employees.ts:367-373); üyelik projesi çalışanın güncel projesinden farklıysa satır sarkar → kural silinemez. Repro: remove/emp super_admin → red. | Çalışan `null` ise atla; varsa `canAccessEmployeeProject` uygula. |
| Orta (O1) | convex/leaves.ts:257-258, 282-283 | `employees.update` projectId değiştirebiliyor (employees.ts:280) ama izinleri taşımıyor. Eski projede bekleyen izin → `employee.projectId !== leave.projectId` super_admin dahil herkese red; onay/red tamamen kilitli (B3 öncesi çalışıyordu). Canlıda izin 0 satır → bugün etkisiz. | Eşitlik şartını super_admin için gevşet ya da red (reject) yolunda kaldır; uzun vadede proje değişiminde izinleri taşı. |
| Orta (O2) | convex/accessRules.ts:760,1223 · convex/shifts.ts:321 | Proje değiştirmiş çalışanın eski projedeki üyelik/vardiya ataması: eski projenin project_admin'i bağı kaldıramaz (çalışan artık erişim dışı) → temizlik yalnız super_admin'de. Kabul edilebilir (fail-closed) ama UI'da açıklamasız hata. | Kabul; hata mesajı "çalışan başka projede" diye netleşebilir. |
| Düşük (D1) | convex/accessRules.ts:1213-1219 | `removeGroupMember` üye ve kural projesini ayrı ayrı doğruluyor ama `member.projectId === rule.projectId` eşitliğini (remove'da var, :755) aramıyor. Çok projeli admin için tutarsız bağ geçer; erişim zaten iki projeye de var → sızıntı yok. | Tutarlılık için eşitlik ekle (isteğe bağlı). |
| Düşük (D2) | convex/orphanGuards.test.ts:160-196 | Sarkan (silinmiş) ilişki testi yok; `accessRules.remove` pozitif testinde `groupDoors` yok. Y1/Y2 bu yüzden yakalanmadı. | Y1/Y2 düzeltmesiyle birlikte super_admin + project_admin "silinmiş kapı/cihaz/çalışan → silme başarılı" testi ekle. |

## Sorulara cevap
1. **Regresyon:** Evet — Y1/Y2 (herkes için kilit), O1 (proje değişimi sonrası izin kilidi). "Tüm bağları doğrula" tasarımı tek başına sorun değil: canlı veride 6 üye/1 cihaz/4 kapı bağının hepsi kuralla aynı projede, proje uyuşmazlığı 0. Sorun yalnız `null` ilişkinin "yetkisiz" sayılması. Yalnız kural projesine bakmak yetmez (cross-project bağla başka projenin panelinden kart söktürme açığı kalır); öneri: tüm bağlar + `null` muafiyeti.
   `getBalances`: dönüş şekli `[]` aynı (leaves.ts:317-319); değişen tek şey projesiz çalışanda super_admin dışına `[]` → UI şekli bozulmaz.
2. **Açık kalan:** Bulunmadı. Tüm istisnalar `ctx.user.role !== "super_admin"`; project_admin'e açılan dal yok. `isProjectAllowed(…, undefined)` → false (lib/auth.ts:126); projesiz dal ternary ile açıkça super_admin'e bağlı. shifts.ts `.some()` kullanımı projectId dolu dalda eşdeğer.
3. **Sıra:** Tüm kontroller ilk `ctx.db.delete`/`patch`/`scheduler.runAfter`/`reconcileRemovedEmployeeIde` öncesinde (accessRules.ts:745-777 → 779-781; 1216-1246 → 1252; 1323-1351 → 1357; shifts.ts:318-321 → 322; leaves.ts:250-259 → patch). `removeGroupDevice` üye sorgusu `by_project_group` → `by_group`'a taşındı; sync kümesi genişledi (orphan üyeler de sync'lenir) — doğru yönde.
4. **Testler:** Gerçek handler + gerçek `isProjectAllowed/canAccessEmployeeProject/requireEmployeeAccess`. Mock'lar: customFunctions sarmalayıcısı (adminMutation rol kapısı mock'ta yeniden üretilmiş, :15), `getProjectIdsForUser` (fixture userProjects ile tutarlı), accessGraph (yalnız sync). Mock'lar yetki kontrolünü atlamıyor; eksik yalnız D2.
5. **Kapılar (kendi koşum):** `vitest run convex/orphanGuards.test.ts convex/lib/shiftAssign.test.ts convex/lib/leaveValidation.test.ts` → 3 dosya / 337 test geçti, exit 0. `tsc --noEmit -p convex/tsconfig.json` → exit 0, çıktı 0 satır.

## Canlı salt-okuma sayım (convex data, yalnız sayı)
doors 14 · devices 5 · employees 7 · groupMembers 6 · groupDevices 1 · groupDoors 4 · accessRules 2 · leaves 0.
Sarkan bağ: groupDoors→kapı yok 0 · groupDevices→cihaz yok 0 · groupMembers→çalışan yok 0 · üye/çalışan proje uyuşmazlığı 0 · bağ/kural proje uyuşmazlığı 0 · projesiz kuralın bağı 0 (yani o kuralı super_admin sorunsuz silebilir).
Betik: `/tmp/ceo-audit/rb3/count.mjs` (PII basmaz).

# Faz B — B3 orphan mevcut kayıt erişimleri

## TAM değişen dosya listesi
- convex/leaves.ts
- convex/shifts.ts
- convex/departments.ts
- convex/positions.ts
- convex/companies.ts
- convex/accessRules.ts
- convex/orphanGuards.test.ts (yeni)
- .claude/orca-specs/reports/fazb-b3-orphan.md (bu rapor)

## Canlı salt okuma sayımı (2026-10-19)
Her tabloda `node_modules/.bin/convex data <tablo> --limit 2000 --format jsonl` çalıştırıldı; ham çıktı Python subprocess pipe içinde ayrıştırıldı, yalnız sayılar basıldı; PII/log/veri dosyası üretilmedi.
| Tablo (gerçek schema adı) | Okunan | projectId'siz |
|---|---:|---:|
| departments | 3 | 0 |
| positions | 0 | 0 |
| companies | 0 | 0 |
| shifts | 1 | 0 |
| shiftAssignments | 1 | 0 |
| leaves | 0 | 0 |
| accessRules | 2 | 1 |
| groupMembers | 6 | 0 |
| groupDevices | 1 | 0 |
Hiçbir tablo 2000 sınırına ulaşmadı; cardReadings canlı OKUNMADI; hiçbir canlı mutasyon/DB yazımı yapılmadı.

## Değişiklikler
- convex/leaves.ts:242,267 — approve/reject izin projesinde fail-closed; çalışan erişimi ve izin/çalışan proje eşitliği yazmadan önce doğrulanır; eşleşen orphan çiftine yalnız super_admin izinli.
- convex/leaves.ts:309 — getBalances yetkisiz/orphan çalışanda mevcut [] şeklini korur; super_admin orphan istisnası açık.
- convex/shifts.ts:312,442,470 — removeAssignment/update/remove orphan kaynakta yalnız super_admin; atama silmede bağlı çalışan erişimi de ilk silmeden önce kontrol edilir.
- convex/departments.ts:48,85; convex/positions.ts:39; convex/companies.ts:40,64 — hedef proje yoksa yalnız super_admin; proje varsa mevcut kapsam kontrolü korunur.
- convex/accessRules.ts:739 — remove bütün üyelik/cihaz/kapı bağlarını group index ile yükleyip child, employee, device/door erişimini silme ve sync öncesi doğrular; orphan child proje filtresinde kaybolmaz.
- convex/accessRules.ts:1210,1317 — removeGroupMember/removeGroupDevice child + parent + etkilenen employee/device/door projelerini ilk DB/scheduler etkisinden önce denetler.
- convex/orphanGuards.test.ts:1 — 273 yeni test: üç rol, orphan/kendi/başka proje, boş üyelik, bağlı kaynak ve eksik parent, kapı/panel yolu, yönetici pozitif ve sıfır yan etki kontrolleri.
- Dönüş şekilleri korunur; create yollarına ve ownership dışındaki üretim/test dosyalarına dokunulmadı.

## Kapılar (son koşu)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → exit 0.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → exit 0.
- `node_modules/.bin/eslint convex/{leaves,shifts,departments,positions,companies,accessRules}.ts convex/orphanGuards.test.ts` → exit 0, hata/uyarı yok.
- `node_modules/.bin/vitest run convex/orphanGuards.test.ts convex/lib/shiftAssign.test.ts convex/lib/leaveValidation.test.ts` → 3 dosya / 337 test geçti.
- `node_modules/.bin/vitest run` → 151 dosya / 1815 test geçti; exit 0.
- `git diff --check -- <altı üretim dosyası>` → exit 0. İlk tam koşudaki eski mock uyumsuzluğu üretim kapsam kontrolünü mevcut snapshot ile koruyarak giderildi; mevcut testler değiştirilmedi.

## Doğrulanan kapsam dışı / açık kalanlar
- Audit §2 kapanmış/yanlış pozitif listesi statik olarak doğrulandı: employee getById/remove/bulkRemove, device update/remove, attendance detail, access rule update/group-update/add, shift assign/updateAssignment/bulkRemoveAssignment kapıları mevcut.
- doors/readers zone yolları child proje filtresi uygular; PDKS/SGK legacy izinler yetkili employee eşleşmesine bağlı; reportScope boş proje yalnız izinli projeleri seçer. Bunlara dokunulmadı.
- Audit'teki create orphan üretimi, devices.reassignDevice havuz adı ve chatConversations.save veri kalitesi yolları kapsam dışı olarak devam eder; employees/visitors B1 kapsamındadır.
- Canlı bulunan 1 orphan accessRules kaydı taşınmadı/silinmedi; backfill ayrı karardır. Silme kontrolleri bozuk/yetkisiz ilişkide işlemi tamamen reddeder; önce veri onarımı gerekebilir.
- Yeni testler gerçek handler ve kapsam yardımcılarını bellek DB/scheduler spy ile çalıştırır; auth kayıt sarmalayıcıları ve cihaz sync yardımcıları mock'tur; canlı API mutasyonu yapılmadı.

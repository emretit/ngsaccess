# B3 — Projesiz (orphan) kayıtlarda değişiklik/okuma açıklarını kapat (mevcut kayıtlar üzerindeki işlemler)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/fazb-b3-orphan.md`
Önce oku: `.claude/orca-specs/reports/audit-1019-risk.md` §2 (tablo + "kapanmış/yanlış pozitif" listesi). Yardımcılar `convex/lib/auth.ts` (`requireEmployeeAccess`, `canAccessEmployeeProject`, `isProjectAllowed`, `getProjectIdsForUser`).

Kural: kaynağın `projectId`'si YOKSA işlem yalnız `super_admin`'e açık (açık istisna); varsa mevcut proje kontrolü aynen. Hata mesajları mevcut Türkçe kalıpla. Hata halinde hiçbir DB/scheduler etkisi olmamalı (kontrol yazmadan ÖNCE).
0. ÖNCE salt-okuma canlı sayım (yalnız sayı, PII basma; çıktıyı ekrana değil jq/node'a pipe et): `node_modules/.bin/convex data <tablo> --limit 2000 --format jsonl` ile `departments, positions, companies, shifts, shiftAssignments, leaves, accessRules, accessRuleMembers/accessRuleDevices (gerçek tablo adlarını convex/schema.ts'ten al)` için projectId'siz satır sayısı. `cardReadings` OKUMA (kota). Sonuçları rapora yaz.
1. `convex/leaves.ts` `approve`/`reject` (izin + çalışan projesi fail-closed) ve `getBalances` (yetkisizde mevcut boş şekil).
2. `convex/shifts.ts` `removeAssignment`, `update`, `remove`.
3. `convex/departments.ts` `update`/`remove` · `convex/positions.ts` `remove` · `convex/companies.ts` `update`/`remove`.
4. `convex/accessRules.ts` `remove`, `removeGroupMember`, `removeGroupDevice` (child + parent rule + employee/device projeleri birlikte; yan etkili silme/sync ÖNCE kontrol).
Ownership: `convex/{leaves,shifts,departments,positions,companies,accessRules}.ts` (yalnız yukarıdaki fonksiyonlar) + YENİ `convex/orphanGuards.test.ts` (ya da dosya başına mevcut test dosyaları).
Kapsam DIŞI (değiştirme, yalnız rapordaki listeyi doğrula): `create` yolları (orphan üretme — ayrı karar), `convex/employees.ts`, `convex/visitors.ts` (B1 worker'ı çalışıyor), `convex/devices.ts`, `zones.ts`, `doors.ts`, `chatConversations.ts`.
Testler: her fonksiyon için project_user + project_admin → orphan kaynakta RED ve yan etki yok; super_admin → orphan'da izinli; kendi projesindeki kaynakta mevcut davranış aynı; başka projede red.

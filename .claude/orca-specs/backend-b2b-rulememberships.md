# Backend B2b — personel ekranları için hafif kural sorgusu

Sorun: `api.accessRules.list` her kural için tüm üyeleri + her üyenin çalışan dokümanını (N+1 `ctx.db.get`) reaktif okur. Personel ekranlarındaki 4 tüketici bunun küçük bir kısmını kullanıyor:
- src/components/employees/EmployeeForm.tsx:49-54
- src/components/employees/hooks/useEmployeeFormData.ts:90-110
- src/components/employees/EmployeeSyncConfirmDialog.tsx:8-24 (`syncTargetCount`: isActive, groupMembers[].employeeId, groupDevices[].deviceId)
- src/components/employees/EmployeeDetails.tsx:152-177 (_id, name, isActive, groupMembers[].employeeId)

Hedef: aynı yetki kapsamıyla yalnız gereken alanları dönen yeni bir sorgu eklenir, 4 tüketici ona geçer; ekranlarda görünen sonuç birebir aynı, okunan doküman sayısı düşer.

Yapılacak:
1. 4 tüketicinin kullandığı alanların BİRLEŞİMİNİ çıkar (useEmployeeFormData.ts:109 civarını da oku). Rapora tablo olarak yaz.
2. `convex/accessRules.ts`'e YENİ `listMemberships` (authedQuery, args `{ projectId: v.optional(v.id("projects")) }`) ekle; gövde `convex/lib/accessRuleRead.ts`'e yeni export olarak. İlk adım `resolveProjectScope(ctx, args.projectId)` — `list` ile AYNI kapsam/rol davranışı. Çalışan dokümanı okuma (N+1 get) YOK; yalnız accessRules + groupMembers + groupDevices (list ile aynı index'ler). Dönüş tipi tüketicilerin ihtiyacı kadar.
3. Mevcut `list`'i DEĞİŞTİRME/SİLME (başka tüketici/mobil olabilir).
4. 4 tüketiciyi `listMemberships`'e geçir; `FunctionReturnType<typeof api.accessRules.listMemberships>` ile tiple; "skip" koşulları aynı.
5. Test: YENİ `convex/accessRuleMemberships.test.ts` (convex-test) — proje kapsamı (başka projenin kuralı dönmez, project_user/admin/super_admin davranışı list ile aynı), dönüş şekli, list ile aynı kural/üye/cihaz kümesi. Frontend testleri (EmployeeSyncConfirmDialog, EmployeeDetails, EmployeeForm) değişmeden yeşil; mock'lar `api.accessRules.list`'e bağlıysa YALNIZ mock hedefini güncelle (assertion değişmez).

Not: `api.d.ts` mevcut modül export'larını `typeof` ile aldığı için codegen GEREKMEZ — `npx convex` KOŞMA. Rapora "web yayınından ÖNCE Convex deploy şart (yeni sorgu)" notunu yaz.

Ownership:
- convex/accessRules.ts (YALNIZ yeni listMemberships ekle + import), convex/lib/accessRuleRead.ts (yalnız yeni export ekle)
- YENİ convex/accessRuleMemberships.test.ts
- src/components/employees/EmployeeForm.tsx, hooks/useEmployeeFormData.ts, EmployeeSyncConfirmDialog.tsx, EmployeeDetails.tsx (+ ilgili test dosyalarında yalnız mock hedefi)
- DOKUNMA: convex/cardReadings.ts (B3 worker'ının), devices/schema/http vb. başka oturum dosyaları

Bu iş SAF refaktör DEĞİL (yeni sorgu eklenir) ama görünen davranış birebir kalmalı.
Vitest: `node_modules/.bin/vitest run convex/accessRuleMemberships.test.ts convex/lib/accessRule src/components/employees`
Rapor yolu: /tmp/backend-b2b-rapor.md

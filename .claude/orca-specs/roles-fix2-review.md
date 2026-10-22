# Roller FIX-2 denetimi (salt okuma, Codex)

## Hedef
`/tmp/roles-fix2.patch` (208 satır; Claude yazdı) `docs/roles/AUDIT-FIX1.md` bulgularını (F1-O1, F1-D1, F1-D2, F1-D3) doğru ve yan etkisiz kapatıyor mu — cevap + bulgular `docs/roles/REVIEW-FIX2.md`'ye.

## Bağlam
- `docs/roles/PLAN.md` (5 rol × 13 yetki, "her projede en az bir admin" kuralı), `docs/roles/AUDIT-FIX1.md` (bulgular ve önerilen düzeltmeler).
- Değişen: `convex/users.ts` (`removesLastProjectAdmin`, `syncMembershipRoles`, updateRole/deleteUser/setRoleByEmail/adminDeleteByEmail), `convex/employees.ts` (update: proje taşımada kaynak pay.view), testler `convex/roles.fix1.test.ts`, `convex/accountAccess.test.ts` (müşteri yöneticisi fixture'ı kaldırıldı).
- `convex/lib/permissions.ts` `hasOtherActiveAdmin` super_admin'i saymaz.

## Sorular
1. super_admin hedefte son-yönetici kontrolünü atlamak bir açık yaratıyor mu? (ör. super_admin olmayan son müşteri yöneticisinin silinmesi/düşürülmesi bir yoldan hâlâ mümkün mü; `roles.setMemberRole`/`removeMember` yolları)
2. `syncMembershipRoles` davranışı updateRole ve setRoleByEmail'de eskisiyle (terfi: rolsüzleri sabitle) birebir mi; düşürmede tüm üyelikler doğru yazılıyor mu; `projectIds` ile kaldırılan satırlar atlanıyor mu?
3. F1-D1: taşıma kontrolü (`updates.projectId !== emp.projectId` + kayıtlı ücret) ücret okuma yan yolunu kapatıyor mu; projesiz (orphan) çalışan veya aynı projeye "taşıma" kenar durumları kırılıyor mu?
4. Test değişiklikleri amaçlı mı, gevşetme var mı? (`roles.fix1.test.ts` "O-1 demotion cannot leave…" testi F1-O1 gereği tersine çevrildi)

## Kısıtlar
Salt okuma: kaynak dosya DEĞİŞTİRME (yalnız `docs/roles/REVIEW-FIX2.md` yazılır). Test koşmak serbest (`node_modules/.bin/vitest run <dosya>`). `npx convex`/codegen/deploy/DB yazma/commit/push YOK.

## Rapor
`docs/roles/REVIEW-FIX2.md`: 1-2 cümle sonuç, sonra bulgular (Kritik/Yüksek/Orta/Düşük, file:line + senaryo), 4 soruya birer satır. worker_done ≤10 satır, Türkçe.

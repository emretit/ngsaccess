# C3-admin: Kullanıcı üyeliği yarış kontrolü + Genel ayarlarda kısmi kayıt
ÖNCE `.claude/orca-specs/c3-common.md` oku. Bağlam: `.claude/orca-specs/reports/review-c2c-frontend.md` bulgu #9 ve #10, `reports/c2c-12-api.md`.

## Hedef (test edilebilir)
1. **#9** `convex/users.ts:62` `updateRole` OPSİYONEL `expectedProjectIds: v.optional(v.array(v.id("projects")))` alır; verilmişse sunucudaki canlı
   üyelik kümesi (sırasız) farklıysa hiçbir şey yazmadan `ConvexError({ code: "MEMBERSHIP_CHANGED", message: "Kullanıcının proje üyelikleri başka bir oturumda değişti. Formu kapatıp yeniden açın." })`.
   Verilmezse davranış aynen. `src/components/admin/components/UserFormDialog.tsx` (+ gerekiyorsa `hooks/useUserManagement.ts`) form açılışındaki
   üyelik snapshot'ını gönderir; hata formda kalır, form kapanmaz. Saf karşılaştırma `convex/lib/adminGuards.ts`'e + test.
2. **#10** Genel ayarlar yalnız DEĞİŞEN alanları yazar: `src/components/settings/sections/general/generalForm.ts` (+ `hooks/useGeneralSettings.ts`)
   payload'ı dirty alanlarla sınırlar; `convex/settings.ts:44` `upsertGeneral` eksik alanı "değişmedi", `null`'ı "temizle" sayar (şu an böyle değilse
   opsiyonel arg semantiğini GERİYE UYUMLU kur: eski istemci tüm alanları gönderiyor, sonuç aynı kalmalı). Başka oturumda değişen ve bu formda
   dokunulmamış alan ezilmez — saf test.

## Ownership
`convex/users.ts` (yalnız updateRole) · `convex/lib/adminGuards.ts` (+test) · `convex/settings.ts` (yalnız upsertGeneral) · `convex/adminSettingsGuards.test.ts` ·
`src/components/admin/components/UserFormDialog.tsx` · `src/components/admin/hooks/useUserManagement.ts` ·
`src/components/settings/sections/general/**` · `src/components/settings/sections/hooks/useGeneralSettings.ts` · `src/components/settings/settings.test.tsx`.

## Kapsam dışı
Diğer ayar bölümleri, Admin listeleri, rol modelinin kendisi.

## Rapor
`.claude/orca-specs/reports/c3-admin.md` + koordinatör akışları: iki sekmede aynı kullanıcı (birinde proje ekle, diğerinde kaydet → MEMBERSHIP_CHANGED);
Genel ayarlarda yalnız telefon değiştir → diğer alanlar dokunulmadan kalır.

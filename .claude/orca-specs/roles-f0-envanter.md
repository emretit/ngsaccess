# Roller Faz 0 — yetki kontrolü envanteri (SALT OKUMA)

## Hedef
`docs/roles/INVENTORY.md` dosyasında ngsplus'taki HER yetki/rol kontrol noktası, önerilen yeni yetki anahtarıyla eşlenmiş olarak listelenir. Tasarım: `docs/roles/PLAN.md` (önce bunu oku; 5 rol, 13 yetki anahtarı, kurallar orada).

## Kapsam
- `convex/**/*.ts` (HARİÇ: `convex/_generated/**`, `*.test.ts`)
- `src/**/*.{ts,tsx}` (HARİÇ: `*.test.*`)
- Aranacak desenler (en az): `adminMutation`, `adminQuery`, `superAdminMutation`, `superAdminQuery`, `requireAdmin`, `requireSuperAdmin`, `isManager(`, `role === "…"` / `role !== "…"` (super_admin|project_admin|project_user), `capabilities(`, `isAdmin`, `isSuperAdmin`, `profile?.role`, `requiredRole`, `canAccessEmployeeProject`, `requireAccountAccessTarget`.
- Ayrıca: `authedMutation`/`authedAction` ile tanımlı ve VERİ YAZAN ama rol kontrolü YAPMAYAN fonksiyonları "rol kontrolü yok" diye işaretle (ör. `convex/shifts.ts` create/update/remove, `convex/departments.ts`). Bunlar da bir yetki anahtarına bağlanacak.

## Her satır için
`dosya:satır` · kayıtlı fonksiyon adı (export) veya bileşen · tür (query/mutation/action/internal/UI) · mevcut kapı (ör. adminMutation, isManager ile sır gizleme, role===super_admin) · ne yapıyor (≤8 kelime) · **önerilen anahtar** (PLAN.md'deki 13'ten biri, ya da `super_admin` = platform yalnız, ya da `üye` = projenin her üyesi) · projectId kaynağı (`arg` / `doc.projectId` / `getProjectIdsForUser listesi` / `yok`) · not (belirsizlik, bug şüphesi).

## Biçim
- Dosya başına bir tablo; dosyalar `convex/` sonra `src/` alfabetik.
- En üstte özet: anahtar başına satır sayısı; "karar gerekiyor" listesi (birden fazla anahtara uyan ya da PLAN.md'nin kapsamadığı yerler, en fazla 15 madde, her biri tek satır + önerin).
- Başka oturumun commit'siz dosyaları (şu an: `convex/accessRules.ts`, `convex/cardReadings.ts`, `convex/employeeBiometrics.ts`, `convex/lib/accessRuleRead.ts`, `src/components/employees/**`) satırlarında `[SAHİPLİ]` etiketi; yine de envantere dahil et.

## Kısıtlar
- YALNIZ `docs/roles/INVENTORY.md` yazılır. Kod dosyalarına, şemaya, testlere dokunma.
- `npx convex ...` / codegen / deploy / DB yazma / commit / push YOK.
- Tahmin yerine kodu oku: anahtar önerisini fonksiyonun gerçekte ne yaptığına göre ver.

## Kabul
- `docs/roles/INVENTORY.md` var; şu komutun bulduğu her dosya envanterde geçiyor:
  `grep -rlE "adminMutation|adminQuery|superAdminMutation|superAdminQuery|requireAdmin|requireSuperAdmin|isManager\(|project_admin|project_user|super_admin" convex src --include=*.ts --include=*.tsx | grep -v _generated | grep -v "\.test\."`
- Rapor (worker_done, ≤10 satır): toplam satır, anahtar başına sayı, "karar gerekiyor" madde sayısı, rapor yolu.

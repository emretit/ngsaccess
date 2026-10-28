# Dalga 2 / W3 — FormFieldWrapper geçişi + MasterDetailListLayout (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga2-ortak.md
Rapor bölümleri: ortak-bilesen-B.md §B03 (FormFieldWrapper; AssignLocationForm HARİÇ, o W2'de), ortak-bilesen-A.md §2 (MasterDetailListLayout).

## Hedef (test edilebilir)
1. FormFieldWrapper (src/components/shared/FormFieldWrapper.tsx; Select gibi iç kontroller için render-slot):
   - EmployeeFormFields.tsx:~84 (yerel describedBy/alan renderer'ı; FieldError zaten kullanılıyor — tam wrapper'a geç)
   - ClaimDeviceDialog.tsx:~178 ve devamındaki alanlar (manuel hatalar ~196/~234/~254/~264)
   - ProfileForm.tsx:~72 (ad soyad; manuel hata ~86)
   - RuleBasicInfo.tsx:~24 (ad, açıklama)
   Hata metni görünümü shared bileşeninkine döner (bilinçli birleştirme). Alan id/name, ref, RHF register/Controller ve zod bağları korunur;
   react-hook-form `name=` değerlerine dokunma.
2. Yeni `src/components/shared/MasterDetailListLayout.tsx`: `{ sidebar?: ReactNode; children: ReactNode; className?: string }`.
   Dış: `flex min-w-0 flex-col gap-4 min-[1100px]:flex-row min-[1100px]:gap-5`; sağ: `min-w-0 flex-1 space-y-4` (bugünkü sağ sütun sınıfı
   farklıysa her çağıranın gerçek sınıfını karşılaştır, ortak olanı al, farkı className ile koru).
   Kullan: Employees.tsx:~171/~177, DevicesContent.tsx:~83/~85, PDKSRecords.tsx:~116/~122 (ShiftTree sarmalayıcısının genişliği korunur).
   Bilinçli birleştirme: Kişiler mobil boşluk gap-6 → gap-4 (diğer ikisiyle aynı).
3. `src/components/shared/MasterDetailListLayout.test.tsx`: sidebar varken/yokken markup ve sınıflar.

## Ownership (yalnız bunlara yaz)
- src/components/employees/EmployeeFormFields.tsx
- src/components/devices/ClaimDeviceDialog.tsx
- src/components/profile/ProfileForm.tsx
- src/components/access-control/unified/components/RuleBasicInfo.tsx
- src/components/shared/MasterDetailListLayout.tsx (yeni) + .test.tsx (yeni)
- src/pages/Employees.tsx, src/components/devices/DevicesContent.tsx, src/pages/PDKSRecords.tsx
- + bu bileşenlerin adını taşıyan test dosyaları (ör. EmployeeFormFields.test.tsx)

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/employees src/components/devices src/components/profile src/components/access-control/unified/components src/components/shared src/pages`
- `node_modules/.bin/vitest run src/components/employees src/components/devices src/components/profile src/components/access-control src/components/shared src/pages`

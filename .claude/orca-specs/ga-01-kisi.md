## Görev: Kişi & Organizasyon modülü audit'i
- Rapor dosyası: `docs/genel-audit-2026-11-03/01-kisi-organizasyon.md` · Bulgu ID öneki: `KIS-`
- Kapsam (backend): `convex/employees.ts`, `departments.ts`, `companies.ts`, `positions.ts`, `employeeImport.ts`, `employeeTermination.ts`, `employeeBiometrics.ts`, `employeeFaces.ts`, `employeeFingerprints.ts`, `fingerprintEnrollment.ts`, `peopleActivity.ts`, `convex/lib/employee*`, ilgili `convex/lib/*` yardımcıları. Cihazdan kişi çekme (`hikDeviceImport.ts`) yalnız kişi verisine etkisi açısından; cihaz protokolü 05 numaralı worker'da.
- Kapsam (web): `src/pages/Employees.tsx`, `EngineeringDepartment.tsx`, `src/components/employees/**`, `src/components/departments/**`.
- Hik kıyası: `KIYAS.md` §4 Kişi (Person) + `HIKCONNECT_SAYFALAR.md` Person alt paneli (kişi listesi, departman ağacı, toplu içe/dışa aktarma, kart, ID kuralı, ayrılma, kimlik bilgileri).
- Özel dikkat: kart değişince/kişi silinince/ayrılınca cihazdaki yetki ne oluyor (genel-akış audit Faz 2.1, 2.3), şirket→departman ağacında proje izolasyonu, toplu içe aktarmada projeler arası kart çakışması (Faz 1.5), biyometrik veri silme/saklama ile kişi silme ilişkisi.

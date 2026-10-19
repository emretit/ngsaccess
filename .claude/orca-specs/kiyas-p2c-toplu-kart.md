# P2c — Kişiler: Toplu kart atama arayüzü

Backend HAZIR ve testli: `api.employeeImport.assignCards({ assignments: [{ employeeId, cardNumber }] })` (≤200, proje kapsamı + çakışma kontrolü, özet audit) → `{ employeeId, status: "assigned" | "error", message }[]`. Excel içe/dışa aktarma arayüzü P2b ile bitti (`src/components/employees/import/EmployeeImportDialog.tsx`, `src/pages/Employees.tsx` içindeki giriş noktaları). Gereksinim: `.claude/orca-specs/kiyas-p2-kisi-import.md` → "Toplu kart ataması".

## Ownership
`src/components/employees/import/BatchCardAssignDialog.tsx` (YENİ) + `BatchCardAssignDialog.test.tsx` (YENİ), `src/lib/employees/cardAssignment.ts` (+test; saf mantık), `src/components/employees/EmployeeBulkActions.tsx` ve `src/pages/Employees.tsx` (YALNIZ ekleme: yeni import, yeni düğme/diyalog). YAZMA: `convex/**`, schema, App.tsx, routeMeta.

## UYARI
`Employees.tsx` ve `src/components/employees/**` içinde UI audit koordinatörünün commit'siz değişiklikleri var: mevcut satırları yeniden düzenleme/biçimlendirme; yalnız ekle. Aktif işlerin kalıbı: P2b'nin `EmployeeImportDialog` entegrasyonuna bak ve aynı biçimde ekle.

## İş
1. Araç çubuğunda seçili kişiler varken "Toplu kart ata" (yalnız admin; `isAdmin && projectId` kalıbı). Seçili kişilerden kartı OLMAYANLARI listele; hepsinin kartı varsa bilgi mesajı.
2. İki giriş modu: (a) satır başına elle kart no (yapıştırma desteği: satır satır yapıştırınca sıradaki boş satırlardan başlayıp doldur); (b) okuyucu seçimi + "Okut" modu: Ziyaretçiler'in `cardReadings.getLastUnknownByDevice` kullanımına bak (`src/components/visitors/**`); reaktif `useQuery` ile yeni gelen TANINMAYAN kartı sıradaki boş satıra yaz (polling/setInterval YOK, Convex kota). Aynı kart iki satıra yazılamaz (saf mantık `cardAssignment.ts`: yinelenen/boş/biçim kontrolü, sıradaki boş satır seçimi).
3. "Kaydet" → `assignCards` (≤200'lük parçalar); sonuç tablosu (atandı/hata mesajı); hatalı satırlar düzenlenebilir kalır. Bittiğinde "Cihazlara gönder": P2b'nin Excel içe aktarma sonucundaki senkron çağrısını nasıl yaptığına bak ve AYNISINI kullan.
4. KVKK: kart numaralarını `console.log`'lama.

## Testler
`cardAssignment.ts` (yapıştırma dağıtımı, yinelenen kart, sıradaki boş satır, biçim), diyalog akışı (elle giriş → kaydet → sonuç; hatalı satır kalır; okut modunda yeni kart sıradaki satıra düşer).

Kapı: kendi dosyalarında tsc 0, eslint 0, vitest yeşil. Testler yeşil olmadan `worker_done` gönderme. Test deseni: bu repoda convex-test YOK; bileşen testleri için `src/components/employees/**/*.test.tsx` örneklerine bak.

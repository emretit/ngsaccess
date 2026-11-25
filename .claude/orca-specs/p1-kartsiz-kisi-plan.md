# P1-2 — Kartsız kişi

- Mevcut: form şeması kartı zorunlu tutuyor (`useEmployeeFormSchema.ts:15`), alan HTML required (`EmployeeFormFields.tsx:110`).
- Sunucu ortak doğrulaması da boş kartı reddediyor (`convex/lib/employeeUx.ts:21`).
- Toplu atama zaten seçili kartsız kişileri alıyor (`BatchCardAssignDialog.tsx:18`) ve kart değişimi yolunu çağırıyor (`convex/employeeImport.ts:165`).
- Hik kişinin cihaz kimliğini karttan alır; boş kartta gönderimi keser (`convex/lib/hikSyncEmployee.ts:131`), IDE sayısal pozitif kart ister (`ideGatewayDevice.ts:134`).
- Güvenli tercih: yeni kartsız kişi cihaza gönderilmez; kart atanınca mevcut iki marka senkronu çalışır.
- İlk kart atamasında boş eski kimlik için silme/parmak izi temizliği kuyruğu üretilmeyecek (`employeeCardChange.ts:17`).
- Şema değişikliği yok: boş string mevcut schema ile uyumlu; migration/deploy yok.
- Değişecek sahip olunan dosyalar: form şeması + test, EmployeeFormFields + test, employees.ts + test, employeeCardChange.ts + test, BatchCardAssignDialog + test.
- Koordinatör onayı alındı: `src/components/employees/table/EmployeeTableRow.tsx` + ilgili test, `convex/lib/employeeUx.ts` + test, `src/components/employees/hooks/useEmployeeFormSubmit.ts` + testler.
- Kartı olan kişiden kart kaldırma bu işin kapsamı dışında kalacak; mevcut güvenlik doğrulaması korunacak.
- Testler: kartsız/boşluklu kayıt, çoklu kartsız kayıt, ilk kartta iki senkron ve sıfır delete/purge, mevcut kart değişimi temizliği, kartlı→boş reddi, form required/rozet, toplu seçim ve atama.
- Kapılar: tsc app, değişen dosyalarda eslint, hedefli vitest, find-node-leak.
- Ortak gönderim kararı `convex/lib/employeeUx.ts:27` içinde; bağımsız biyometri cihaz kimliği parametresini destekler.
- Açık entegrasyon: P1-3 kartsız yüz için bağımsız employeeNo sağladığında helper'a iletilmeli ve Hik adaptöründeki mevcut boş-kart bariyeri uyarlanmalı (`convex/lib/hikSyncEmployee.ts:131`); bu worker o dosyaları değiştirmedi.
- Toplu atamada başarılı satırlar yeniden denenmez; yalnız hatalı/doldurulan satırlar gider.

## Sonuç
- Kişi kartsız kaydedilir, listede Kartsız rozetiyle görünür ve seçilip Toplu kart ata ile kartlandırılır; ilk atamada eski boş kimlik silinmez.
- Backend: `convex/employees.ts`, `convex/lib/employeeCardChange.ts`, `convex/lib/employeeUx.ts`; test: `convex/employees.cardless.test.ts`, `convex/lib/employeeUx.test.ts`.
- UI: `EmployeeFormFields.tsx`, `hooks/useEmployeeFormSchema.ts`, `hooks/useEmployeeFormSubmit.ts`, `table/EmployeeTableRow.tsx`, `import/BatchCardAssignDialog.tsx`; ilgili şema, form alanları, submit roles, tablo testleri ve yeni `import/BatchCardAssignDialog.save.test.tsx`.
- Bu işte şema değişikliği, migration, DB/cihaz komutu ve commit yok.
- Kapılar: vitest 10 dosya / 123 test geçti; eslint 15 TS/TSX dosyası / 0 hata; find-node-leak çıkış 0; diff --check çıkış 0.
- App tsc koordinatöre devredildi; çalışan yerel kontrol koordinatör talimatıyla durduruldu (130).
- Açık entegrasyon: bağımsız biyometri kimliği `convex/lib/employeeUx.ts:27` yardımcısına iletilmeli; mevcut kart tabanlı Hik kimliği `convex/lib/hikSyncEmployee.ts:131` P1-3 tarafında ele alınmalı.

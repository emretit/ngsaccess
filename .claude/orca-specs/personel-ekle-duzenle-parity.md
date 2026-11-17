# Personel ekle ↔ Personel düzenle parity denetimi (SALT OKUMA)

## Hedef
/employees sayfasındaki "Personel ekle" ve "Personel düzenle" akışlarını (SlideOverPanel içinde) kod düzeyinde
karşılaştır; ikisinin aynı ya da çok benzer olması gerekiyor. Her farkı file:line kanıtıyla listeleyen bir
parity raporu yaz.

## Giriş noktaları
- src/pages/Employees.tsx (SlideOverPanel kullanımı, ~satır 261-276; editingEmployee / onContinue / onSave)
- src/components/employees/SlideOverPanel.tsx (başlık: "Personel ekle" / "Personel düzenle"; employee null ise ekle,
  doluysa EmployeeDetails + EmployeeForm)
- src/components/employees/EmployeeForm.tsx, EmployeeFormFields.tsx, EmployeeDetails.tsx
- src/components/employees/hooks/useEmployeeFormData.ts, useEmployeeFormSchema.ts, useEmployeeFormSubmit.ts
- src/components/shared/FormDialog.tsx ve form içinde kullanılan diğer bileşenler (gerekirse takip et)
- Backend: submit hook'unun çağırdığı convex mutation'ları (create vs update) — arg/validasyon farkı için oku
Not: bu dosyaların bir kısmında commit'lenmemiş değişiklik var (git status). Çalışma ağacındaki GÜNCEL hali denetle,
ayrıca `git diff` ile commit'siz farkı rapora ayrı not düş.

## Karşılaştırma eksenleri (her biri için: Ekle / Düzenle / Fark / Önem)
1. Alanlar: hangi alan hangi modda görünüyor/gizli/disabled, sıra, bölüm/başlık gruplaması, etiket ve placeholder metinleri
2. Validasyon: zod schema farkları, zorunlu (*) işaretleri, hata mesajları, client vs backend (convex create/update args) tutarlılığı
3. Varsayılan değerler ve doldurma: yeni kayıtta default'lar vs düzenlemede employee'den mapping; eksik/yanlış map edilen alan
4. Düzen/UI: layout, kart/sekme yapısı, düğmeler (Kaydet/İptal/Devam et), yükleme ve hata durumları, toast metinleri,
   panel genişliği/scroll (SlideOverPanel'de ekle modu overflow-hidden, düzenle overflow-y-auto)
5. Davranış: kaydet sonrası akış (ekle → onContinue ile düzenlemeye geçiş?), draft saklama, kirli form uyarısı,
   cihaz senkron onayı, yetki (canManage) farkları, okuma modu
6. Yalnız bir modda olan özellikler (ör. EmployeeDetails, parmak izi, onaylar, erişim kartları): bilinçli mi, eksik mi?

## Önem seviyeleri
- Y (yüksek): veri kaybı/yanlış kayıt, bir modda girilen alan diğerinde düzenlenemiyor, validasyon tutarsızlığı
- O (orta): görünür UX farkı (etiket, sıra, zorunluluk işareti, düğme metni)
- D (düşük): kozmetik

## Çıktı
- Raporu YAZ: docs/employee-form-parity/RAPOR.md (Türkçe). Yapı: 1-2 cümle özet · fark tablosu (eksen, alan, Ekle,
  Düzenle, önem, file:line) · "bilinçli olabilecek farklar" bölümü · önerilen eşitleme adımları (öncelik sırasıyla, ≤10 madde).
- Ownership: YALNIZ docs/employee-form-parity/RAPOR.md. Başka hiçbir dosyayı değiştirme.

## Kapsam dışı
- Kod düzeltmesi YAPMA (yalnız rapor). Mobil (mobile/) kapsam dışı. EmployeeSetup.tsx (/employee-setup davet akışı) kapsam dışı,
  yalnız alan seti çok farklıysa tek satır not düş.

## Yasaklar
- git add / git commit / git stash / git checkout / push / deploy / migration / DB yazma YOK. `npx convex` komutu çalıştırma.
- Supabase MCP veya herhangi bir canlı DB aracı KULLANMA.

## Kapılar
- `test -s docs/employee-form-parity/RAPOR.md`
- `git status --porcelain | grep -v '^??'` çıktısı başlangıçtakiyle aynı olmalı (hiçbir izlenen dosya değişmemeli)

## Rapor
worker_done'da ≤10 satır: Y/O/D sayıları, en kritik 3 fark (file:line), rapor yolu.

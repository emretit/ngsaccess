# C2c W-api-fix — backend denetim bulgularının düzeltilmesi (10 izinler + 12 projeler)
Önce `.claude/orca-specs/c2c-common.md` (→ c2-common.md), `convex/_generated/ai/guidelines.md` ve denetim raporu
`.claude/orca-specs/reports/review-c2c-backend.md` oku. Sözleşme raporları: `reports/c2c-10-api.md`, `reports/c2c-12-api.md`.
Frontend worker'ları paralel çalışıyor ve bu sözleşmeleri tüketiyor: imza/dönüş alanlarını yalnız aşağıda yazılan kadar değiştir.

## Düzelt
1. **(Orta 4) `leaves.update` eski veride kilitlenmesin:** tarih doğrulaması (`validateLeaveRange`) ve örtüşme kontrolü YALNIZ
   `startDate` veya `endDate` arg'ı verilip mevcut değerden farklıysa çalışsın. Yalnız `notes`/`leaveType` düzenlemesi 366+ gün,
   geçersiz tarihli veya çakışan legacy kayıtta da başarılı olur. Test: üç legacy durum × yalnız-not düzenleme = başarı; tarih değişince doğrulama.
2. **(Orta 5) `leaves.listForRange` taşma eşiği proje başına:** 5000 aday sınırı tüm projeler toplamı yerine her proje için ayrı uygulansın
   (super_admin "tüm projeler" görünümü gereksiz düşmesin). Dönüş şekli `Doc<"leaves">[]` aynı kalır. Test ekle.
3. **(Orta 1) `projects.adminList` heartbeat invalidasyonu:** `deviceCount` + `deviceCountCapped` alanlarını ve `devices` okumasını KALDIR
   (her cihaz heartbeat'i reaktif sorguyu yeniden çalıştırıyor; 12-ui'ye haber verildi, kolonu kaldırıyor). `memberCount` kalır.
   Sayfa boyutunu (numItems) en fazla 25 ile sınırla. Rapor `reports/c2c-12-api.md`'deki dönüş tipini güncelle.
4. **(Düşük) `leaves.listPage` notes maskesi:** admin olmayan (project_user) çağırana `notes` dönmesin (sağlık bilgisi içerebilir — KVKK);
   alan `notes?: undefined` + `notesHidden: boolean` gibi açık bayrakla. Eski `list`/`listForRange` DEĞİŞMEZ (eski frontend).
5. **(Düşük) `leaves.approve` örtüşme:** legacy pending kaydı onaylarken aynı `assertNoLeaveOverlap` (kendini hariç tut) çalışsın.

## Ownership
convex/leaves.ts · convex/lib/leaveValidation.ts (+test) · convex/projects.ts · convex/lib/adminLists.ts (+test) ·
.claude/orca-specs/reports/c2c-10-api.md ve c2c-12-api.md (yalnız değişen sözleşme satırları) · convex/_generated/api.d.ts (gerekirse)

## Kapsam dışı
src/** · auditLog (actorOptions yükü frontend'de `skip` ile çözülecek) · adminDevices idePassword (mevcut `list` ile aynı; ayrı iş) · schema.ts (ask).

## Kapılar
convex tsc 0 · `node_modules/.bin/eslint convex` 0 · `npx vitest run convex` yeşil. worker_done ≤8 satır (file:line + kapı sonucu).

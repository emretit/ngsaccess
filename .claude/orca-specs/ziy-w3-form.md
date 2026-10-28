# W3 — Ziyaretçi formu (Z-Y1 arayüz, Z-O7, Z-D2, Z-D5)

## Hedef
Aktif ziyaretçi düzenlenirken erişim yalnız "Ziyareti sonlandır" ile kapatılır. KVKK kutusu metin tanımlı değilken ne yapılacağını söyler. Doğrulamada odak ekrandaki ilk hataya gider. Ziyaret edilen kişi listesi tüm kişileri çekmez.

## Ownership (yalnız bunlar)
- `src/components/visitors/VisitorFormFields.tsx`, `VisitorForm.tsx`, `VisitorCombobox.tsx`
- `src/components/visitors/hooks/useVisitorFormData.ts`, `hooks/useVisitorFormSchema.ts`, `lib/formPayload.ts`
- `src/components/visitors/visitorAudit.test.tsx`, `visitorActivation.test.tsx`, `visitorActivationData.test.tsx`
- Yeni: `convex/visitorHosts.ts` + `convex/visitorHosts.test.ts` (yalnız Z-D5 gerekiyorsa)
- `VisitorCardCapture.tsx` W1'in, `VisitorSlideOverPanel.tsx` W2'nin, `convex/visitors.ts` W2'nin dosyası; dokunma.

## Değişiklikler
1. **Z-Y1 (arayüz):** Düzenlenen ziyaretçi ŞU AN aktifse (`visitor.isActive === true`) "Erişim izni ver" kutusu gösterilmesin. Yerine kısa not: "Erişimi kapatmak için ayrıntıdaki 'Ziyareti sonlandır'ı kullanın." Bu durumda payload `isActive` göndermesin, ya da `true` göndersin; asla `false` göndermesin. Yeni kayıt, mobil ön kayıt aktivasyonu ve pasif kaydı yeniden etkinleştirme akışları aynen kalsın (`canAssignVisitorPreset`, "Erişimi etkinleştir" etiketi).
2. **Z-O7:** Aydınlatma metni tanımlı değilken (`VisitorFormFields.tsx:46`) şunlar olsun: açıklama "Ziyaretçi aydınlatma metnini onayladıysa işaretleyin." olsun; kutu devre dışıyken "Aydınlatma metni tanımlı değil." yazsın; kullanıcının `admin.manage` yetkisi varsa (`usePermissions().can`) Ayarlar'daki gizlilik bölümüne bağlantı göster. Gerçek rotayı `src/App.tsx` / `src/lib/routeMeta.ts` içinden bul (salt okuma). "Mevcut kayıt sistemine rıza bilgisi ekler" cümlesi kalksın.
3. **Z-D2:** Doğrulama hatasında odak, ekrandaki sıraya göre ilk hatalı alana gitsin: bölge (`v_zone`) → bitiş (`v_expires`) → kart (`v_card`) → ad → soyad (`VisitorForm.tsx:36-37`).
4. **Z-D5:** "Ziyaret edilen kişi" için `api.employees.list` tüm kişileri çekiyor (`useVisitorFormData.ts:51-54`). Önce mevcut sınırlı bir arama/seçenek sorgusu var mı bak (`grep -n "export const" convex/employees.ts`, search index'leri `convex/schema.ts`'te, salt okuma). Varsa onu kullan. Yoksa `convex/visitorHosts.ts` içinde yetki kontrollü (`resolveProjectScope` + proje), sınırlı (≤50 sonuç) ve isimle arama yapan bir sorgu yaz; ziyaretçileri (`isVisitor`) hariç tut. Combobox yazıldıkça sunucudan arasın. Düzenlemede seçili kişi listede yoksa adı yine görünsün (bugün "Kayıtlı seçim").

## Kabul
- Testler: aktif ziyaretçi düzenlemesinde kutu yok, payload'da `isActive:false` yok. Pasif kayıtta ve yeni kayıtta kutu var. Metin tanımsızken yeni metinler ve (yetkiliyse) bağlantı görünür. Boş formda odak `v_zone`'a gider. Host araması sınırlı sorguyla çalışır ve seçili host adı görünür.
- `src/components/visitors` testleri yeşil. `convex/visitorHosts.test.ts` yazdıysan yeşil.

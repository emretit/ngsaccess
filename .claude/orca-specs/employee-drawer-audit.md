# Personel drawer'ı UI/UX denetimi (Yeni ekle + Düzenle) — SALT-OKUMA

## Hedef
`docs/ui-audit-employee-drawer/RAPOR.md` dosyasını yaz: Personel "Yeni ekle" ve "Düzenle" drawer'larının UI/UX denetimi + iki mod arasındaki fark tablosu. Kullanıcı (Emre) şunu fark etti: "düzenle sayfasında olan, yeni sayfasında olmayan durumlar var". Bunları tek tek çıkar ve her biri için "yeni kayıtta da olmalı mı / bilinçli olarak yalnız düzenlemede mi" önerisi ver.

## Bağlam (2026-10-22, commit'siz çalışma ağacı, taban main eb677f9)
- Satıra tıklayınca tek drawer açılır. Yöneticide başlık "Personel düzenle": üstte ad + durum rozeti + İşten çıkar, "Genel bilgiler" bölümünde yerinde düzenlenebilir form (`EmployeeForm embedded`), altında Erişim yetkileri, Cihaz senkron durumu, Parmak izi (biyometri modülü açıksa), KVKK Rızalar, Son geçişler, Fotoğraf ve veri kayıtları. Vazgeç/Kaydet çubuğu yalnız değişiklik varken görünür.
- "Personel ekle" butonu: yalnız form (`EmployeeForm`, embedded değil), altta her zaman Vazgeç/Kaydet. Kaydet sonrası aşama listesi (kaydedildi, kurulum e-postası, cihaz senkron) + "Tamam".
- project_user salt-okunur "Personel ayrıntısı" görür.

## Okunacak dosyalar
src/components/employees/: SlideOverPanel, EmployeeForm, EmployeeFormFields, EmployeeDetails, FormActions, PhotoUpload, EmployeeTable (satır menüsü), EmployeeSyncSection, EmployeeConsentsCard, EmployeeFingerprintCard, EmployeeRecentReadings, EmployeeEmploymentActions, EmployeeEmploymentBadge, hooks/useEmployeeFormSubmit.ts, hooks/useEmployeeFormData.ts, hooks/useEmployeeFormSchema.ts; src/pages/Employees.tsx; src/components/shared/UnsavedChangesDialog.tsx.

## Canlı bakış (isteğe bağlı ama önerilir)
- Uygulama localhost:8081'de açık (Vite dev, girişli). Orca tarayıcı: `orca tab create --url http://localhost:8081/employees --json` → dönen `browserPageId`'yi HER komutta `--page <id>` ile ver (`--page`'siz goto/click/eval YASAK: Emre'nin sekmesine gider).
- Ekran görüntüsü: `orca screenshot --page <id> --json` → `result.data` base64 PNG → `/tmp/emp-audit-*.png`'ye yaz ve incele. DOM: `orca eval --page <id> --expression "..." --json`.
- İş bitince kendi sekmeni `orca tab close --page <id>` ile kapat.

## KESİN YASAKLAR
- localhost canlı Convex'e (gerçek müşteri verisi) bağlı: Kaydet'e basma, form gönderme, İşten çıkar / Sil / Cihazlara gönder / rıza ekle / parmak izi kaydı gibi HİÇBİR yazan butona basma. Yalnız aç, bak, yaz-sil (göndermeden), Vazgeç/Esc.
- Kaynak dosya değiştirme yok (yalnız RAPOR.md yazılır). commit/push/deploy/migration/DB yazma YOK. `npx convex` komutları YOK.

## Kontrol listesi
1. İki mod fark tablosu: özellik | Yeni | Düzenle | öneri (ör. KVKK rızası yeni kayıtta alınabilmeli mi, erişim kuralı/cihaz senkron geri bildirimi, fotoğraf, ücret alanları, Aktif kutusu, "Mevcut erişim üyelikleri", kaydet sonrası akış farkı, başlık/açıklama metinleri).
2. Görsel hiyerarşi ve yoğunluk: boşluk tutarlılığı, bölüm başlıkları, "Genel bilgiler" + form legend'larının çift başlık etkisi, fotoğrafın iki yerde görünmesi.
3. Form: alan sırası, zorunlu işaretleri, doğrulama/hata mesajları ve odak, TC/kart biçim ipuçları, select'lerin boş seçenek metinleri.
4. Akış: dirty guard (kapatma, proje değişimi), Vazgeç davranışı (yeni = kapatır, düzenle = geri alır), kaydet sonrası aşamalar + Tamam, yükleniyor/boş/hata durumları, kayıt silinmişse.
5. Erişilebilirlik: label/aria, odak sırası, Esc, 44 px dokunma hedefi (proje kuralı), kontrast, ekran okuyucu duyuruları (role=status/alert).
6. Duyarlı tasarım: sm: kırılımları (390 px'te 3'lü grid'ler, sticky çubuk), uzun ad/e-posta taşması.
7. Metin: Türkçe tutarlılık, terimler (Personel/Kişi, Kart/kimlik vs.).

## Rapor biçimi (Türkçe, sade)
- 1-2 cümle özet.
- Fark tablosu.
- Bulgular: Y (yüksek) / O (orta) / D (düşük); her biri: başlık, yer (`dosya:satır`), sorun, öneri, kanıt (ekran görüntüsü yolu varsa). En fazla 25 bulgu, önem sırasıyla.
- "Hızlı kazanımlar" (≤30 dk) listesi ve "Karar gerektirenler" (Emre'ye soru) listesi ayrı.

## Bitiş
`worker_done` mesajında ≤10 satır: Y/O/D sayıları, en önemli 3 bulgu (dosya:satır), rapor yolu.

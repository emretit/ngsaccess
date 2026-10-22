# Cihazlar: "Yeni cihaz" + "Cihaz düzenle" akışlarının MEVCUT DURUM raporu (SALT-OKUMA)

## Amaç
Emre (2026-10-22): Cihazlar sayfasındaki yeni cihaz ekleme ve cihaz düzenleme, Kişiler sayfasındaki gibi olsun: iki drawer (biri Yeni, biri Düzenle), benzer UI yapısı. Önce mevcut durumu konuşacağız — sen yalnız DURUMU çıkar ve Kişiler deseniyle karşılaştır. Kod değiştirme.

## Referans: Kişiler deseni (main `0fcaaf7`, commit'li)
- `src/components/employees/SlideOverPanel.tsx`: tek Sheet, iki mod. `employee=null` → "Personel ekle" (yalnız form, altta her zaman Vazgeç/Kaydet, kayıt sonrası aşamalar + "Tamam"/"Ayrıntılara devam et"). `employee` → yöneticide "Personel düzenle": üstte ad + durum rozeti + eylem, altında yerinde düzenlenebilir form (`EmployeeForm embedded`), Kaydet/"Değişiklikleri geri al" çubuğu yalnız değişiklik varken (sticky). project_user'da salt-okunur "Personel ayrıntısı".
- Kompakt: 700 px genişlik, başlık px-5 py-3, bölümler fieldset+legend, 3'lü grid'ler, mobilde `max-sm:min-h-11`.
- Koruma: kaydedilmemiş değişiklikte kapatma/Esc/dış tık/proje değişimi/drawer içi bağlantı/tarayıcı geri → "Değişiklikler kaydedilmedi" (`useUnsavedChangesGuard` + `installNavigationGuard`). İlk odak: yenide Ad alanı, düzenlemede başlık. Düzenlemede yalnız değişen alanlar gönderilir.
- İlgili dosyalar: `EmployeeForm.tsx`, `EmployeeFormFields.tsx`, `EmployeeDetails.tsx`, `FormActions.tsx`, `src/pages/Employees.tsx`.

## Çıkar (Cihazlar)
Oku: `src/pages/Devices.tsx`, `src/components/devices/**` (özellikle `DeviceAddMenu`, `BrandPickerStep`, `DeviceForm` + `form-sections/**` + `hooks/**`, `DeviceDetailsPanel`, `DeviceCommandCenter`, `DeviceGatewayDanger`, `ClaimDeviceDialog`, `DeviceTableRow`, `DeviceList`, `useDeviceDeepLink`), gerekirse `convex/devices.ts` create/update imzaları (yalnız oku).
1. **Yeni cihaz akışı**: nereden açılıyor (buton/menü), hangi bileşen (Dialog mu Sheet mi, genişlik), adımlar (marka seçimi → form?), marka/transport bazında alanlar (Hik gateway / Hik localBridge / DS-K2804 / IDE MQTT / QR / diğer), zorunlu alanlar, kaydet sonrası ne oluyor, Claim akışı farkı.
2. **Düzenle akışı**: satır tıklama → `DeviceDetailsPanel` (sekmeler? "Ayarlar" sekmesinde form?), Güncelle çubuğu, dirty koruması var mı, project_user görünümü, sır alanları (şifre/token) nasıl gösteriliyor.
3. **Kişiler deseniyle fark tablosu**: özellik | Cihaz yeni | Cihaz düzenle | Kişiler | öneri (ör. tek Sheet iki mod mu, sekmeler kalmalı mı, form embedded olabilir mi, komutlar/kuyruk/olaylar düzenle drawer'ında nereye, dirty bar, ilk odak, genişlik/yoğunluk, başlık metinleri).
4. **Riskler/kısıtlar**: marka bazlı form karmaşıklığı, sır alanları (boş = temizle tuzağı — bkz. devices authz notu: sır okuma-gate'i yazma-gate ile eşleşmeli), test dosyaları, dosya boyutları (god-file var mı).
5. **Önerilen yol**: 2-3 seçenek (en az değişiklik → Kişiler'e tam uyum), her biri için tahmini dosya sayısı/süre ve risk; senin önerin.

## Canlı bakış (önerilir)
Localhost:8081 açık, canlı veriye bağlı. Orca: `orca tab create --url http://localhost:8081/devices --json` → her komutta `--page <id>`; ekran görüntüsü `orca screenshot --page <id> --json` (base64 → /tmp/dev-state-*.png). YALNIZ aç/bak/Vazgeç/Esc: Kaydet/Güncelle/Sil/komut/Özellikleri tara/kapı aç gibi HİÇBİR yazan butona basma. Bitince `orca tab close --page <id>`.

## Yasaklar
Repo dosyası yazma (yalnız rapor), commit/push/deploy, `npx convex *`, DB yazma, git stash/checkout/reset.

## Rapor
`docs/ui-audit-devices-drawer/DURUM-FORM.md` (Türkçe, sade; 1-2 cümle özet + bölümler 1-5). `worker_done` ≤10 satır: özet, fark tablosundaki en önemli 3 fark, önerdiğin yol.

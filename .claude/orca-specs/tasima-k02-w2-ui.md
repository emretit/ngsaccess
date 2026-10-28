# TAŞIMA K-02 MVP — W2 UI: "Başka projeye taşı" sihirbazı + devir durumu

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma).
Rapor: `/tmp/tasima-k02-w2-rapor.md`. Backend W1'de bitti: `convex/employeeTermination.ts` içindeki `startTransfer`, `cancelTransfer`,
`retryTransfer`, `getEmployeeTransfer`, `transferPreflight` (imzaları ve dönüş tiplerini KODDAN oku; `/tmp/tasima-k02-w1-rapor.md`).
Kararlar: B'de yeni kayıt, A "taşındı" kapanır, geçmiş A'da · zorla tamamla YOK · çevrimdışı hedef cihaz varsa taşıma başlamaz.

## Hedef (test edilebilir)
Yetkili kullanıcı Kişi Ayrıntıları'ndan kişiyi başka projeye taşır; engel varsa (çevrimdışı cihaz, aktif ziyaretçi, yetki) başlatmadan önce
neden ve çözüm görünür; taşıma sürerken A ve B ayrıntısında cihaz bazlı ilerleme, takıldığında "Yeniden dene" / "Taşımayı iptal et" görünür.

## Ownership (yalnız bunlar)
`src/components/employees/EmployeeDetails.tsx` · `src/components/employees/EmployeeEmploymentActions.tsx` · YENİ
`src/components/employees/EmployeeTransferDialog.tsx` · YENİ `src/components/employees/EmployeeTransferStatus.tsx` ·
`src/components/employees/lib/employment.ts` · bu bileşenlerin testleri (YENİ `EmployeeTransferDialog.test.tsx`, `EmployeeTransferStatus.test.tsx`).
DOKUNMA: `convex/**` (backend değişikliği gerekiyorsa `ask`), `src/components/reports/**`, `src/lib/reports/**`, `src/components/settings/**`,
`src/lib/capabilities.ts` (başka oturum WIP).

## Davranış
1. **Giriş noktası** — `EmployeeEmploymentActions` yanında "Başka projeye taşı" (aktif, ziyaretçi olmayan, `terminationType !== "transfer"`,
   aktif devri olmayan kişi; kullanıcının kişi yönetebildiği en az bir başka proje varsa — mevcut proje/yetki sorgularını kullan, yeni sorgu
   yazma). A kaydında `terminationType === "transfer"` ise "Geri al" (reinstate) GÖSTERİLMEZ.
2. **Sihirbaz** (`EmployeeTransferDialog`, `EmployeeTerminateDialog` kalıbı: Dialog + `useAsyncAction`, pending'de kapanmaz):
   hedef proje (yalnız yönetebildikleri, mevcut proje hariç) → hedef projede departman (opsiyonel) + erişim kuralları (çoklu, opsiyonel; hedef
   projenin kuralları) → `transferPreflight` sonucu: engel varsa liste ("Kapı Paneli 2 çevrimdışı — cihaz açılınca tekrar deneyin" gibi) ve
   "Taşı" pasif. Onay metni etkileri yazar (madde): eski projede kişi pasif olur, geçmişi orada kalır · kart eski cihazlardan silindiği
   onaylanınca yeni projeye geçer (genelde birkaç dakika) · mobil hesap için yeni projede yeniden davet gerekir · parmak izi yeni projede
   yeniden kaydedilir · vardiya ataması yeni projede yapılmalı (yoksa PDKS oluşmaz). Başarıda B kaydına geçiş linki/butonu.
3. **Durum** (`EmployeeTransferStatus`, `EmployeeDetails` içinde; `getEmployeeTransfer` aktif ya da son devir döndürürse):
   - A tarafı: "Başka projeye taşındı → <B adı> (<tarih, TR saati>)"; devir sürüyorsa cihaz listesi.
   - B tarafı: "<A adı> projesinden taşınıyor — kart eski cihazlardan silinince verilecek" / bitince "<A> projesinden taşındı".
   - Cihaz listesi: ad · durum rozeti (Bekliyor / Silindi / Başarısız / Korundu(superseded) / Cihaz kaldırıldı) · son görülme (TR saati) · hata metni.
   - `stuck`: neden + "Yeniden dene" (`canRetry`) ve "Taşımayı iptal et" (`canCancel`, `ConfirmDestructive`: "Kişi eski projede yeniden aktif
     olur; yeni projedeki kartsız kayıt silinir"). Superseded hedefte retry yerine açıklama: "Bu kart eski projede başka aktif kayıtta; o kaydı
     düzeltin ya da taşımayı iptal edin".
   - Saatler UTC+3 (mevcut tarih yardımcıları). Canlı güncelleme `useQuery` ile (polling yok).
4. Hata mesajları: backend `ConvexError` mesajını göster (mevcut hata gösterim yardımcısı); kod bazlı özel metin gerekiyorsa
   `TRANSFER_IN_PROGRESS`, `TRANSFER_DEVICE_OFFLINE`.
5. Görsel dil: mevcut A2 bileşenleri (Button, Badge, Dialog, Select); yeni renk/tema yok; mobil dar ekranda `max-sm:min-h-11` kalıbı.

## Kabul (testler)
- Dialog: preflight engeli varken "Taşı" pasif ve neden görünür; engelsizken start doğru argümanlarla çağrılır; pending'de kapanmaz.
- Status: revoking (2 hedef, 1 silindi) listesi; stuck + canRetry/canCancel butonları; A tarafında "Geri al" yok; superseded açıklaması.
- Kapılar (fix-ortak.md) + `vitest run src/components/employees` yeşil.

commit/push/deploy YOK. `git add`/`git commit` YASAK. Belirsiz yerde `ask`.

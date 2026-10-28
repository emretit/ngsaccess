# W4 — Ziyaretçi kayıtları saklama süresi (Z-O4)

## Hedef
Proje yöneticisi Ayarlar › Gizlilik'te "Ziyaretçi kayıtlarını saklama süresi (gün)" belirler. Süresi dolan PASİF ziyaretçi kayıtları günlük temizlikte, elle silmeyle aynı zincirle silinir. Ayar boşsa hiçbir şey silinmez (varsayılan kapalı).

## Ownership (yalnız bunlar)
- `convex/schema.ts` — YALNIZ `projectPrivacySettings` tablosuna `visitorRetentionDays: v.optional(v.number())` ekle. Başka değişiklik yapma; index gerekiyorsa `employees` index'ini de ekleyebilirsin ama önce `ask` ile sor.
- `convex/privacyRetention.ts`, `convex/lib/privacySettings.ts`
- Yeni: `convex/lib/visitorRetention.ts` + `convex/lib/visitorRetention.test.ts`
- `convex/privacyRetention.settings.test.ts`, `convex/retention.test.ts`
- `src/components/settings/sections/privacy/VisitorNoticeCard.tsx` + yeni `VisitorNoticeCard.test.tsx`
- `convex/crons.ts` — yalnız mevcut `startDailyPurge` grupları yetmezse ve önce `ask` ile sorduktan sonra.
- `convex/visitors.ts` ve `convex/employees.ts` başka worker'ın dosyası ya da ortak dosya: salt okuma. Silme zinciri için `removeEmployeeRecord` (`convex/employees.ts`) içe aktarılabilir. Kullanıcı (`user`) parametresi sorun çıkarırsa DUR, `ask` ile sor.

## Değişiklikler
1. Ayar: `cardReadingRetentionDays` deseniyle (okuma + yazma mutation'ı, yetki `admin.manage`, audit kaydı) `visitorRetentionDays` ekle. Geçerli aralık: boş (kapalı) ya da 30–3650 gün.
2. Temizlik: mevcut `privacyRetention.startDailyPurge` zincirine (uygun grup, örn. "access") ziyaretçi adımı ekle. Ayarı dolu projelerde şu ziyaretçileri sil: `isVisitor === true`, `isActive === false` ve son anı (`accessExpiresAt`, yoksa `updatedAt`) şimdiden `visitorRetentionDays` günden eski olanlar. Aktif kayıtlar ve mobil ön kayıt (`preRegistered`, bitişi gelecekte) hiç silinmez. Silme `removeEmployeeRecord` ile yapılır (cihaz + KVKK temizliği). Her çağrı sınırlı olsun (örn. ≤25 kayıt), devamı scheduler zinciriyle; mevcut "20 purge çağrısı" sınırına uy. Her silme audit'e "Saklama süresi doldu" notuyla yazılsın.
3. Arayüz: `VisitorNoticeCard.tsx`'e sayı alanı ekle: "Pasif ziyaretçi kayıtları … gün sonra silinir (boş = silinmez)". Kaydetme sonrası bildirim göster. Ayarı ilk kez dolduran kişiye, silinecek kayıt sayısının ön izlemesini göster (sınırlı sayım, örn. "en az 120 kayıt"). Sayım sorgusu sınırlı olsun.

## Kabul
- Testler: ayar boşken hiçbir ziyaretçi silinmez. 90 gün ayarında 100 gün önce biten pasif ziyaretçi silinir, 80 gün önce biten silinmez, aktif ve ön kayıt silinmez, başka projenin kaydı etkilenmez. Yetkisiz kullanıcı ayarı değiştiremez. Aralık dışı değer reddedilir. Bileşen testi: alan görünür, boş = kapalı metni, kaydetme çağrısı.
- `convex/retention.test.ts`, `convex/privacyRetention.settings.test.ts`, `src/components/settings/sections/privacy` testleri yeşil.

# FAZ 5A/5B — DÜZELTME 1
ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Önceki işler: `.claude/orca-specs/akis-faz5a-alarm.md`, `akis-faz5b-kurulum.md` (commit'siz, main'de); denetim `/tmp/akis-faz5-denetim.md`.
Rapor: `/tmp/akis-faz5-fix1-rapor.md`.
## İşler
E1 (ENGEL, 5B). `src/components/dashboard/SetupChecklist.tsx`: kurulum tamamlanınca (veya kullanıcı gizleyince) `projects.getSetupStatus` aboneliği KAPANSIN — proje başına `localStorage` "tamamlandı" işareti; işaret varsa `useQuery(..., "skip")`. İlk tamamlanma görüldüğünde işaret yazılır. Cihaz `lastSeen` heartbeat'i her patch'te sorguyu yeniden koşturmasın: mümkünse sorgu cihaz adımında `lastSeen` değerini değil yalnız varlığını okusun (ör. `lastSeen !== undefined` olan ilk cihazı bulduktan sonra aboneliğin heartbeat'e duyarlılığı raporda yaz). Test: complete → sorgu skip; gizli → skip; proje değişince doğru proje anahtarı.
D1 (5A). E-posta durumu `sending`'de takılabilir (`convex/alarms.ts` `claimEmail` ~:152): UI'da (`AlarmEmailStatus`) `sending` + 10 dk'dan eski → "Gönderim yarıda kaldı" (hata gibi) göster; tekrar deneme mantığında bayat `sending`'i tekrar talep edilebilir say (tek retry kuralı korunur). Yeni cron/polling YOK. Test.
D2 (5A). `convex/lib/alarmNotify.ts` (~:42) debounce anahtarına `deviceId` ekle (offline arızalarında her cihaz ayrı e-posta; aynı cihaz 10 dk içinde tekrar etmez). Mevcut kart/alarm olaylarının debounce davranışını değiştirmeden. Test.
## Ownership
`src/components/dashboard/SetupChecklist.tsx` (+test), `src/pages/Index.tsx` (gerekirse), `convex/projects.ts` (yalnız getSetupStatus), `convex/alarms.ts`, `convex/lib/alarmNotify.ts`, `src/components/alarms/AlarmEmailStatus.tsx` (+test), ilgili convex testleri (`convex/alarmDelivery.test.ts`, `convex/lib/alarmNotify.test.ts`, `convex/projectSetup.test.ts`).
## Kapsam dışı
Düşme anında çevrimdışı tespiti (cron gerektirir; koordinatör Emre'ye soracak) · `schema.ts` · Faz 2A/Faz 1/3A dosyaları.

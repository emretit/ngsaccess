# C2b W-api-fix — backend denetim bulgularının düzeltmesi (05/06/07/09)
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) ve `convex/_generated/ai/guidelines.md` oku. Denetim sonucu aşağıda; backend
sözleşmeleri `.claude/orca-specs/reports/c2b-0{5,6,7,9}-api.md`. Paralel 05/07/09 FRONTEND worker'ları bu API'leri şu an tüketiyor:
belgelenmiş dönüş şekillerini DEĞİŞTİRME, yalnız ekle (opsiyonel arg/alan). Sözleşme eklemesi yaptığında raporuna yaz; koordinatör ilgili
frontend worker'ına iletecek.

## Düzeltilecekler
1. **YÜKSEK — `shifts.bulkAssignShift` eski davranış (`convex/shifts.ts` ~280-300):** canlıdaki ESKİ BulkAssignShiftDialog, tüm çalışanlar
   çakışınca `OVERLAP:n` hatasını bekliyor (regex ile onay açıyor); şimdi hata yok → "0 çalışana atama yapıldı" başarı mesajı. Yeni opsiyonel
   arg `resultMode: v.optional(v.literal("detailed"))` ekle: verilmezse (eski frontend) `forceConfirm` yokken ve çakışma varsa ESKİ
   davranışla `OVERLAP:n` fırlat (eski mesaj formatı birebir); `"detailed"` ise yeni kişi bazlı sonuç döner, fırlatmaz. Test ekle (iki mod).
2. **ORTA — projectId'siz eski atama (`shifts.ts` assignmentDecision ~62, remove ~473):** tek kayıt yüzünden tüm toplu atama/silme durmasın;
   o çalışanı `skipped` + Türkçe sebep ("Eski kayıt proje bilgisi içermiyor") ile atla, diğerleri devam etsin. Silmede ilgili kaydı etkiden
   hariç tut ve dürüst say. Test ekle.
3. **ORTA — ziyaretçi bitiş saati formatı (`convex/visitors.ts`, `lib/visitorStatus.ts`):** yeni yazımlar UTC ISO, eski kayıtlar
   `datetime-local` (TR saati, saat dilimsiz). Okuma/durum hesabı İKİ formatı da doğru yorumlasın (saat dilimsiz = Europe/Istanbul);
   `getDetail`/`listPage` dönüşünde frontend'in input'a koyabileceği tutarlı biçim (ISO) verilsin. Test: iki format → aynı durum.
4. **ORTA — gönderim run'ı maliyeti (`convex/deviceSyncRuns.ts`, `lib/deviceSyncRun.ts`):** Convex kotası zaten aşılmış durumda (Free plan
   uyarısı) — fonksiyon çağrısı sayısını düşür: (a) refreshTarget/refreshSummary hedef başına 5 sn poll yerine run başına TEK zamanlanmış
   yenileme, artan aralık (ör. 5 → 15 → 30 → 60 sn), tüm hedefler terminal olunca dur; (b) değişiklik yoksa patch YAZMA (no-op skip);
   (c) IDE dalında kural×üye başına ayrı action yerine çalışan başına tek senkron (aynı kişi birden çok kuralda ise tekilleştir; mevcut
   `syncEmployeeToIdePanels` gibi kişi bazlı yol varsa onu kullan). Hedef durum dürüstlüğü (Hik done=sent, IDE acked=verified) aynen kalsın.
   Raporda: 50 cihazlı / 100 kişilik örnek run için yaklaşık fonksiyon çağrısı sayısı (önce/sonra).
5. **ORTA — `visitors.getDetail` hassas alan:** tam kart no + TC kimlik no yalnız admin yetkisinde (mevcut admin kontrol yardımcısıyla);
   admin olmayana maskeli (`•••• 5678`, TC son 4 hane). Dönüş alanları aynı kalsın (değer maskeli olur) + `sensitiveMasked: boolean` ekle.
6. **DÜŞÜK — `cardReadings.assignCardFromReading`:** pasif (isActive=false) kişiye atamayı Türkçe hatayla reddet; senkron hedefi yoksa
   `syncStatus` "pending" yerine "noTargets" (yeni literal ekle — frontend'e bildirilecek). Test.

## Ownership
convex/shifts.ts · convex/lib/shiftAssign.ts (+test) · convex/visitors.ts · convex/lib/visitorStatus.ts (+test) · convex/deviceSyncRuns.ts ·
convex/lib/deviceSyncRun.ts (+test) · convex/cardReadings.ts (yalnız madde 6) · convex/lib/liveReadings.ts (+test) · ilgili rapor dosyalarına
"Düzeltme (api-fix)" bölümü ekleme: `.claude/orca-specs/reports/c2b-0{5,6,7,9}-api.md`

## Kapsam dışı
src/** · schema.ts (ask) · accessRules.getDetails/updateWithGroups (C3) · eski backfill/syncWeekPlan/syncRuleToIdePanelsAndWait davranışı.

## Kapı + rapor
convex tsc 0 · eslint convex 0 · npx vitest run yeşil. worker_done ≤10 satır + `.claude/orca-specs/reports/c2b-api-fix.md` (her madde: file:line, sözleşme eklemesi var mı).

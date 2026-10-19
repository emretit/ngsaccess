# C3-rules-fix: Diff kaydında cihaz gönderimini görünür kıl + kural denetim bulguları
ÖNCE `.claude/orca-specs/c3-common.md` oku. Denetim: `.claude/orca-specs/reports/review-c3.md` (#1, #3, #4, #6). Önceki iş: `reports/c3-rules.md`;
gönderim kaydı altyapısı (C2b): `reports/c2b-05-api.md` (`deviceSyncRuns`, `deviceSyncRunTargets`, op tablolarında opsiyonel `runId`).

## Hedef (test edilebilir)
1. **#1 YÜKSEK:** Kural editörü diff ile kaydedince cihaz işlemleri (eklenen kişi → Hik `syncEmployeeToDevicesInternal` + IDE; çıkarılan → Hik
   `deleteEmployeeFromDevicesInternal` + IDE orphan silme; kapsam değişimi → tam senkron) bir `deviceSyncRuns` kaydına bağlanır; hedef bazında
   durum (kuyrukta/gönderildi-teslim kanıtı yok/cihazda doğrulandı/başarısız/atlandı) mevcut C2b semantiğiyle yazılır ve kuralın "Son gönderimler"
   bölümünde görünür. Kayıt sonrası bildirim run'a yönlendirir (sahte "uygulandı" yok). Değişiklik yoksa (boş diff) "Cihazlara gönder"
   (mevcut tam gönderim) yolu kullanıcıya açıkça sunulur → yeniden deneme mümkün. Mevcut tam-senkron yolunun (startRuleSync) davranışı DEĞİŞMEZ.
   Yalnız değişen kişiler için gönderim yapılır (tam kural yeniden gönderimi yok); bunu saf mantık testiyle göster.
2. **#3** `convex/accessRules.ts:163-164` `devicesTruncated`/`doorsTruncated` her biri kendi sınırına göre (`length > LIMIT`).
3. **#4** Diff modunda cihaz çıkarılınca o cihaza ait, `doors.added` içinde olmayan eski `groupDoors` satırları da silinir (legacy
   `deleteStaleGroupDoors` eşdeğeri); eşzamanlı eklenen kapı korunur — test.
4. **#6** `hikWeekPlanNo` atanmamış kurala yalnız üye eklenirse `syncRule=true` (plan atanır).

## Ownership
`convex/accessRules.ts` · `convex/lib/accessRuleDiff.ts` (+test) · `convex/deviceSyncRuns.ts` · `convex/lib/deviceSyncRun.ts` (+test) ·
`convex/hikvisionSync.ts` · `convex/actions/hikvisionSync.ts` · `convex/ideSync.ts` · `convex/actions/ideGatewayDevice.ts` ·
`src/hooks/access-rules/**` · `src/components/access-control/unified/**` · `convex/_generated/api.d.ts` (yalnız kendi satırın).
Şema değişikliği gerekirse `ask` + TAM tanım (yeni alan `v.optional`). Başka dosya → `ask` (koordinatör hızlı yanıtlar).

## Kapsam dışı
Senkron motorunun cihaz protokolü, Geçiş Kontrol sayfa düzeni, denetim raporundaki #2/#5/#7/#8 (koordinatörde).

## Rapor
`.claude/orca-specs/reports/c3-rules-fix.md`: run kaydının nasıl üretildiği (hangi mutation/action, hangi hedefler), yeni/değişen fonksiyonların TAM tipleri,
eski istemci davranışı, testler, koordinatörün gerçek oturumda bakacağı akış (kurala kişi ekle → Son gönderimler'de run + hedef durumları; boş kayıt → Cihazlara gönder önerisi).

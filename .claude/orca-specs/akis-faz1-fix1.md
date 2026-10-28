# FAZ 1 — DÜZELTME 1
ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Önceki iş: `.claude/orca-specs/akis-faz1-yetki.md` (commit'siz, main'de), yazar raporu `/tmp/akis-faz1-rapor.md`, denetim `/tmp/akis-faz1-denetim.md`.
Rapor: `/tmp/akis-faz1-fix1-rapor.md`.
## İşler
D1. `convex/cardReadings.ts` `backfillHikEventRow` (~:1612-1619; günlük cron `convex/actions/hikGatewayDevice.ts` ~:742 çağırır): kart→kişi araması hâlâ proje filtresiz `.first()` ve projectId'yi kişiden alıyor. Diğer üç yolda kullanılan AYNI cihaz-projesi eşleştirme yardımcısını kullan; olay projesi cihazdan. Test (iki projede aynı kart → cihazın projesindeki kişi; projesiz cihaz → mevcut davranış).
N3. Kart adayı okumaları (`cardReadings.ts` ~:1001/1067/1130 `.collect()`): `.take(20)` üst sınır (kart global tekil; aday sayısı küçük).
N6. `convex/pdksRecords.ts` (~:116-130) toplu yüklemede tüm satırlar hata verirse de tek özet audit satırı yaz (proje kapsamlı, hata sayısı); başarılı yolda mevcut davranış.
N7. `convex/akisFaz1.authz.test.ts`: mesajsız `rejects.toThrow()` olan ret testlerini beklenen mesaj kalıbıyla (`/yetki|projesinde değil|bulunamadı/` gibi, gerçek mesaja göre) daralt; her ret testinden sonra hedef kaydın DEĞİŞMEDİĞİNİ (veya oluşmadığını) assert et.
## Ownership
`convex/cardReadings.ts` (yalnız bu hunk'lar), `convex/pdksRecords.ts` (yalnız audit hunk'ı), `convex/akisFaz1.authz.test.ts`, ilgili mevcut test dosyaları (cardReadings/pdksRecords testleri).
## Kapsam dışı
`convex/accessRules.ts` (Faz 2A yazıyor) · `shifts.ts` / `departments.ts` rol değişikliği (UI tüm rollere açık → ürün kararı, koordinatör Emre'ye soracak) · `doors.ts:292` (canlıda bozuk bağ 0, bilinçli).

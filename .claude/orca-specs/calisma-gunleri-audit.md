# Spec — Çalışma günleri → vardiya planı: etki denetimi (SALT OKUMA)

## Hedef (test edilebilir)
`/tmp/calisma-gunleri-audit-codex.md` dosyasında, aşağıdaki değişiklik yapılırsa PDKS/bordro/rapor/SGK/mobil
davranışında neyin değişeceğinin eksiksiz, file:line kanıtlı listesi + riskler + önerilen güvenli uygulama sırası olsun.

## Önerilen değişiklik (denetlenecek olan)
- Bugün: proje geneli `generalSettings.workingDays` (UI: /pdks-records/settings › "Çalışma günleri") seçilmeyen günü
  "hafta tatili" (classifyDay → "weekend") yapar. Haftalık planda (plan yok ya da `plan.kind === "weekly"`) vardiya
  her güne uygulanır ve gün türünü proje çalışma günleri belirler (`convex/lib/shiftResolver.ts:138` calendar "project").
  Gün/hafta döngüsü planlarında boş slot = hafta tatili (`kind: "rest"`, calendar "plan"), vardiyalı slot = iş günü.
  Haftalık planda "Belirli günler" (`weekPattern`) seçilmeyen gün `slotForDate` → null → sonraki atamaya/departmana düşer.
- Öneri: hafta tatili vardiya planından türesin. Haftalık planda seçilmeyen gün = hafta tatili ("rest"), seçilen gün = iş
  günü (döngü planlarıyla aynı). Proje "Çalışma günleri" ayarı kaldırılsın. Mevcut "Her gün" haftalık atamalar
  bugünkü proje çalışma günleriyle `weekPattern`'e tek seferlik dönüştürülsün ki bordro değişmesin.

## Cevaplanacak sorular (her biri file:line ile)
1. `workingDays` / `classifyDay` / `dayKind` / `calendar: "project" | "plan"` okuyan HER yer (convex + src) ve ne için
   kullanıyor: fazla mesai çarpanı, devamsızlık kararı, esnek vardiya `requiredNetMinutes`, yarım gün tatil, SGK
   eksik gün / hafta tatili sayımı, bordro, 16 rapor, mobil yoklama, dışa aktarım, ziyaretçi/diğer.
2. Haftalık planda seçilmeyen gün bugün nereye düşüyor (kişi atamaları → departman zinciri → varsayılan?) ve sonuç
   "vardiyasız gün" ise PDKS'te ne oluyor (kural: tarihli atama yoksa PDKS yok). Değişiklik sonrası "rest" olursa
   kişi atamasının bıraktığı günü departman planının doldurduğu durumlar bozulur mu? Bu çakışma desenini tarif et.
3. Plan alanı olmayan eski atamalar (`row.shiftId` + `weekPattern`) ve `departmentShiftAssignments` aynı kurala
   girer mi; varsayılan/proje vardiyası varsa onun gün türü nereden gelir?
4. Hesap her sorguda canlı yapılıyor mu? Evetse semantik değişiklik GEÇMİŞ ayları da yeniden hesaplar —
   kilitli/onaylı bordro, rapor arşivi, SGK XML çıktıları etkilenir mi? Sürümleme (shift versions,
   pdksRuleVersions.effectiveFrom) bu değişikliği tarihe bağlamak için kullanılabilir mi?
5. Dönüşüm (migration) tasarımı: "Her gün" haftalık atama → `weekPattern = proje workingDays` birebir mi? Hangi
   durumda birebir DEĞİL (ör. vardiya Cumartesi'ye de uygulanıyor ama proje Cumartesi'yi tatil sayıyor → bugün o gün
   çalışılırsa hafta tatili çarpanı; dönüşüm sonrası seçili değilse "rest" → aynı mı?). Bugünkü ve önerilen
   davranışı gün türü × okutma var/yok × tatil matrisinde karşılaştır.
6. Çalışma günlerini gösteren/düzenleyen UI (PDKS ayarları, vardiya planı Sheet, `calendarOverlays.ts`,
   `ShiftDayDetails.tsx`, atama diyalogları) ve kaldırılınca kırılacak testler.
7. Hikvision eşlemesi: Hik'te hafta sonu Global/Departman/Grup kuralında (Weekend Settings) — bizim önerinin Hik'e
   cihaz/ISAPI senkronunda etkisi var mı (vardiya/çalışma günü cihaza yazılıyor mu)?

## Ownership
- YALNIZ `/tmp/calisma-gunleri-audit-codex.md` yazılır. Repo içinde HİÇBİR dosya değiştirilmez.

## Kapsam dışı / yasaklar
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout` ÇALIŞTIRMA.
- `npx convex dev|deploy|run|import`, herhangi bir mutation/DB yazma YOK. Supabase/MCP araçlarını KULLANMA.
- Kod düzeltmesi yapma; yalnız denetle ve raporla.

## Kapılar
- Rapor dosyası var ve her bulguda file:line var (`test -s /tmp/calisma-gunleri-audit-codex.md`).
- İstersen ilgili mevcut testleri yalnız OKUMAK için `node_modules/.bin/vitest run <dosya>` koşabilirsin (yazma yok).

## Rapor
- Dosya: başta 5 satırlık sonuç ("öneri güvenli mi, hangi koşulla"), sonra soru başına bölüm, en sonda
  "ENGEL / DİKKAT / NOT" etiketli risk listesi ve önerilen uygulama sırası.
- `worker_done` özeti ≤10 satır, file:line ile.

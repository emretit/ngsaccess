# C5 — e9 Engel düzeltmeleri bağımsız 2. denetim (SALT-OKUMA)

Dil: rapor Türkçe. Repo: /Users/emreaydin/ngsaccess (HEAD commit'leri: ce7e788 feat ve sonrası).

## Hedef
`docs/hikconnect-audit/review-wave1.md` "ENGEL" bölümündeki E1/E2/E3'ün HEAD'deki koddaki düzeltmesinin
gerçekten doğru ve eksiksiz olduğunu, kendi koştuğun testlerle doğrula; her biri için KAPANDI / AÇIK hükmü ver.

- E1 `assignCards` kart değişince eski kartı IDE panellerinden silmeli + yeni kartı Hik ve IDE'ye sync etmeli
  (bkz. `convex/lib/employeeCardChange.ts`, `convex/employeeImport.ts`, `convex/employees.ts` update kart bloğu).
  Kontrol: aynı yardımcı her iki yolda mı; değişmeyen kartta 0 zamanlama; boş kart → kart silme; yetki/proje sınırı.
- E2 `src/lib/employees/parseEmployeesXlsx.ts` biçimsiz (General) sayı hücresi (`numFmt` undefined) çökmemeli;
  12345 → "12345"; bilimsel gösterim / baştaki sıfır / 16+ haneli kart no kaybı var mı.
- E3 `convex/attendanceCorrections.ts` tek yönlü (checkIn/checkOut) onay mevcut kaydın diğer saatini korumalı;
  birleşik değerle entry < exit doğrulaması; mevcut kayıt yokken davranış.

## Ownership
Hiçbir dosyaya YAZMA. Yalnız oku + test koş. Rapor dosyası: `/tmp/c5-denetim.md` (tek yazılabilir yol).

## Kapsam dışı
D1-D9 / N1-N9 bulguları, stil, refactor önerileri. Flutter dosyaları (mobile/**).

## Kapılar (sen koş, sonucu yapıştır)
- `node_modules/.bin/vitest run convex/employeeImport.test.ts convex/lib/employeeCardChange.test.ts src/lib/employees/ convex/attendanceCorrections.test.ts` (var olanlar)
- Gerekirse geçici test dosyasını `/tmp` altında yazıp `node_modules/.bin/vitest run --root . <dosya>` ile koşabilirsin; repo'ya bırakma.

## Yasak
commit / push / deploy / `npx convex *` / migration / DB yazma YOK. git index'e dokunma (add/reset/stash YOK).

## Rapor
`worker_done`'da ≤10 satır: her E için KAPANDI/AÇIK + file:line kanıt + koştuğun test sonucu. Ayrıntı `/tmp/c5-denetim.md`.

# FAZ 2-C FIX1 — Yetki Durumu silme eşleşmesi + toplu kart atama sınırı

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU. Denetim: `/tmp/fix-f2-c-denetim.md` (DÜZELT 1, 2 — oku). Rapor: `/tmp/fix-f2-c-fix1-rapor.md`.

## Ownership
`convex/lib/grantStatus.ts`, `convex/lib/grantStatus.test.ts`, `convex/employeeImport.ts`, `assignCards`'ı çağıran `src` dosyası (toplu atama dilimi), `convex/fixF2Cards.test.ts`.
DOKUNMA: `convex/ideSync.ts`, `convex/actions/ideGatewayDevice.ts` (F2-A denetimde), `convex/visitors.ts` (yalnız gerekiyorsa `ask`).

## Değişiklik
1. `grantStatus.ts` (~101-107): silme (delete) işinin sonucu kişinin GÜNCEL kartıyla değil, işin taşıdığı kimlikle (employeeId + payload'daki eski kart) eşleştirilsin; böylece
   checkOut→releaseCard (kart `IADE:x` olur) sonrası IDE/Hik silme ACK'si Yetki Durumu satırını kapatsın. Yeni kartla aynı cihaza verilmiş güncel izin satırını yanlışlıkla kapatmasın (test).
2. `employeeImport.assignCards`: tek çağrıda atama üst sınırı 100 (sayısal tekillik başına ~20 index okuması × 200 Convex işlem sınırına yaklaşıyor); UI aynı sınırla dilimlesin.
## Kabul
Testler: checkOut→releaseCard→silme ACK → grant satırı kapanır; aynı kişinin yeni kartlı aktif izni etkilenmez; 101 atama reddedilir/dilimlenir. İlgili testler + `convex/accessGrantStatus.test.ts` yeşil.

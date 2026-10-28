# FAZ 3A — DÜZELTME 1
ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Önceki iş: `.claude/orca-specs/akis-faz3a-puantaj.md` (commit'siz, main'de) + yazar raporu `/tmp/akis-faz3a-rapor.md`. Denetim: `/tmp/akis-faz3a-denetim.md`.
Rapor: `/tmp/akis-faz3a-fix1-rapor.md`. Ownership: Faz 3A dosyaları (`convex/lib/legacyOvertime.ts`, `convex/lib/cardReadingProcess.ts`, `convex/lib/reportAttendance.ts`, `convex/reports.ts`, `convex/sgkExport.ts` + testleri). `convex/lib/pdksWorkDay.ts` YALNIZ okunur; değişiklik gerekiyorsa `ask`.

## İşler
D1. Legacy manuel gece kaydı: manuel giriş 22:00 + manuel çıkış 06:00 (vardiyasız legacy) şu an 0 dk (`legacyOvertime.ts` ~:33). `exitTime <= entryTime` ise çıkış ertesi güne; süre 8 sa. Test.
D2. 16 saat yön penceresi (`cardReadingProcess.ts` ~:76) unutulan çıkışta sabah girişini "çıkış" yapıyor (22:00 giriş, çıkış yok, 08:00 okutma → exit; 16:00 giriş + ertesi 07:00 → exit). Yeni kural:
   - Son başarılı okuma `entry` ve AYNI TR gününde → `exit` (eski davranış).
   - Son başarılı `entry` önceki TR gününde ise: çalışanın o günkü vardiyası gece yarısını geçiyorsa (bitiş < başlangıç veya esnekte gece kuyruğu; mevcut `convex/lib/shiftResolver.ts` / W5.3 yardımcılarıyla çöz) ve şimdi ≤ vardiya bitişi + 4 saat → `exit`; aksi halde `entry`.
   - Vardiya yoksa / çözülemiyorsa → `entry` (eski, gerilemesiz davranış). 16 saat sabiti kaldırılır.
   - Okuma maliyeti: kart okuma sıcak yol — vardiya çözümü YALNIZ "son entry önceki günde" dalında ve indeksli, sınırlı okuma.
   Testler: gece vardiyalı 22:00→06:00 exit; vardiyasız 22:00→06:00 entry (belgelenmiş sınır); gündüz vardiyalı 22:00 giriş→08:00 entry; gece vardiyalı ama 13:00 okutma (bitiş+4 sa sonrası) entry; aynı gün giriş→çıkış exit; IO 0/1 ve cihaz yönü önceliği korunur.
N3. Cihaz değişimi: son okuma sorgusu cihaz başı (`by_employee_device_time`). `cardReadings` şemasında kişi başı zaman indeksi (ör. `by_employee_time`) VARSA: both/ayarsız cihazlar için son okumayı kişi bazında (aynı projenin cihazlarında) al; YOKSA değiştirme, raporda yaz (schema yasak).
N4. Legacy tek ham okuma + tek manuel uç (`legacyOvertime.ts` ~:34): manuel giriş 08:00 + tek ham okuma 17:00 → 9 sa olmalı (manuel uç bir ucu, ham okuma diğer ucu). Ham okuma manuel uçla aynı yöndeyse (ikisi de giriş tarafı) süre uydurulmaz. Test.

## Kapsam dışı
N+1 manuel okuma optimizasyonu (ayrı iş) · kural sürümlü PDKS motoru · `convex/cardReadings.ts`.

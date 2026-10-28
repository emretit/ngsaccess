# FAZ 3A — Puantaj doğruluğu: fazla mesai, SGK girdileri, çift yönlü okuyucuda gece çıkışı

ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Kanıt: `docs/genel-akis-audit/B-pdks-rapor.md` (bulgu 1, 5; B5 tablosu).
Rapor: `/tmp/akis-faz3a-rapor.md`.

## Hedef (test edilebilir)
Eski (legacy, kural sürümsüz) projede 4 hafta × 40 saat çalışan kişinin fazla mesaisi 0; bir haftası 50 saat olanın 5 saat. Manuel PDKS düzeltmesi legacy SGK/APHB gün ve saatlerine giriyor. Çift yönlü (`accessDirection` both/boş) cihazda 22:00 giriş → ertesi gün 06:00 okutma "çıkış" sayılıyor.

## İşler
3.1 `convex/reports.ts` (~:110-125) legacy fazla mesai: dönem boyu toplam − tek hafta (45 sa) YANLIŞ. Doğrusu: Europe/Istanbul takvim haftası (Pzt–Paz) başına `max(0, hafta legacy dakikası − 45 sa)` toplamı. Tek günlük rapor dalı (`dayReadingsMap.size <= 1` → günlük standart) korunur. Kural sürümlü (ruleDays) kısım DEĞİŞMEZ. Aynı formülün başka kopyası varsa (rapor/SGK/dashboard) aynı ortak saf yardımcıya bağla (`convex/lib/` altında yeni dosya olabilir).
3.2 Legacy dalda manuel düzeltmeler: `convex/lib/reportAttendance.ts` (~:247) ve `convex/sgkExport.ts` (~:65) legacy gün/saat hesabı manuel PDKS kayıtlarını (pdksRecords manuel giriş) okumuyor → kural sürümlü dalın kullandığı aynı manuel okuma yolunu (mevcut yardımcı varsa onu) kullan. Okuma bütçesi sınırlı kalsın (`take` sınırı + aşımda açık hata, mevcut kalıp).
3.3 SGK çıktısı etiketi: APHB fazla mesai alanı sabit 0 ve XML "örnek biçim" (`convex/sgkExport.ts` ~:105, `convex/lib/sgkCodes.ts` ~:80). Bu dalgada resmi format YAPILMAZ: arayüzde ve dosya adında/başlığında "Taslak — resmi SGK formatı değildir, kontrol edin" uyarısı; APHB fazla mesai alanını 3.1'in haftalık hesabından doldur (hesap ortaksa). `src/pages/Reports.tsx` (~:19) "Resmi Raporlar" bağlantısı gerçekte hangi ekranı açıyorsa adı ona göre düzelt.
3.4 `convex/lib/cardReadingProcess.ts` (~:55-75) both modunda yön: "son başarılı okuma bugünün başından eskiyse giriş" kuralı gece vardiyasını bozuyor. Yeni kural: son başarılı okuma ≤ 16 saat önce ve `entry` ise → `exit`; aksi halde `entry` (16 sa sabiti adlandırılmış). Fiziksel yön (IDE IO 0/1, cihaz entry/exit) öncelikli kalır. Tekrar okutma (ör. 60 sn içinde ikinci okutma) mevcut davranışı neyse korunur — değiştirme, raporda yaz. Canlıda 7 cihazın 6'sı both/boş (koordinatör sayımı).
3.5 Testler: 3.1 (40/50 saat, hafta sınırı Pazar 23:59/Pzt 00:00, ay ortasında başlayan hafta), 3.2 (manuel düzeltmeli legacy gün), 3.4 (22:00→06:00 çıkış; 08:00 giriş → ertesi gün 07:30 = 23,5 sa → giriş; IO 0/1 öncelik).

## Ownership
`convex/reports.ts`, `convex/sgkExport.ts`, `convex/lib/sgkCodes.ts`, `convex/lib/reportAttendance.ts`, `convex/lib/cardReadingProcess.ts`, yeni `convex/lib/<overtime yardımcı>.ts`, `src/pages/Reports.tsx` ve SGK rapor bileşeni (yalnız etiket/uyarı) + bunların testleri.
## Kapsam dışı
`convex/cardReadings.ts` (Faz 1 sahibi — 3.4'ü yalnız `cardReadingProcess.ts` içinde çöz; çağrı yerini değiştirmek gerekirse `ask`) · kişiye özel vardiya günü → gün türü (Faz 3B) · resmi SGK formatı · `schema.ts` · kural sürümlü PDKS hesabı.

# W4 + W5 sentezi (koordinatör, 2026-10-21)

Girdi: [w4-template-claude.md](w4-template-claude.md) · [w4-template-codex.md](w4-template-codex.md) · [w5-pdks-codex.md](w5-pdks-codex.md).

## Ana bulgu: ikisi de plandakinden çok büyük
| Paket | Plan tahmini | Tasarım tahmini |
|---|---|---|
| W4 şablon + yetki durumu | ~8 sa | Claude ~4 gün · Codex 11-16 iş günü (sürümlü artifact kanıtı dahil) |
| W5 PDKS kuralları | ~8 sa | Codex 5,5-7,5 gün |

## Tasarımlarda bulunan mevcut açıklar (kodda teyit edildi)
1. **Hik çok kapılı cihazda kapı kapsamı uygulanmıyor.** Kişi senkronu cihaz başına ilk kuralı alıp diğerlerini atlıyor (`convex/actions/hikvisionSync.ts:139-150` `seen` dedupe) ve kişiyi cihazın TÜM kapılarına aynı planla yazıyor (`convex/lib/gateway/persons.ts:54-71` `doorRight` = 1..doorCount). Kural yalnız 1 kapı seçse bile kişi diğer kapılara da yetki alır; aynı cihazda 2 kuralı olan kişide yalnız ilk kuralın saati geçerli. Tek kapılı terminallerde (K1T343, K1T804) etkisi yok; çok kapılı kontrolcülerde (gateway yolu) fazla yetki.
2. **Bulut kararlı okuyucularda saat kontrolü yok.** `canEmployeeAccessDevice` (`convex/lib/accessDecision.ts:14-26`) yalnız kural üyeliği + `isActive`'e bakıyor; kuralın gün/saat alanları kart (ESP32 `/card-reader`) ve QR karar yolunda değerlendirilmiyor (`convex/cardReadings.ts` ~1178). Mobil yol saate bakıyor (`convex/lib/mobileAccess.ts:29`). Sonuç: saat kısıtlı kuralda bulut kararlı okuyucu mesai dışında da açar.

## Ortak noktalar (iki W4 tasarımı aynı fikirde)
- Yeni `accessScheduleTemplates`; kural `scheduleTemplateId?` ile bağlanır; gömülü saatler silinmez (geri uyum, migration yok).
- Tek saf çözücü, **fail-closed** (şablon yoksa kapalı, asla 7/24 — bugünkü `defaultRuleSchedule` boş alanı 7/24 yapıyor `convex/lib/hikSync.ts:58-66`).
- Gün başına ≤8 aralık (Hik); IDE'de (başlangıç,bitiş) çiftine göre izin kaydı, kişi başına 16 sınırı aşılırsa **yayın engellenir** (kırpma yok).
- Şablon değişince **tek birleştirilmiş senkron** (debounce), kişi yeniden yazımı yalnız gerekiyorsa.
- Tatil v1'de yok (IDE'de native yok; Hik tatil yolu cihazda doğrulanmamış).
- Yetki durumu ekranı reaktif değil, sayfalı, bütçeli.
- Ayrışma: Codex katı "Etkin = cihazdan geri okunmuş kanıt" + sürümlü artifact tabloları istiyor (çok daha büyük); Claude "Etkin = cihaz kabul etti (IDE ack / Hik HTTP 200)" + tek `accessGrantStatus` tablosu. **Öneri: Claude'unki** (Hik HTTP 200 = cihaz kabulü; geri okuma ileride eklenebilir).

## Önerilen dilimleme
- **W4.0 (~0,5-1 gün):** yukarıdaki 2 açığın düzeltmesi (kapı kapsamı + bulut kararında saat). W4'ün çözücüsü bunun üzerine kurulur.
- **W4.1 (~2 gün):** şablon CRUD + 7×24 editör + sihirbaz seçici + çözücü + Hik/IDE/mobil/bulut çeviri + tek senkron. Tatil yok.
- **W4.2 (~2 gün):** yetki durumu tablosu + Overview ekranı.
- **W5 parçaları (her biri ~1-2 gün, bağımsız sıralanabilir):** check point (kapı/cihaz) · giriş/çıkış zorunluluğu (legacy varsayılan + tarihli kural sürümü) · esnek vardiya · PDKS export kolon seçici (raporlarda zaten var, PDKS paneline taşınır; şablon tablosu yok, yerel tercih).

## W5 varsayılan öneriler (Emre aksini demezse)
- Eski projeler bugünkü davranışla (legacy) aynı kalır; yeni mod: iki yön zorunlu, tek yön → "İnceleme", hiç okutma → "Devamsız". Otomatik tam süre üretilmez.
- Esnek vardiyada geç/erken yok; eksik süre dakika uyarısı (devamsızlık değil), ücret/SGK gününe otomatik çevrilmez.
- Kurallar yarından geçerli sürümle kaydedilir; geçmişe yeniden hesap yok.
- Check point v1: kapı + cihaz düzeyi; okuyucu seçimi yok.

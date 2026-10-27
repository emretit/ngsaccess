# TODO

## PDKS

- [ ] **Öğle arası kararı ("Her giriş-çıkışı topla" modu)** — 2026-10-23, sonra konuşulacak
  - Şu an: bu modda mola süreden ayrıca düşülmüyor; dışarıda geçen süre (öğle çıkışı → dönüş) zaten düşülüyor.
  - Sonuç: öğlen kart okutmadan yemeğe çıkan kişinin molası ödenmiş sayılır.
  - Seçenekler: (a) böyle kalsın — işyeri öğle çıkışında kart okutulmasını ister · (b) kart okutulmayan günlerde sabit mola yine düşülsün.
  - Kod: `convex/lib/pdksDay.ts` (eachPunch → `breakMinutes = 0`), form açıklaması `src/components/settings/sections/components/pdksRulesPunchFields.tsx`.
  - Bağlam: `.claude/plan-pdks-ayarlar.md` (CEO TESLİM bölümü).

- [x] **Okuyucu numarası değişirse PDKS kuralı sessizce boşa düşer** — 2026-10-23 Emre: uyarı eklensin → PDKS Ayarları'nda uyarı eklendi (commit'siz, denetimden geçti; devam `.claude/plan-pdks-ayarlar.md` en üst)
  - Durum: PDKS kuralında seçilen okuyucu, okumalarla `readers.hikReaderNo` üzerinden eşleşir; numara sonradan değişir/silinirse o kural uyarısız eşleşmeyi bırakır, okumalar PDKS dışı kalır.
  - Seçenekler: (a) böyle kalsın (numara fiziksel port, nadiren değişir) · (b) PDKS ayarlarında uyarı göster · (c) kural yayınlanırken numarayı kurala kaydet (snapshot; şema + kod işi).
  - Kod: `convex/lib/pdksRules.ts` (reader eşleşmesi), denetim `/tmp/pdks-2c-denetim.md` DÜZELTİLMELİ-3.

## Landing

- [ ] **Landing modernizasyonu yayını** — 2026-10-23, kod bitti (commit'siz, yayında değil)
  - Commit 86344cb7. Push edildi. Bekleyen: Netlify yayın (Emre onayı). Hero: "Bulut PDKS ve Geçiş Kontrol Sistemi".
  - Devam: `.claude/handoff-landing-modern.md` · plan `docs/ui-scan/public/LANDING_PLAN_2026-10-23.md`.

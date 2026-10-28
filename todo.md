# TODO

Son güncelleme: 2026-10-27 21:00 · Canlı = da631a09 (Convex + web, push'lu). Yayın bekleyen commit yok.

## Hemen (1-2 dk)

- [ ] **"emre" projesinde 5 yetki cihaza hiç gönderilmemiş** — 2026-10-27
  - Yetki Durumu → Bilinmiyor (5) → hepsini seç → yeniden gönder. 5 kişi · cihaz Deneme1.

## Karar bekleyen (Emre)

- [ ] **Kapı planı dışındaki saatler: "Mesai dışı kilitli" seçeneği** — 2026-10-23
  - Soru: plan saatleri dışında kapı normal mi çalışsın (bugün), yoksa "mesai dışı kilitli" diye ayrı seçenek mi olsun? Plan dışı saat açıklaması da buna bağlı.
  - Bağlam: `.claude/plan-kapi-planlari.md`.

- [ ] **Vardiya renkleri: `clearShiftColors` migration'ı** — 2026-10-27
  - Esnek↔sabit vardiya sürümü canlı; eski renk alanını temizleyen migration ayrı onay bekliyor, ardından `color` alanı şemadan daraltılacak.
  - Bağlam: `.claude/handoff-esnek-sabit.md`.

- [ ] **KVKK Faz 1 + B5 aggregate paketi** — paket onayı bekliyor
  - Biyometrik PDKS yasağı kalktı (2026-10-26); Faz 1 imha/saklama araçları duruyor. B5 = PDKS özet (aggregate) tablosu.
  - Bağlam: `docs/ui-scan/PLAN.md`.

## Mobil

- [ ] **1.0.5 mağaza build'i + cihaz testi** — kaynak da631a09 (açılış ekranı + ziyaretçi saati + izin/düzeltme talepleri)
- [ ] **iOS: Xcode hesabı + `applicationId` kararı**
  - Bağlam: `.claude/handoff-mobile-20261022.md`, mağaza metni `docs/mobile-release/store-listing.md`.

## Cihaz gerektiren (cihaz bağlanınca)

- [ ] **IDE Smart canlı panel testi (Katman-2)** — `docs/ide-smart/NGSACCESS_SYNC_ARCHITECTURE.md`
- [ ] **Hikvision yeni ISAPI işlemlerinin (~25) canlı cihazda yanıt şekli doğrulaması**
- [ ] **NGS0002'de kapı planı gönderim testi** — `.claude/plan-kapi-planlari.md`
- [ ] **PDKS Ayarları tarayıcı turu + Hik `cardReaderNo` kontrolü** — `.claude/plan-pdks-ayarlar.md`
- [ ] **DS-K2804 açık risk: köprüde roster route'u yok** — kişi erişim başlangıç tarihi bu cihaza gitmez; köprü tarafında karar/iş gerekli.

## Geçiş Kontrol (teknik, acil değil)

- [ ] **Kuralın "son gönderim" kartı son 20 kayda bakıyor** — güncel kural kapsamıyla eşleştirilmeli (`convex/deviceSyncRuns.ts` `latestForRule`).
- [ ] **Yetki Durumu "Yeniden gönderilmeli" uyarısı üyelik değişince güncellenmiyor** — stale hesabı yalnız kural `updatedAt`'ine bakıyor (`convex/lib/grantStatus.ts` `grantStale`).
- [ ] **Kapı Planları: tatil takvimi değişince plan bunu fark etmeli + açık pencere canlı güncellenmeli.**
- [ ] **Kural sihirbazı: tek kapılı cihaz ağaç yerine düz satır** (kurallar raporu #9).
  - Bağlam (hepsi): `.claude/plan-gk-sadelestirme.md` "Sonraya kalanlar".

## Diğer açık listeler

- [ ] Sistem audit kalanları — `.claude/handoff-sistem-audit-kalan.md`
- [ ] Vardiya ↔ Hik-Connect kıyas açıkları — `.claude/handoff-vardiya-hik.md`

## PDKS

- [ ] **Öğle arası kararı ("Her giriş-çıkışı topla" modu)** — 2026-10-23, sonra konuşulacak
  - Şu an: bu modda mola süreden ayrıca düşülmüyor; dışarıda geçen süre (öğle çıkışı → dönüş) zaten düşülüyor.
  - Sonuç: öğlen kart okutmadan yemeğe çıkan kişinin molası ödenmiş sayılır.
  - Seçenekler: (a) böyle kalsın — işyeri öğle çıkışında kart okutulmasını ister · (b) kart okutulmayan günlerde sabit mola yine düşülsün.
  - Kod: `convex/lib/pdksDay.ts` (eachPunch → `breakMinutes = 0`), form açıklaması `src/components/settings/sections/components/pdksRulesPunchFields.tsx`.
  - Bağlam: `.claude/plan-pdks-ayarlar.md` (CEO TESLİM bölümü).

- [x] **Okuyucu numarası değişirse PDKS kuralı sessizce boşa düşer** — 2026-10-23 Emre: uyarı eklensin → PDKS Ayarları'nda uyarı eklendi, CANLI (ad025b13, 2026-10-23)
  - Durum: PDKS kuralında seçilen okuyucu, okumalarla `readers.hikReaderNo` üzerinden eşleşir; numara sonradan değişir/silinirse o kural uyarısız eşleşmeyi bırakır, okumalar PDKS dışı kalır.
  - Kod: `convex/lib/pdksRules.ts` (reader eşleşmesi).

## Biten (yakın tarih)

- [x] **Landing modernizasyonu** — 86344cb7 CANLI 2026-10-23 15:15.
- [x] **Geçiş Kontrol sadeleştirme + zaman şablonlarının kaldırılması + Bilinmiyor süzmesi** — CANLI da631a09 2026-10-27 20:51 (`.claude/handoff-gk-sadelestirme.md`).

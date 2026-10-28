# PDKS 2d — Hesap modu "Her giriş/çıkışı topla" (ara çıkışlar düşülür)

ÖNCE `.claude/orca-specs/akis-ortak.md` dosyasını oku: YASAK + repo kuralları + kapılar + rapor biçimi aynen geçerli.
EK YASAK: `git add`, `git commit`, `git stash/checkout/reset/restore` — HİÇBİR git yazma komutu yok.
ÖN KOŞUL: 2c (`.claude/orca-specs/pdks-2c-nokta-tipi.md`, rapor `/tmp/pdks-2c-rapor.md`) bitmiş olmalı; 2c'nin "etkin yön"
(okumanın PDKS noktası tipinden hesap anında gelen yönü) altyapısını KULLAN, yeniden yazma.

## 2c'den gelen durum (2026-10-23 11:45 — OKU)
- Etkin yön tek kaynak: `filterPdksReadings` (`convex/lib/pdksSource.ts`) yönü değişen okumaya yeni nesne döner; gece/esnek gün ataması
  `convex/lib/pdksWorkDay.ts` `withDirection`. Ham `reading.direction`'ı ayrıca yeniden hesaplama; filtre sonrası diziyi kullan.
- `firstLast` (legacy) artık tipli noktalarda yön duyarlı: giriş = entry+both noktalarındaki ilk, çıkış = exit+both noktalarındaki son
  (`convex/lib/pdksEvidence.ts:20`, `hasDirectionalPdksCheckpoints` `convex/lib/pdksRules.ts`). `eachPunch` bu davranışı bozmamalı.
- G/Ç ("both") noktasındaki okumanın etkin yönü = okumanın kayıtlı yönü; o da yoksa yönsüz → eşleştirmede dönüşümlü.
- 2c testleri (`convex/pdksCheckpointTypes.test.ts`) DEĞİŞMEDEN yeşil kalmalı.

## Bağlam
- Hikvision timetable "Calculated by": First In & Last Out | Each Check-In/Out (+ Min. Interval: tekrar okutmaları ele).
  Kaynak: `docs/hikconnect-audit/PDKS_KIYAS.md` §2.2 + §3 P1-4.
- Bizde çalışma süresi yalnız ilk giriş–son çıkış (`convex/lib/pdksDay.ts` firstISO/lastISO → brüt). Ara çıkış (öğle dışarı çıkma)
  düşülmüyor.
- Kural sürümleri: `pdksRuleVersions` (proje bazlı, `effectiveFrom`; geçmiş günler eski sürümle hesaplanır). UI: `/pdks-records/settings`
  → `PdksRulesSettings` (`src/components/settings/sections/components/pdksRules*.tsx`).

## Hedef (test edilebilir)
Kural sürümünde `calculationMode: "eachPunch"` seçiliyse gün içindeki okumalar etkin yönle sırayla giriş→çıkış çiftlerine ayrılır,
çalışma süresi çiftlerin toplamıdır (aradaki dışarıda geçen süre düşülür); `minPunchIntervalMinutes` içindeki ardışık aynı yönlü/
tekrar okutmalar tek sayılır. Varsayılan ("firstLast" ya da alan yok) ve eski sürümler birebir aynı sonucu verir.

## Yapılacaklar
1. Şema (opsiyonel alan ekle): `pdksRuleVersions.calculationMode: v.optional(v.union(v.literal("firstLast"), v.literal("eachPunch")))`,
   `minPunchIntervalMinutes: v.optional(v.number())` (0–60, varsayılan 1).
2. Saf eşleştirme fonksiyonu (`convex/lib/` altında yeni dosya serbest): girdi = günün okumaları (zaman sıralı, etkin yönlü);
   kural: entry açar, exit kapatır; açıkken gelen entry → önceki açık kalır (tekrar) ; açık değilken gelen exit → yok sayılır
   (eksik giriş); yönsüz okumalar sırayla giriş/çıkış dönüşümlü; min aralık içindeki ardışık okumalar tekilleştirilir; gün sonunda
   açık kalan giriş → eksik çıkış (mevcut eksik okutma/kural "missingRequiredPunch" davranışıyla tutarlı).
   Çıktı: çiftler + toplam dakika + eksik giriş/çıkış bayrakları.
3. PDKS hesabına bağla: ilk giriş / son çıkış GÖSTERİMİ aynı kalsın; toplam/net çalışma süresi, fazla mesai tabanı ve devamsızlık
   kararında `eachPunch` modunda çift toplamı kullanılsın (mola düşümü: sabit vardiyada mevcut mola mantığı çift toplamına uygulanmaz
   ise bunu raporda gerekçelendir — ara çıkış zaten düşüldüğünden molanın İKİ KEZ düşülmemesi şart). Gece vardiyası gün ataması mevcut
   resolver'la aynı.
4. Backend publish arg'ları + doğrulama (`convex/pdksRules.ts`): mod + min aralık.
5. UI: kural formunda "Çalışma süresi hesabı" seçimi (İlk giriş–son çıkış / Her giriş-çıkışı topla) + "Tekrar okutma aralığı (dk)";
   özet/onay metninde görünsün. Türkçe.

## Ownership (yalnız bunlara yaz)
`convex/schema.ts` (yalnız `pdksRuleVersions` iki alanı) · `convex/pdksRules.ts` · `convex/lib/pdksRules.ts` · `convex/lib/pdksDay.ts` ·
`convex/lib/pdksWorkDay.ts` · `convex/lib/pdksCalc.ts` · `convex/lib/pdksPayroll.ts` · `convex/lib/pdksTableQuery.ts` · `convex/lib/pdksPayrollQuery.ts` · `convex/lib/pdksEvidence.ts` · `convex/lib/pdksTable.ts` · `convex/lib/pdksDetail.ts` ·
`convex/lib/report*.ts` · yeni `convex/lib/pdksPunchPairs.ts` · `src/components/settings/sections/components/pdksRules*.ts(x)` +
`PdksRulesSettings.tsx` · bunların testleri + yeni test dosyaları. Gerekirse başka dosya için `ask` ile sor.
DOKUNMA: `src/components/pdks/settings/**`, `src/pages/**`, `convex/settings.ts`, `convex/lib/workingDays.ts`.

## Kapsam dışı
Okumaların kendisini değiştirmek · Kart Okumaları ekranı · ara çıkış listesini PDKS detayında göstermek (raporla öner) · mobil.

## Testler (zorunlu)
- Saf: 08:00 G, 12:00 Ç, 13:00 G, 17:00 Ç → 480 dk; tekrar okutma (08:00 G, 08:00:30 G) tek; açık kalan giriş → eksik çıkış;
  yönsüz dönüşümlü; min aralık.
- Geriye uyum: mevcut golden/eşdeğerlik testleri (`convex/w5aLegacyEquivalence.test.ts`, `convex/lib/pdksFlexible.test.ts` vb.) DEĞİŞMEDEN yeşil.
- Entegrasyon: aynı gün iki sürüm sınırı (eski gün firstLast, yeni gün eachPunch); gece vardiyasında çiftler doğru güne.
- UI: seçim publish payload'ına gider; özet metni.

## Rapor
`/tmp/pdks-2d-rapor.md`. Davranış değişikliği: yalnız "Her giriş/çıkışı topla" seçen projede, seçilen tarihten itibaren.
Kademe: K2. Model `gpt-6.1-sol` effort `medium` (2c'nin altyapısı hazır olduğu için).

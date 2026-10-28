# Geçiş Kontrol Dalga 1 — D: Yetki Durumu rozet = filtre = sayaç (03-H2)

## Hedef
Yetki Durumu'nda bir kaydın rozetinde görünen durum, Durum filtresi, sayaçlar ve "Hatalıları yeniden dağıt" kapsamı aynı değeri (saklanan `state`) esas alır; "güncel değil" ve "kapı çözülemedi" durumları ayrı uyarı etiketi olarak görünür.

## Ownership (yalnız bunlar)
- convex/accessGrantStatus.ts (+ convex/accessGrantStatus.test.ts)
- src/components/access-control/unified/status/model.ts
- src/components/access-control/unified/status/StatusViews.tsx
- src/components/access-control/unified/status/status.test.tsx, StatusResults.test.tsx
Kapsam dışı: RunNotice.tsx, StatusPage.tsx, StatusFilters.tsx, StatusCounters.tsx, RedistributeControls.tsx (başka worker / sonraki dalga), DB şeması, cihaz gönderim mantığı.

## İstenenler
1. `grantBadge` (status/model.ts:56): label HER ZAMAN `labels[row.state]`; `stale` artık label'ı Bekliyor'a çevirmez. Tone yalnız `state`'ten gelir. `stale: true` ise mevcut ayrı "Güncel değil" etiketi kalır (StatusViews.tsx:20), title/hint: "Kural veya şablon cihaza gönderildikten sonra değişti; yeniden dağıtın."
2. convex/accessGrantStatus.ts `enrich` (≈satır 50): `door_io_unresolved` durumunda `state`'i "failed"e ÇEVİRME. Bunun yerine `doorUnresolved: true` alanı döndür (kayıt kendi `state`'ini korur). UI'da GrantBadge yanında ayrı uyarı etiketi "Kapı eşleşmedi" + hint "Kuralın kapı seçimini düzeltin; yeniden göndermek bunu çözmez." Teknik `door_io_unresolved: ... ioId` metni kullanıcıya gösterilmez.
3. Böylece filtre (`args.state`), sayaçlar (counts) ve "Hatalıları yeniden dağıt" saklanan `state` ile aynı kalır; ekstra filtre/sayaç mantığı gerekmez. Eğer counts/listByEmployee/diğer sorgularda aynı override varsa aynı şekilde düzelt (`convex/accessGrantStatus.ts` içinde ara).
4. Dönüş tipi değişikliği frontend'de `FunctionReturnType` ile tiplenir; `any` yok.

## Kabul
- convex test: kapı çözülemeyen kayıt `state` "effective" kalır ve `doorUnresolved: true` döner; `state: "failed"` filtresinde gelmez.
- UI test: `grantBadge({state:"effective", stale:true})` label "Etkin" (ya da labels.effective), `stale: true`.
- UI test: `doorUnresolved` olan satırda "Kapı eşleşmedi" etiketi görünür, teknik `ioId` metni görünmez.
- Kapılar: tsc app + tsc convex + eslint + `vitest run convex/accessGrantStatus.test.ts src/components/access-control/unified/status`.
- Not: backend değişikliği canlıya yayınla gelir (yayın koordinatörde); sen yayın yapma.

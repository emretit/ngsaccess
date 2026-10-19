# C3-rules: Geçiş kuralı üye/cihaz listesini sınırla + farka dayalı (diff) kaydet
ÖNCE `.claude/orca-specs/c3-common.md` oku. Bağlam: `.claude/orca-specs/reports/c2b-05-api.md`, `c2b-05-ui.md`, `docs/ui-scan/PLAN.md` C3.

## Sorun
`convex/accessRules.ts:533` `getDetails` kuralın üye ve cihazlarını sınırsız `.collect()` ile döndürür (büyük kuralda okuma limiti/kota riski).
Kural editörü bu tam listeyi alıp `updateWithGroups` (`:891`) ile TAM listeyi geri yazar: liste kırpılırsa ya da editör açıkken başka admin
üye eklediyse, kayıt o üyeleri SİLER (kör üzerine yazma). C2b'de bu yüzden sınır bilerek ertelendi.

## Hedef (test edilebilir)
1. Editör üyeleri/cihazları TAM liste değil FARK olarak kaydeder (eklenen/çıkarılan id'ler); sunucu yalnız farkı uygular → editör açıkken
   başkasının eklediği üye korunur (saf mantık testiyle kanıtla).
2. `getDetails`'in üye/cihaz okuması sınırlı (`take(N)` + `membersTruncated`/`devicesTruncated` gibi dürüst bayrak); editör üye listesini
   görüntülemek için mevcut cursor'lı `listRuleMembers` (`:574`) kullanır, eksik listeyle hiçbir şey silinemez.
3. Eski imzalar çalışır: `updateWithGroups` tam liste yolu korunur, AMA sunucudaki üye sayısı getDetails sınırını aşıyorsa ve istemci tam liste
   gönderiyorsa silmeden önce güvenli davranış seç (ör. kırpılmış görünümle gelen silmeyi reddet ConvexError `RULE_MEMBERS_TRUNCATED`) — tasarım
   kararını raporla gerekçelendir.
4. Hikvision/IDE senkron tetikleri (mevcut `updateWithGroups` sonrası ne tetikleniyorsa) diff yolunda da aynen tetiklenir; yalnız değişen
   üyeler için gereksiz tam yeniden gönderim yapılmaz ama eksik gönderim de olmaz (mevcut davranışı oku, koru).

## Ownership
`convex/accessRules.ts` · yeni `convex/lib/accessRuleDiff.ts` (+test) · `src/components/access-control/unified/**` ·
`src/hooks/access-rules/**` (buradaki `use-toast` kullanımlarını da `notify`'a çevir: `useGroupDeviceMutations.ts`, `useGroupMemberMutations.ts`) ·
`src/hooks/useAccessRules.ts` (legacy sorgu yalnız mutation için çağrılıyorsa temizle) · `convex/_generated/api.d.ts` (yalnız kendi satırın).

## Kapsam dışı
Şema değişikliği (gerekirse `ask`), Hik/IDE senkron motorunun içi, Geçiş Kontrol sayfa düzeni.

## Rapor
`.claude/orca-specs/reports/c3-rules.md`: yeni mutation/arg TAM tipleri, hata kodları, eski istemci davranışı, test listesi, koordinatörün gerçek
oturumda deneyeceği akış (iki sekmede aynı kural: birinde üye ekle, diğerinde eski editörle kaydet → eklenen üye korunmalı).

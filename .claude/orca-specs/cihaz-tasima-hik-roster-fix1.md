# Fix 1 — Hik roster eşitleme: kayıt bağlamında boş beklenen küme + çevrimdışı cihazda tekrar

Önceki iş: `.claude/orca-specs/cihaz-tasima-hik-roster.md` (rapor `/tmp/cihaz-tasima-rapor.md`). Koordinatör diff okudu, 2 düzeltme:

## E1 (ENGEL) — asıl senaryoda açık kapanmıyor
Taşıma = cihazı A'dan sil → B'de yeniden ekle. Kayıt anında cihazın kapıları YENİ oluşturulmuştur → B'de bu kapıları hedefleyen
kural genelde yoktur → `getExpectedRoster` boş küme döner → `planHikRosterReconcile` "expected_empty" ile silmeyi atlar →
A'nın kişileri cihazda kalır. Kullanıcıya gösterilen metin ("eklerken cihazdaki eski kişiler temizlenir") yanlış olur.
**Düzeltme:** action'a tetik bağlamı ekle: `reason: v.union(v.literal("register"), v.literal("manual"))` (ad serbest, ama
iki mod olsun). `register` bağlamında (yalnız `runBackfillDeviceFromGroups` tetiği) dolu cihaz + boş beklenen küme →
SİLMEYE İZİN VER (yeni eklenen cihazda sistem tek doğruluk kaynağıdır; backfill'in zamanladığı yazımlar zaten DB'den gelen
beklenen kümede). `manual` bağlamında mevcut sigorta aynen kalır. `expected_unavailable` / `invalid_identity` / sayfalama
sigortaları İKİ bağlamda da aynen kalır (hesaplanamayan küme asla silme yetkisi değildir). Saf fonksiyona
`allowEmptyExpected: boolean` parametresi ekle; testleri güncelle (register'da boş küme → tümü silinir; manual'da → skip).

## D1 — cihaz kayıt anında çevrimdışıysa eşitleme hiç olmuyor
`addDeviceToGateway` cihaz ISUP'a bağlanmadan da başarılı olabilir; o an `searchPersonOnDevice` başarısız → tek koşum
`device_roster_unavailable` ile biter, tekrar yok → açık sessizce kalır.
**Düzeltme:** yalnız `register` bağlamında, `device_roster_unavailable` (ve `incomplete_device_roster`) sonucunda kendini
`ctx.scheduler.runAfter` ile tekrar zamanla: `attempt` argümanı (opsiyonel, varsayılan 0), gecikmeler ~1, 5, 15, 30, 60 dk
(en çok 5 tekrar). Son deneme de başarısızsa mevcut `internal.devices.setHikOfflineHint` ile cihaza görünür not yaz:
"Cihazdaki eski kişiler temizlenemedi (cihaz çevrimdışı). Cihaz çevrimiçi olunca destekle iletişime geçin." (devices.ts'i
DEĞİŞTİRME, yalnız çağır.) `device_changed` / `unsupported_device` / `device_scope_unavailable` → tekrar YOK.

## D2 (küçük) — silme başına tam yeniden hesap
Her silmeden önce `getExpectedRoster` tam koşuyor (500 silmede 500 ağır sorgu). Yeniden hesabı her 25 silmede bir yap
(ilk silmeden önce bir kez + her 25'te); proje/devIndex değişim kontrolü aynı kalsın.

## Ownership
Önceki işin dosyaları (aynı liste). Yeni dosya yok. `convex/devices.ts` DEĞİŞMEZ.

## Kapılar (hepsi yeşil, sayıları rapora yaz)
`tsc` app + convex · `eslint <değişen dosyalar>` · TAM `vitest run` · `node scripts/find-node-leak.mjs`.
commit/push/deploy/canlı çağrı YOK. Rapor: `/tmp/cihaz-tasima-fix1-rapor.md` (≤20 satır, file:line). worker_done ≤10 satır.

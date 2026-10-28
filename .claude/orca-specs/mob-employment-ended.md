# MOB: EMPLOYMENT_ENDED mobil karşılığı (Flutter)

## Hedef (test edilebilir)
`EMPLOYMENT_ENDED` kodu (a) login'de "İşten ayrıldınız" metniyle gösterilir (ProtocolError değil), (b) açık oturumda herhangi bir employee-authed çağrıda alınınca oturum kapanır, token + hassas ekran durumu temizlenir, polling durur, kullanıcı login'e döner ve aynı metni görür; regresyon testleriyle kanıtlı.

## Backend sözleşmesi (f4d8787d, yayın bekliyor — DEĞİŞTİRME)
- Kod `"EMPLOYMENT_ENDED"`, sunucu mesajı "İşten ayrıldığınız için mobil erişiminiz kapatıldı".
- `employeeAuth.signIn`: başarı zarfında `{ error: { code: "EMPLOYMENT_ENDED", message } }` (INVALID_CREDENTIALS / RATE_LIMITED ile aynı biçim). Yalnız şifre doğruysa; yanlış şifrede INVALID_CREDENTIALS.
- Açık oturum: tüm employee-authed query/mutation (me, checkIn, requestOpen, attendance…) ConvexError data `{ code: "EMPLOYMENT_ENDED", message }`. Bitiş tarihli pasif kişide EMPLOYEE_INACTIVE yerine geçer; bitişsiz pasif kişi hâlâ EMPLOYEE_INACTIVE (davranışı korunmalı).
- signOut etkilenmez.
- Denetçi notu (DÜZELT-1): `docs/mobile-release/specs/employment-ended-denetim-20261022.md` — ÖNCE OKU.

## Bilinen dokunma noktaları
- `mobile/lib/repositories/auth_repository.dart` `_throwStructuredError` default kolu bugün ProtocolError (~:165/:189).
- `mobile/lib/core/response_decoder.dart` `_authCodes` (~:62).
- `mobile/lib/core/errors.dart` `normalizeBusinessCode` (~:143), `userMessage`.
- error localizer (`error_localizer.dart`, yerini bul) + `mobile/lib/l10n/app_tr.arb`, `app_en.arb` (+ `flutter gen-l10n` üretilen dosyalar).
- Oturum düşüşü yolu (auth provider / bootstrap): bugün bu kodda genel "Beklenmeyen bir hata", polling sürüyor, bootstrap retryableFailure'a gidiyor — bunu düzelt.

## Ownership (yalnız bunlara yaz)
`mobile/lib/**` (yukarıdaki dosyalar + gerekirse auth provider/bootstrap), `mobile/lib/l10n/**`, `mobile/test/**` (yeni/ilgili testler). Başka hiçbir yere yazma.

## Kapsam dışı
`convex/**`, `src/**`, `docs/**`, `.claude/**`, bağımlılık/pubspec değişikliği, native (ios/android) dosyalar, UI yeniden tasarımı.

## Kapılar (mobile/ dizininden, SIRAYLA — Flutter komutlarını paralel çalıştırma)
1. `flutter gen-l10n` (arb değiştiyse)
2. `python3 scripts/check_l10n.py`
3. `flutter analyze --no-pub` → 0 sorun
4. `flutter test --no-pub` → tam suite yeşil (önceki 505 test + yeniler)

## Zorunlu testler
- Login: signIn `{error:{code:"EMPLOYMENT_ENDED"}}` → ProtocolError DEĞİL, kullanıcıya TR "İşten ayrıldınız…" metni.
- Açık oturum: me/başka authed çağrı EMPLOYMENT_ENDED → oturum temizlenir (token silinir), login'e dönüş, metin görünür, polling/yeniden deneme yok.
- EMPLOYEE_INACTIVE mevcut davranışı değişmedi.
- TR/EN parity.

## Yasaklar
commit / push / deploy / migration / DB yazma YOK. Canlı backend'e çağrı YOK. `.env` okuma/yazdırma YOK.

## Rapor
`worker_done`'da ≤10 satır: değişen dosyalar (file:line), eklenen test adları, 4 kapının son çıktı satırı.

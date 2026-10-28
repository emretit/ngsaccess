# DENETİM: MOB EMPLOYMENT_ENDED Flutter diff (salt okuma)

## Hedef
`git diff -- mobile` (23 dosya, Codex yazdı) aşağıdaki sözleşmeye uyuyor mu; ENGEL/DÜZELT/NOT listesi.

## Sözleşme (backend f4d8787d, değişmez)
- Kod "EMPLOYMENT_ENDED". signIn: başarı zarfında `{error:{code:"EMPLOYMENT_ENDED",message}}` (INVALID_CREDENTIALS biçimi) → login'de "İşten ayrıldınız" metni, ProtocolError DEĞİL.
- Açık oturum: tüm employee-authed çağrılar ConvexError data `{code:"EMPLOYMENT_ENDED"}` → oturum düşer: token silinir, hassas ekran durumu (ziyaretçi/geçmiş/kapı) temizlenir, polling durur, bootstrap retryableFailure'a gitmez, login'de metin görünür.
- EMPLOYEE_INACTIVE mevcut davranışı DEĞİŞMEMELİ. signOut etkilenmez. TR/EN l10n parity.
- Denetçi notu: docs/mobile-release/specs/employment-ended-denetim-20261022.md (DÜZELT-1) — oku, karşılandı mı söyle.

## Özellikle bak
1. Oturum düşüşü HER authed çağrı yolunda mı (me, attendance polling, door requestOpen, visitor provider, history)? Kaçan yol var mı?
2. Visitor create intent store / door intent store: logout sırasındaki mevcut kapsam-kuralı korunuyor mu (PII temizlenir, metadata kendi kapsamında kalır)?
3. Yanlış yerde terminal sayılma riski (ör. EMPLOYMENT_ENDED olmayan iş hataları oturumu düşürüyor mu)?
4. Testler gerçekten davranışı mı ölçüyor (mock'u değil)?
5. Gereksiz/kapsam dışı değişiklik (convex_config.dart, main.dart, home_screen.dart neden değişti?).

## Kurallar
SALT OKUMA: hiçbir dosyaya yazma. git add/commit/stash/reset/checkout YASAK. flutter/dart komutu ÇALIŞTIRMA (SDK kilidi koordinatörde). Canlı backend çağrısı yok.

## Rapor
worker_done'da ≤15 satır: her bulgu ENGEL/DÜZELT/NOT + file:line + tek cümle neden. Bulgu yoksa "ENGEL 0 / DÜZELT 0".

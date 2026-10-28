# DENETİM (salt okuma): MOB 1.0.5 iki değişiklik

## Hedef
`git status --short mobile` + `git diff -- mobile` (commit'siz; Codex yazdı) için ENGEL/DÜZELT/NOT listesi.

## İş 1 — ziyaretçi formu bayat saat
Spec: `.claude/orca-specs/mob-v105-visitor-stale-time.md`. Dosyalar: `mobile/lib/screens/visitor/visitor_form_screen.dart`, `mobile/test/visitor_form_time_test.dart`.
Bak: yalnız yeni davet + saat elle seçilmemişken mi kayıyor? Düzenleme/pending/kurtarma (requestId, taslak) akışı etkilenmiyor mu? Saat/tarih seçici, 31 gün sınırı, gece yarısı/TR saat dilimi; resume dinleyicisi dispose ediliyor mu; testler davranışı mı ölçüyor?

## İş 2 — marka açılış ekranı
Spec: `.claude/orca-specs/mob-v105-launch-screen.md`. iOS LaunchImage + LaunchScreen.storyboard; Android launch_background.xml (drawable, drawable-v21), launch_logo.png yoğunlukları, drawable-nodpi/launch_logo_android12.png, values-v31 + values-night-v31/styles.xml.
Bak: storyboard constraint/ölçek doğru mu (logo taşmaz, safe area), Android 12 splash ikon boyut kuralı (ikon 2/3 daire içinde kalmalı, 288dp/1024px), values-v31 temaları mevcut LaunchTheme/NormalTheme adlarıyla uyumlu mu, mevcut night temayla çelişki, app ikonu (AppIcon/ic_launcher) değişmedi mi. Görselleri Read ile açıp gözle kontrol et.

## Kurallar
SALT OKUMA: dosyaya yazma. git add/commit/stash/reset/checkout YASAK. flutter/gradle/xcodebuild ÇALIŞTIRMA (SDK kilidi koordinatörde).

## Rapor
worker_done'da ≤15 satır: ENGEL/DÜZELT/NOT + file:line + tek cümle. Yoksa "ENGEL 0 / DÜZELT 0".

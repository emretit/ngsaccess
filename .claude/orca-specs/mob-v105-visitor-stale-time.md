# MOB 1.0.5 — Ziyaretçi formunda bayat başlangıç saati (Flutter)

## Hedef (test edilebilir)
Yeni ziyaretçi formu uzun süre açık kalıp (ör. 2 saat) sonra kaydedildiğinde, kullanıcı saatleri ELLE değiştirmediyse başlangıç/bitiş geçmişte kalıp "geçersiz form" hatası vermez: varsayılan başlangıç gönderim anında ve uygulama öne geldiğinde "şimdi"ye, bitiş aynı süreyle ileri kayar; widget testiyle kanıtlı.

## Bağlam
`mobile/lib/screens/visitor/visitor_form_screen.dart`: `_start = ... ?? DateTime.now()` (~:51-57) yalnız initState'te; gönderimde `!_end.isAfter(DateTime.now())` (~:156) → uzun açık formda kullanıcı açıklamasız `visitorInvalidForm` snackbar görür. Canlıda gözlendi (iOS, form 20:47'de açık kaldı, 22:54'te başlangıç geçmişte).

## Kurallar
- Yalnız YENİ davet ve kullanıcı saat seçmediyse kaydır (ayrı bir "times touched" bayrağı). Düzenleme (`visitor != null`) ve kurtarma/pending (`pending != null`, `_uncertain`) akışlarına DOKUNMA — requestId/taslak bütünlüğü korunur.
- Kaydırma: start < now ise start = now (dakikaya yuvarla), end = start + (orijinal end - start). 
- Uygulama resume'da (mevcut lifecycle deseni varsa onu kullan) ve submit'te uygula; UI'da görünen saat güncellenir.
- Kullanıcı saat seçtiyse eski davranış aynen kalır.

## Ownership (yalnız bunlara yaz)
`mobile/lib/screens/visitor/visitor_form_screen.dart`, `mobile/test/**` (yeni/ilgili visitor form testi). Gerekirse aynı klasördeki küçük yardımcı. Başka dosya yok.

## Kapsam dışı
Backend, l10n metin değişikliği (gerekirse sor), visitor provider/intent store, tasarım.

## Kapılar (mobile/ dizininden, sırayla)
1. `flutter analyze --no-pub` → 0
2. `flutter test --no-pub test/<ilgili dosyalar>` → yeşil
3. `flutter test --no-pub` → tam suite yeşil
(Flutter komutlarını paralel çalıştırma.)

## Zorunlu testler
- Saat elle seçilmemiş + "now" 3 saat ileri (saat enjeksiyonu: test edilebilir clock yoksa minimal bir `DateTime Function() now` parametresi ekle, varsayılan DateTime.now) → submit geçerli, start >= now, süre korunur.
- Saat elle seçilmiş → kaydırma yok (mevcut doğrulama aynen).
- Düzenleme ve pending/kurtarma akışında kaydırma yok.

## Yasaklar
git add / commit / stash / reset / checkout YASAK. push/deploy/DB yazma YOK. Canlı backend'e çağrı YOK. `.env` okuma YOK.

## Rapor
worker_done'da ≤10 satır: değişen dosyalar (file:line), test adları, kapıların son satırı.

# Mobil test sadeleştirme Faz 1

Sonuç: başarılı. 8 dosya silindi (2 düşük değerli dosya + 6 sprint dosyası), 6 case doğrudan silindi, 1 case mevcut case'e birleştirildi; görünür case sayısı 240 → 233 (−7). 53 case bağımsız olarak taşındı; ek 1 case'in odak/error assertion'ları mevcut request case'ine aktarıldı. Matrisler değiştirilmedi.

## Adımlar ve kanıt

- YAPILDI: `test/theme/color_scheme_contract_test.dart:7,109` düz `rm` ile silindi (2 case). `test/theme/app_theme_test.dart` ve `app_ui_tokens_test.dart` değişmedi, toplam 8 case yeşil.
- YAPILDI: `test/widgets/responsive_container_test.dart:15,39` düz `rm` ile silindi (2 case).
- ATLANDI: `test/visitor_widgets_test.dart:398` (döngüler açıldığında 4 case). `test/ui_redesign/d3b/visitor_layout_test.dart:93-207` liste/form/detail için her iki temada 320dp/%200 kapsıyor, ancak silme adayındaki filtre açma/kapatma akışını kapsamıyor. Dosya değişmedi, 14 case korundu.
- YAPILDI: `test/ui_redesign/d1/fix1_test.dart:12-42` mount davranışı aynen `test/helpers/ui_mount.dart:6` konumuna taşındı. Grep ile bulunan beş import güncellendi; silinen üç dosyanın importları silinmeden önce de güncellendi. Kalıcı tüketiciler `test/ui_redesign/d1/metric_row_layout_test.dart:6`, `test/ui_redesign/acceptance/kit_completion_test.dart:11` ve yeni hedefler; silinmiş helper importu kalmadı.
- YAPILDI: fix1 31 case → 30 case taşındı: kit 26 (`test/ui_redesign/d1/ui_kit_test.dart:568`), tarih 3 (`test/ui_redesign/d1/app_date_format_test.dart:110`), nav 1 (`test/widgets/app_bottom_navigation_test.dart:185`). Yalnız kaynak `:576-615` RV1-16 Ink/Material/12dp case'i silindi. Kaynak düz `rm` ile silindi.
- YAPILDI: d2_review 11 case → 11 case (`test/ui_redesign/d1/ui_kit_test.dart:1044`); kaynak düz `rm` ile silindi.
- YAPILDI: date_range_field 1 case → 1 case (`test/ui_redesign/d1/ui_kit_test.dart:1313`); `_DraftRange` ve grup içindeki Roboto setup korundu; kaynak düz `rm` ile silindi.
- YAPILDI: kit_d3_additions 7 case → 6 case. İki metrik case'i `test/ui_redesign/d1/metric_row_layout_test.dart:122`, iki counter ve iki supporting-row case'i `test/ui_redesign/d1/ui_kit_test.dart:1360` konumlarına taşındı. Kaynak `:57` dikey metrik case'i, hedef `metric_row_layout_test.dart:66` ample-width/%200 dikey politika güvencesiyle aynı olduğu için silindi. Roboto kurulumları gruplarda korundu; kaynak düz `rm` ile silindi.
- YAPILDI: request_behavior 3 case → 2 ayrı case (`test/widgets/requests_screen_test.dart:414`) + ilk-geçersiz-alan odak/error assertion'ları mevcut correction case'ine eklendi (`:334`). Busy callback/back ve covered-route case'leri kendi orijinal provider/app harness'larıyla grup içinde korundu; kaynak düz `rm` ile silindi.
- YAPILDI: feedback 3 case → login odak 1 (`test/widgets/login_screen_test.dart:360`), nav Tab+Enter/selected semantics 2 (`test/widgets/app_bottom_navigation_test.dart:235`). 44/64dp ve token assertion'ları da korundu; kaynak düz `rm` ile silindi.
- Taşınan gruplar ui_kit görsel matrisine sokulmadı. Login ve request mevcut harness'ları ayrı kardeş gruplara alındı; böylece mevcut setUp/tearDown taşınan bağımsız harness'a sızmıyor. İlk hedef koşusunda ortaya çıkan eski auth'un tekrar dispose edilmesi bu kapsam izolasyonuyla giderildi; finalde hata yok.

## Kapılar

1. ÖNCE: `flutter test --reporter json test/ui_redesign/d1 test/ui_redesign/d3a/request_behavior_test.dart test/ui_redesign/d5 test/widgets/requests_screen_test.dart test/widgets/login_screen_test.dart test/widgets/app_bottom_navigation_test.dart test/theme test/widgets/responsive_container_test.dart test/visitor_widgets_test.dart test/ui_redesign/acceptance` → exit 0, 240 görünür testDone, tamamı başarılı.
2. Taşımalardan sonra, kaynaklar silinmeden altı hedefin hepsi koşuldu: `flutter test --reporter json test/ui_redesign/d1/ui_kit_test.dart test/ui_redesign/d1/app_date_format_test.dart test/ui_redesign/d1/metric_row_layout_test.dart test/widgets/app_bottom_navigation_test.dart test/widgets/login_screen_test.dart test/widgets/requests_screen_test.dart` → exit 0, 199/199.
3. `flutter analyze test` → exit 0, `No issues found!`.
4. SONRA: `flutter test --reporter json test/ui_redesign/d1 test/ui_redesign/d5 test/widgets/requests_screen_test.dart test/widgets/login_screen_test.dart test/widgets/app_bottom_navigation_test.dart test/theme test/visitor_widgets_test.dart test/ui_redesign/acceptance` → exit 0, 233/233 görünür testDone. Silinen dosya yolları çıkarıldı; boş d5 klasörü diğer yollarla birlikte sorunsuz toplandı.
5. İsim envanteri karşılaştırması: yalnız beklenen 7 eski case adı eksik, beklenmeyen eksik/fazla yok (`mobile-counts.json`). Kaybolan request adı mevcut case'e birleşti; tüm benzersiz odak/error kontrolleri korundu.
6. Tam `flutter test` çalıştırılmadı; koordinatöre bırakıldı. Üretim kodu ve ownership dışındaki dosyalara yazılmadı; git index/commit işlemi yapılmadı.

| Hedef | Önce | Taşıma sonrası / final |
|---|---:|---:|
| d1/ui_kit_test.dart | 101 | 143 |
| d1/app_date_format_test.dart | 4 | 7 |
| d1/metric_row_layout_test.dart | 7 | 9 |
| widgets/app_bottom_navigation_test.dart | 6 | 9 |
| widgets/login_screen_test.dart | 14 | 15 |
| widgets/requests_screen_test.dart | 14 | 16 |

Loglar: `/tmp/test-slim/faz1/mobile-before.jsonl`, `mobile-destinations.jsonl`, `mobile-after.jsonl`, `mobile-analyze.txt`, `mobile-counts.json`. Kalan: koordinatörün tam suite koşusu ve commit'i.

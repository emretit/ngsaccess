# Mobil test sadeleştirme adayları (mobile/test + mobile/screenshot_test)

## Özet
- Envanter: 79 dosya / 560 case. Aday: 22 dosya. Gerçek case azalması küçük: **~8–12 case silinir**; asıl kazanç **dosya sayısı −9** (birleştirme) ve **süre** (parametre matrislerini daraltma).
- Süre: `flutter.jsonl` kısmi (42 suite; koşu sürüyordu), süreler testStart→testDone toplamı. En yavaşlar: app_composition 329s, visitor_widgets 239s, visitor_recovery_widgets 159s, visitor_form_time 157s, d2b/presentation 146s, d1/d2_review 87s, d2b/splash 81s.
- `screenshot_test/` standart `flutter test` içinde koşmaz (README: "yalnız test/ paketidir"); süre kazancı sağlamaz → aday değil.
- En büyük 5 kazanç:
  1. `test/integration/app_composition_test.dart` — 329s; dil döngüleri + router testiyle çakışan 4 senaryo.
  2. `test/ui_redesign/d2b/presentation_test.dart` + `splash_screen_test.dart` — 227s / 3 case; matris daralt (screenshot matrisi zaten kapsıyor).
  3. `test/visitor_widgets_test.dart` — 239s; 320px/200% reflow case'i d3b/visitor_layout ile çift.
  4. d1/d3a/d3b `fix1*`, `d2_review`, `kit_d3_additions`, `date_range_field` — 6 sprint-adlı dosya ana dosyalara gider (−6 dosya, süre aynı).
  5. `test/theme/color_scheme_contract_test.dart` (211 satır) + `responsive_container_test.dart` — 4 case, düşük değer.
- KORU (aday yapılmadı): auth/oturum/yetki (auth_provider, auth_repository, session_store), door_operation_*, response_decoder, safe_diagnostics, attendance_* (PDKS gün sınırı), device_test, preferred_device, visitor_provider/create_recovery (PII sızıntısı, hesap geçişi), d3b/turkey_time (saat dilimi regresyonu).

## Tablo

### SİL (düşük risk)
| Eylem | Dosya | Case | Gerekçe | Kanıt | Risk |
|---|---|---|---|---|---|
| SİL | test/theme/color_scheme_contract_test.dart | 2 | 46 rolün hex değerini tasarım dokümanından kopyalayıp pinliyor; renk değişince test değişir, davranış yakalamaz. Kontrast güvencesi ayrı testte var. | color_scheme_contract_test.dart:7,109; kontrast: theme/app_theme_test.dart:18,30 | düşük |
| SİL | test/widgets/responsive_container_test.dart | 2 | Tek widget'ın maxWidth clamp'i (trivial); widget home/profile'da kullanılıyor, ekran testleri ve screenshot matrisi görünür kırılmayı yakalar. | responsive_container_test.dart:15,39; kullanım lib/screens/home/home_screen.dart:104, profile_screen.dart:69,486 | düşük |
| SİL (1 case) | test/ui_redesign/d1/kit_d3_additions_test.dart "metric labels stay vertical at 200%" | 1 | metric_row_layout_test'teki politika testinin aynısı (200% ölçek → dikey, genişlikten bağımsız). | kit_d3_additions_test.dart:57 ↔ metric_row_layout_test.dart:66; ayrıca fix1_test.dart:355 | düşük |
| SİL (1 case) | test/visitor_widgets_test.dart "visitor list, filter and form reflow at 320px / 200%" | 1 | d3b/visitor_layout_test aynı ekranları 320dp/200% dahil modlarla tarıyor. | visitor_widgets_test.dart:398 ↔ d3b/visitor_layout_test.dart:93 | düşük |

### BİRLEŞTİR (sprint-adlı → ana dosya)
| Eylem | Dosya | Case | Gerekçe | Kanıt | Risk |
|---|---|---|---|---|---|
| BİRLEŞTİR → d1/ui_kit_test.dart | d1/fix1_test.dart | 18 | Sprint adı (RV1-xx); aynı UI kit'i test ediyor. Önce `mount` yardımcısını `test/helpers/` altına taşı (4 dosya import ediyor). | fix1_test.dart:1-10; `show mount`: d2_review_test.dart:6, kit_d3_additions_test.dart:6, acceptance/kit_completion_test.dart:11 | düşük |
| BİRLEŞTİR → d1/ui_kit_test.dart | d1/d2_review_test.dart | 8 | Sprint adı (RV2-xx), 87s; sheet/dialog/radio/metric kit davranışı. | d2_review_test.dart:11,77,96,124,156,182,210,231 | düşük |
| BİRLEŞTİR → d1/ui_kit_test.dart | d1/kit_d3_additions_test.dart | 4 (5−1) | "additions" eki; kit alanları (text field counter, list row supporting). | kit_d3_additions_test.dart:33,73,92,105 | düşük |
| BİRLEŞTİR → d1/ui_kit_test.dart (fix1 RV1-13 bölümü) | d1/date_range_field_test.dart | 1 | Tek case, aynı RV1-13 etiketi fix1'de var. | date_range_field_test.dart:37 ↔ fix1_test.dart:478,508,533 | düşük |
| BİRLEŞTİR → widgets/history_screen_test.dart (+layout bölümü) | d3a/fix1_regression_test.dart | 7 | Sprint adı; zaten history_screen_test fixture'larını `show` ile ödünç alıyor. | fix1_regression_test.dart:15-18 | düşük |
| BİRLEŞTİR → widgets/requests_screen_test.dart | d3a/request_behavior_test.dart | 3 | Talep formu davranışı; ana dosya zaten fixture sağlıyor. | request_behavior_test.dart:15 (RequestFakeRepository) | düşük |
| BİRLEŞTİR → visitor_widgets_test.dart | d3b/fix1_test.dart | 8 | Sprint adı (RV3B-xx); `app` ve provider fixture'larını visitor_widgets/visitor_provider testinden alıyor. | d3b/fix1_test.dart:15-17 | düşük |
| BİRLEŞTİR → widgets/home_screen_test.dart / qr_scan_screen_test.dart | d2a/qr_open_intent_test.dart | 2 | Küçük, ana ekran/QR kapsamının parçası. | qr_open_intent_test.dart:27,35 | düşük |
| BİRLEŞTİR → widgets/login_screen_test.dart / app_bottom_navigation_test.dart | d5/feedback_test.dart | 2 | Küçük; login odak + alt bar QR odağı. | feedback_test.dart:14,78 | düşük |
| BİRLEŞTİR → models/attendance_summary_contract_test.dart | models/attendance_summary_test.dart | 3 | Aynı model/decoder; "toplam tutarsızlığı reddi" iki yerde. Case birleşmesi mümkün (PDKS: davranış silme, yalnız fixture ortakla). | attendance_summary_test.dart:36 ↔ attendance_summary_contract_test.dart:138 | orta |
| BİRLEŞTİR → core/attendance_date_test.dart | ui_redesign/d1/app_date_format_test.dart | 4 | "Turkey midnight" iki dosyada; tek tarih/gün sınırı dosyası. Case SİLME, yalnız dosya taşı (gün sınırı = PDKS). | app_date_format_test.dart:10 ↔ attendance_date_test.dart:6 | orta |
| BİRLEŞTİR → core/error_localizer_test.dart | core/request_errors_test.dart | 1 | i18n anahtar varlığı testi (düşük değer); localizer testiyle aynı konu. | request_errors_test.dart:11 | düşük |

### SADELEŞTİR (matris/süre)
| Eylem | Dosya | Case | Gerekçe | Kanıt | Risk |
|---|---|---|---|---|---|
| SADELEŞTİR | integration/app_composition_test.dart | 17 | 329s. `$language` ve `$endpoint` döngülerini tek dile indir (yalnız yerelleştirme case'i iki dil kalsın). Router testiyle çakışan 4 senaryoyu tek yere topla: soğuk link+restore (378 ↔ router:125), login sonrası hedef (397 ↔ router:168), geçici offline restore (468 ↔ router:184), A→B geç restore (440 ↔ router:270). Oturum bitişi/EMPLOYMENT_ENDED KORU. | app_composition_test.dart:288,316,378,397,440,468; router/app_router_integration_test.dart:125,168,184,270 | orta |
| SADELEŞTİR | ui_redesign/d2b/presentation_test.dart | 2 | 146s/2 case; login %130 ve tema sheet seçili durumu için dark×… matrisi; screenshot matrisi (login/profile × tr/en × 130/200%) aynı yüzeyi görüyor. Tek tema/tek ölçeğe indir. | presentation_test.dart:39,86; screenshot_test/screens_screenshot_test.dart:104-151 | düşük |
| SADELEŞTİR | ui_redesign/d2b/splash_screen_test.dart | 1 | 81s/1 case (dark×dil×%200 = 4+ kombinasyon). Splash loading/error screenshot'ta var; aksiyon erişilebilirliği için 1 kombinasyon yeter. | splash_screen_test.dart:10; screens_screenshot_test.dart:129-131 | düşük |
| SADELEŞTİR | ui_redesign/d2a/layout_states_test.dart, d3a/layout_states_test.dart, d3b/visitor_layout_test.dart | 3+3+5 | width×scale×dark×locale taşma matrisleri; ucu bırak (320dp/200% + 390dp/100%). Bu matris screenshot_test'te de var. Erişilebilirlik/erişilebilir-eylem assert'leri kalsın. | d2a/layout_states_test.dart:100,167,224; d3a/layout_states_test.dart:67,164,249; d3b/visitor_layout_test.dart:93 | orta |
| SADELEŞTİR | visitor_form_time_test.dart, visitor_recovery_widgets_test.dart, visitor_widgets_test.dart | 6+6+11 | 157s/159s/239s. recovery_widgets ve create_recovery (provider düzeyi) aynı "receipt reopen / aynı ID retry" senaryolarını iki katmanda koşuyor: widget testlerini yalnız UI'ya özgü olanlara (form kapanması, arka planda erteleme) indir. Provider katmanı KORU (PII/hesap geçişi). | recovery_widgets_test.dart:248,275 ↔ create_recovery_test.dart:314,373; form_time_test.dart:237,268 ↔ create_recovery_test.dart:240 | orta |
| SADELEŞTİR | core/errors_test.dart | 13 | TR adlı "zaten AppError ise döner / Network mesajı non-empty" tipinde trivial case'ler (~5); güvenlik testleri (hassas veri sızmaz) KORU. | errors_test.dart:9,15,20,26,31,134 | düşük |
| SADELEŞTİR / SOR | ui_redesign/acceptance/kit_completion_test.dart | 2 | "QR tolerance" screenshot harness'ını test ediyor; harness emekli edilirse silinir. | kit_completion_test.dart:10,37 | orta |

## Emin değilim (sahibine sorular)
1. `screenshot_test/` (golden matrisi, 2 dosya) hâlâ kullanılıyor mu? Kullanılmıyorsa `kit_completion_test` QR toleransı, d2b ve layout matrisleri de sadeleşir. README: standart koşuda zaten dışarıda.
2. `d3b/turkey_time_test` Türkiye saatinde 2 alt-süreç `flutter test` açıyor (pahalı). Saat dilimi regresyonu için KORU dedim; yine de CI'da yalnız belirli bir job'a mı alınsın?
3. app_composition ↔ router entegrasyonunda 4 çakışma "muhtemel": aynı kapıyı iki harness'te mi (gerçek root vs router) görmek istiyorsunuz? Kontrol etmeden silmedim.
4. Layout/taşma matrislerinde (320/390 × 1.0/1.3/2.0 × dark × tr/en) tüm kombinasyonlar gerekli mi, yoksa uç değerler yeter mi?
5. `l10n/catalog_test` (anahtar envanteri) ve `core/request_errors_test` gibi i18n anahtar testleri tutulsun mu? Placeholder sözleşmesi için catalog_test'i bıraktım.

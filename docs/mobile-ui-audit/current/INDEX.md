# Mevcut mobil ekran görüntüleri

Üretim: `cd mobile && flutter test --no-pub --update-goldens screenshot_test/`

390×844 mantıksal, DPR 2 (780×1688 PNG); uzun görüntüler içerik kadar, en fazla 2400 lp.
Locale tr, MediaQuery güvenli alan üst 47 / alt 34, uygulamanın mevcut AppTheme temaları.
Roboto tüm ağırlıklar ve MaterialIcons SDK’dan, CupertinoIcons paket fontundan yüklenir.
Veriler sentetiktir; kayıt saatleri açık +03:00 ofsetlidir. Ev ekranının tarihi/selamı ve yeni talep tarihleri uygulamada DateTime.now kullandığı için üretim gününe bağlıdır.

Durum kapsamı: empty/loading/error yalnız uygulamanın o ekranda sunduğu durumlar içindir.
Profil ve şifre yardımında veri yükleyen bir ekran durumu yoktur; splash yalnız loading/error sunar.
QR token için empty yoktur; kamera görüntüsü mevcut izin engeli yer tutucusuyla temsil edilir.
Formlar doldurulmuş/boş başlangıç olarak yakalanır; sunucu komutu gönderilmez.
Ana kabuktaki beş alt sekme home/history/qr/visitor/profile görüntülerine dahildir.

| Dosya | Ekran | Durum | Tema | Kaynak dosya | Route | Not |
| --- | --- | --- | --- | --- | --- | --- |
| [login_filled_light.png](login_filled_light.png) | login | filled | light | lib/screens/auth/login_screen.dart:15 | /login |  |
| [login_filled_dark.png](login_filled_dark.png) | login | filled | dark | lib/screens/auth/login_screen.dart:15 | /login |  |
| [forgot_password_filled_light.png](forgot_password_filled_light.png) | forgot_password | filled | light | lib/screens/auth/forgot_password_screen.dart:13 | /forgot-password |  |
| [forgot_password_filled_dark.png](forgot_password_filled_dark.png) | forgot_password | filled | dark | lib/screens/auth/forgot_password_screen.dart:13 | /forgot-password |  |
| [home_filled_light.png](home_filled_light.png) | home | filled | light | lib/screens/home/home_screen.dart:29 | /home | Başlık tarihi/selamı sistem saatini kullanır; Gerçek MainNavigationShell ve seçili alt sekme |
| [home_filled_dark.png](home_filled_dark.png) | home | filled | dark | lib/screens/home/home_screen.dart:29 | /home | Başlık tarihi/selamı sistem saatini kullanır; Gerçek MainNavigationShell ve seçili alt sekme |
| [history_filled_light.png](history_filled_light.png) | history | filled | light | lib/screens/history/history_screen.dart:19 | /history | Gerçek MainNavigationShell ve seçili alt sekme |
| [history_filled_dark.png](history_filled_dark.png) | history | filled | dark | lib/screens/history/history_screen.dart:19 | /history | Gerçek MainNavigationShell ve seçili alt sekme |
| [requests_filled_light.png](requests_filled_light.png) | requests | filled | light | lib/screens/requests/requests_screen.dart:38 | /requests |  |
| [requests_filled_dark.png](requests_filled_dark.png) | requests | filled | dark | lib/screens/requests/requests_screen.dart:38 | /requests |  |
| [visitor_filled_light.png](visitor_filled_light.png) | visitor | filled | light | lib/screens/visitor/visitor_screen.dart:15 | /visitor | Gerçek MainNavigationShell ve seçili alt sekme |
| [visitor_filled_dark.png](visitor_filled_dark.png) | visitor | filled | dark | lib/screens/visitor/visitor_screen.dart:15 | /visitor | Gerçek MainNavigationShell ve seçili alt sekme |
| [visitor_form_filled_light.png](visitor_form_filled_light.png) | visitor_form | filled | light | lib/screens/visitor/visitor_form_screen.dart:11 | /visitor → Navigator.push | Mevcut daveti düzenleme |
| [visitor_form_filled_dark.png](visitor_form_filled_dark.png) | visitor_form | filled | dark | lib/screens/visitor/visitor_form_screen.dart:11 | /visitor → Navigator.push | Mevcut daveti düzenleme |
| [profile_filled_light.png](profile_filled_light.png) | profile | filled | light | lib/screens/profile/profile_screen.dart:21 | /profile | Gerçek MainNavigationShell ve seçili alt sekme |
| [profile_filled_dark.png](profile_filled_dark.png) | profile | filled | dark | lib/screens/profile/profile_screen.dart:21 | /profile | Gerçek MainNavigationShell ve seçili alt sekme |
| [select_device_filled_light.png](select_device_filled_light.png) | select_device | filled | light | lib/screens/settings/select_device_screen.dart:14 | /select-device |  |
| [select_device_filled_dark.png](select_device_filled_dark.png) | select_device | filled | dark | lib/screens/settings/select_device_screen.dart:14 | /select-device |  |
| [qr_filled_light.png](qr_filled_light.png) | qr | filled | light | lib/screens/qr_scan/qr_scan_screen.dart:17 | /qr | Sahte token; kamera yer tutucu, native kamera yok; Gerçek MainNavigationShell ve seçili alt sekme |
| [qr_filled_dark.png](qr_filled_dark.png) | qr | filled | dark | lib/screens/qr_scan/qr_scan_screen.dart:17 | /qr | Sahte token; kamera yer tutucu, native kamera yok; Gerçek MainNavigationShell ve seçili alt sekme |
| [request_leave_form_filled_light.png](request_leave_form_filled_light.png) | request_leave_form | filled | light | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |
| [request_leave_form_filled_dark.png](request_leave_form_filled_dark.png) | request_leave_form | filled | dark | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |
| [request_correction_form_filled_light.png](request_correction_form_filled_light.png) | request_correction_form | filled | light | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |
| [request_correction_form_filled_dark.png](request_correction_form_filled_dark.png) | request_correction_form | filled | dark | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |
| [home_empty_light.png](home_empty_light.png) | home | empty | light | lib/screens/home/home_screen.dart:29 | /home | Başlık tarihi/selamı sistem saatini kullanır; Gerçek MainNavigationShell ve seçili alt sekme |
| [home_loading_light.png](home_loading_light.png) | home | loading | light | lib/screens/home/home_screen.dart:29 | /home | Başlık tarihi/selamı sistem saatini kullanır; Gerçek MainNavigationShell ve seçili alt sekme |
| [home_error_light.png](home_error_light.png) | home | error | light | lib/screens/home/home_screen.dart:29 | /home | Başlık tarihi/selamı sistem saatini kullanır; Gerçek MainNavigationShell ve seçili alt sekme |
| [history_empty_light.png](history_empty_light.png) | history | empty | light | lib/screens/history/history_screen.dart:19 | /history | Gerçek MainNavigationShell ve seçili alt sekme |
| [history_loading_light.png](history_loading_light.png) | history | loading | light | lib/screens/history/history_screen.dart:19 | /history | Gerçek MainNavigationShell ve seçili alt sekme |
| [history_error_light.png](history_error_light.png) | history | error | light | lib/screens/history/history_screen.dart:19 | /history | Gerçek MainNavigationShell ve seçili alt sekme |
| [requests_empty_light.png](requests_empty_light.png) | requests | empty | light | lib/screens/requests/requests_screen.dart:38 | /requests |  |
| [requests_loading_light.png](requests_loading_light.png) | requests | loading | light | lib/screens/requests/requests_screen.dart:38 | /requests |  |
| [requests_error_light.png](requests_error_light.png) | requests | error | light | lib/screens/requests/requests_screen.dart:38 | /requests |  |
| [visitor_empty_light.png](visitor_empty_light.png) | visitor | empty | light | lib/screens/visitor/visitor_screen.dart:15 | /visitor | Gerçek MainNavigationShell ve seçili alt sekme |
| [visitor_loading_light.png](visitor_loading_light.png) | visitor | loading | light | lib/screens/visitor/visitor_screen.dart:15 | /visitor | Gerçek MainNavigationShell ve seçili alt sekme |
| [visitor_error_light.png](visitor_error_light.png) | visitor | error | light | lib/screens/visitor/visitor_screen.dart:15 | /visitor | Gerçek MainNavigationShell ve seçili alt sekme |
| [select_device_empty_light.png](select_device_empty_light.png) | select_device | empty | light | lib/screens/settings/select_device_screen.dart:14 | /select-device |  |
| [select_device_loading_light.png](select_device_loading_light.png) | select_device | loading | light | lib/screens/settings/select_device_screen.dart:14 | /select-device |  |
| [select_device_error_light.png](select_device_error_light.png) | select_device | error | light | lib/screens/settings/select_device_screen.dart:14 | /select-device |  |
| [login_empty_light.png](login_empty_light.png) | login | empty | light | lib/screens/auth/login_screen.dart:15 | /login |  |
| [login_loading_light.png](login_loading_light.png) | login | loading | light | lib/screens/auth/login_screen.dart:15 | /login |  |
| [login_error_light.png](login_error_light.png) | login | error | light | lib/screens/auth/login_screen.dart:15 | /login | İş ilişkisi sona ermiş kullanıcı uyarısı |
| [splash_loading_light.png](splash_loading_light.png) | splash | loading | light | lib/screens/splash_screen.dart:7 | /splash |  |
| [splash_loading_dark.png](splash_loading_dark.png) | splash | loading | dark | lib/screens/splash_screen.dart:7 | /splash |  |
| [splash_error_light.png](splash_error_light.png) | splash | error | light | lib/screens/splash_screen.dart:7 | /splash |  |
| [home_long_light.png](home_long_light.png) | home | long | light | lib/screens/home/home_screen.dart:29 | /home | Başlık tarihi/selamı sistem saatini kullanır; İçerik ölçülür; üst sınır 2400 lp; Gerçek MainNavigationShell ve seçili alt sekme |
| [history_long_light.png](history_long_light.png) | history | long | light | lib/screens/history/history_screen.dart:19 | /history | İçerik ölçülür; üst sınır 2400 lp; Gerçek MainNavigationShell ve seçili alt sekme |
| [requests_long_light.png](requests_long_light.png) | requests | long | light | lib/screens/requests/requests_screen.dart:38 | /requests | İçerik ölçülür; üst sınır 2400 lp |
| [visitor_long_light.png](visitor_long_light.png) | visitor | long | light | lib/screens/visitor/visitor_screen.dart:15 | /visitor | İçerik ölçülür; üst sınır 2400 lp; Gerçek MainNavigationShell ve seçili alt sekme |
| [profile_long_light.png](profile_long_light.png) | profile | long | light | lib/screens/profile/profile_screen.dart:21 | /profile | İçerik ölçülür; üst sınır 2400 lp; Gerçek MainNavigationShell ve seçili alt sekme |
| [visitor_form_long_light.png](visitor_form_long_light.png) | visitor_form | long | light | lib/screens/visitor/visitor_form_screen.dart:11 | /visitor → Navigator.push | İçerik ölçülür; üst sınır 2400 lp; Mevcut daveti düzenleme |
| [home_textscale130_light.png](home_textscale130_light.png) | home | textscale130 | light | lib/screens/home/home_screen.dart:29 | /home | Başlık tarihi/selamı sistem saatini kullanır; Gerçek MainNavigationShell ve seçili alt sekme |
| [login_textscale130_light.png](login_textscale130_light.png) | login | textscale130 | light | lib/screens/auth/login_screen.dart:15 | /login |  |
| [requests_corrections_light.png](requests_corrections_light.png) | requests | corrections | light | lib/screens/requests/requests_screen.dart:38 | /requests |  |
| [history_overview_light.png](history_overview_light.png) | history | overview | light | lib/screens/history/history_screen.dart:19 | /history | Gerçek MainNavigationShell ve seçili alt sekme |
| [history_calendar_light.png](history_calendar_light.png) | history | calendar | light | lib/screens/history/history_screen.dart:19 | /history | Gerçek MainNavigationShell ve seçili alt sekme |
| [qr_loading_light.png](qr_loading_light.png) | qr | loading | light | lib/screens/qr_scan/qr_scan_screen.dart:17 | /qr | Sahte token; kamera yer tutucu, native kamera yok; Gerçek MainNavigationShell ve seçili alt sekme |
| [qr_error_light.png](qr_error_light.png) | qr | error | light | lib/screens/qr_scan/qr_scan_screen.dart:17 | /qr | Sahte token; kamera yer tutucu, native kamera yok; Gerçek MainNavigationShell ve seçili alt sekme |
| [qr_camera_placeholder_light.png](qr_camera_placeholder_light.png) | qr | camera_placeholder | light | lib/screens/qr_scan/qr_scan_screen.dart:17 | /qr | Sahte token; kamera yer tutucu, native kamera yok; Gerçek MainNavigationShell ve seçili alt sekme |
| [door_recovery_open_light.png](door_recovery_open_light.png) | door_recovery | open | light | lib/widgets/door_operation_recovery_dialog.dart:14 | /home → dialog | Başlık tarihi/selamı sistem saatini kullanır |
| [door_recovery_open_dark.png](door_recovery_open_dark.png) | door_recovery | open | dark | lib/widgets/door_operation_recovery_dialog.dart:14 | /home → dialog | Başlık tarihi/selamı sistem saatini kullanır |
| [history_filter_open_light.png](history_filter_open_light.png) | history_filter | open | light | lib/widgets/history/history_filter_sheet.dart:11 | /history → sheet |  |
| [history_filter_open_dark.png](history_filter_open_dark.png) | history_filter | open | dark | lib/widgets/history/history_filter_sheet.dart:11 | /history → sheet |  |
| [visitor_detail_open_light.png](visitor_detail_open_light.png) | visitor_detail | open | light | lib/widgets/visitor/visitor_detail.dart:11 | /visitor → sheet |  |
| [visitor_detail_open_dark.png](visitor_detail_open_dark.png) | visitor_detail | open | dark | lib/widgets/visitor/visitor_detail.dart:11 | /visitor → sheet |  |
| [visitor_form_empty_light.png](visitor_form_empty_light.png) | visitor_form | empty | light | lib/screens/visitor/visitor_form_screen.dart:11 | /visitor → Navigator.push |  |
| [visitor_form_loading_light.png](visitor_form_loading_light.png) | visitor_form | loading | light | lib/screens/visitor/visitor_form_screen.dart:11 | /visitor → Navigator.push |  |
| [visitor_form_error_light.png](visitor_form_error_light.png) | visitor_form | error | light | lib/screens/visitor/visitor_form_screen.dart:11 | /visitor → Navigator.push |  |
| [request_leave_form_empty_light.png](request_leave_form_empty_light.png) | request_leave_form | empty | light | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |
| [request_correction_form_empty_light.png](request_correction_form_empty_light.png) | request_correction_form | empty | light | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |
| [request_leave_form_loading_light.png](request_leave_form_loading_light.png) | request_leave_form | loading | light | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |
| [request_leave_form_error_light.png](request_leave_form_error_light.png) | request_leave_form | error | light | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |
| [request_correction_form_loading_light.png](request_correction_form_loading_light.png) | request_correction_form | loading | light | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |
| [request_correction_form_error_light.png](request_correction_form_error_light.png) | request_correction_form | error | light | lib/screens/requests/requests_screen.dart:253 | /requests → Navigator.push |  |

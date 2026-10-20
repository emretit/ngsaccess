# Modül ve worker kapsamı

Bu tablo dosya sahipliğini değil, audit sorumluluğunu gösterir. Ortak akışlar birden fazla worker tarafından çapraz incelenir. Modül raporlarındaki incelenen dosyalar listesi fiilen yapılan incelemeyi gösterir.

| Modül | Rapor | Task | Dispatch |
|---|---|---|---|
| Kimlik doğrulama ve oturum | [01-auth](modules/01-auth.md) | `task_29f8284de5a0` | `ctx_4fdc4987610c` |
| Ana sayfa ve dashboard | [02-home](modules/02-home.md) | `task_41f512fb1b77` | `ctx_09d9958a56dd` |
| Yoklama verisi ve geçmiş | [03-attendance-history](modules/03-attendance-history.md) | `task_4417bea6470b` | `ctx_650b180bb762` |
| QR tarama ve fiziksel geçiş | [04-qr](modules/04-qr.md) | `task_1fce8e79d35b` | `ctx_e748c8b9f402` |
| Ziyaretçi yönetimi | [05-visitor](modules/05-visitor.md) | `task_4dd532c2d3a6` | `ctx_d9d1a663270d` |
| Profil ve kullanıcı ayarları | [06-profile](modules/06-profile.md) | `task_66905426d636` | `ctx_8a326b79db1c` |
| Cihaz seçimi ve tercihler | [07-devices](modules/07-devices.md) | `task_cb336edcb23d` | `ctx_da61cb263124` |
| Uygulama mimarisi ve navigasyon | [08-architecture-navigation](modules/08-architecture-navigation.md) | `task_00cb640b1071` | `ctx_5985ff18f96a` |
| HTTP ve Convex sözleşmeleri | [09-network-backend](modules/09-network-backend.md) | `task_4ac96d824f52` | `ctx_6755f03538dd` |
| Tema, ortak bileşenler ve erişilebilirlik | [10-design-accessibility](modules/10-design-accessibility.md) | `task_79062f6faeaa` | `ctx_6454d54e0bb5` |
| Yerelleştirme ve kullanıcı metinleri | [11-localization](modules/11-localization.md) | `task_d9dd04278a53` | `ctx_98d67b36eb90` |
| Platform, test ve yayın hazırlığı | [12-platform-quality](modules/12-platform-quality.md) | `task_dded99b61d8f` | `ctx_5788863d9621` |

## Kaynak dosya sorumluluğu

| Dosya | Birincil audit modülü |
|---|---|
| `mobile/lib/config/convex_config.dart` | 09-network-backend |
| `mobile/lib/core/breakpoints.dart` | 10-design-accessibility |
| `mobile/lib/core/error_localizer.dart` | 09-network-backend |
| `mobile/lib/core/errors.dart` | 09-network-backend |
| `mobile/lib/core/spacing.dart` | 10-design-accessibility |
| `mobile/lib/l10n/app_en.arb` | 11-localization |
| `mobile/lib/l10n/app_localizations.dart` | 11-localization |
| `mobile/lib/l10n/app_localizations_en.dart` | 11-localization |
| `mobile/lib/l10n/app_localizations_tr.dart` | 11-localization |
| `mobile/lib/l10n/app_tr.arb` | 11-localization |
| `mobile/lib/main.dart` | 08-architecture-navigation |
| `mobile/lib/models/attendance.dart` | 03-attendance-history |
| `mobile/lib/models/device.dart` | 07-devices |
| `mobile/lib/models/qr_code_model.dart` | 04-qr |
| `mobile/lib/providers/attendance_provider.dart` | 03-attendance-history |
| `mobile/lib/providers/auth_provider.dart` | 01-auth |
| `mobile/lib/providers/preferred_device_provider.dart` | 07-devices |
| `mobile/lib/providers/theme_provider.dart` | 06-profile |
| `mobile/lib/repositories/attendance_repository.dart` | 03-attendance-history |
| `mobile/lib/repositories/auth_repository.dart` | 01-auth |
| `mobile/lib/repositories/device_repository.dart` | 07-devices |
| `mobile/lib/router/app_router.dart` | 08-architecture-navigation |
| `mobile/lib/screens/auth/forgot_password_screen.dart` | 01-auth |
| `mobile/lib/screens/auth/login_screen.dart` | 01-auth |
| `mobile/lib/screens/history/history_screen.dart` | 03-attendance-history |
| `mobile/lib/screens/home/home_screen.dart` | 02-home |
| `mobile/lib/screens/main_navigation_shell.dart` | 08-architecture-navigation |
| `mobile/lib/screens/profile/profile_screen.dart` | 06-profile |
| `mobile/lib/screens/qr_scan/qr_scan_screen.dart` | 04-qr |
| `mobile/lib/screens/settings/select_device_screen.dart` | 07-devices |
| `mobile/lib/screens/splash_screen.dart` | 08-architecture-navigation |
| `mobile/lib/screens/visitor/visitor_screen.dart` | 05-visitor |
| `mobile/lib/theme/app_theme.dart` | 10-design-accessibility |
| `mobile/lib/widgets/cards/attendance_status_card.dart` | 10-design-accessibility |
| `mobile/lib/widgets/cards/progress_hero_card.dart` | 10-design-accessibility |
| `mobile/lib/widgets/cards/quick_action_card.dart` | 10-design-accessibility |
| `mobile/lib/widgets/cards/section_header.dart` | 10-design-accessibility |
| `mobile/lib/widgets/cards/stat_card.dart` | 10-design-accessibility |
| `mobile/lib/widgets/responsive_container.dart` | 10-design-accessibility |

`mobile/test/`, platform dizinleri, paket manifest/lock, CI ve README: 12-platform-quality; ilgili modül workerları kendi test kapsamlarını da inceler.

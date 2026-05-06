import 'package:flutter/widgets.dart';

import '../l10n/app_localizations.dart';
import 'errors.dart';

/// [AppError]'ı UI'a uygun localized mesaja çevirir.
///
/// Provider'lar [AppError] saklar; UI ekranı snackbar/dialog'a yansıtırken bu
/// helper'ı çağırır. `BusinessError`'da bilinen Convex hata mesajları known
/// l10n key'lerine map'lenir; bilinmeyen mesajlar olduğu gibi gösterilir
/// (backend zaten Türkçe döndürüyor — bu segment sonraki fazlarda zenginleşir).
String localizeAppError(BuildContext context, AppError error) {
  final l10n = AppLocalizations.of(context);

  return switch (error) {
    NetworkError _ => l10n.errorNetwork,
    TimeoutError _ => l10n.errorTimeout,
    ServerError(:final statusCode) => l10n.errorServer(statusCode),
    AuthExpiredError _ => l10n.errorAuthExpired,
    UnknownError _ => l10n.errorUnknown,
    BusinessError(:final message) => _localizeBusiness(l10n, message),
  };
}

String _localizeBusiness(AppLocalizations l10n, String raw) {
  if (raw.contains('E-posta veya şifre hatalı')) {
    return l10n.errorBusinessInvalidCredentials;
  }
  if (raw.contains('Mobil şifreniz henüz kurulmamış')) {
    return l10n.errorBusinessNoMobilePassword;
  }
  if (raw.contains('Çalışan aktif değil')) {
    return l10n.errorBusinessEmployeeInactive;
  }
  return raw;
}

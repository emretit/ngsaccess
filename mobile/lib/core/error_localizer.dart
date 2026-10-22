import 'package:flutter/widgets.dart';

import '../l10n/app_localizations.dart';
import 'errors.dart';

/// Only allowlisted codes reach localized presentation, never backend text.
String localizeAppError(BuildContext context, AppError error) {
  final l10n = AppLocalizations.of(context);
  return switch (error) {
    NetworkError _ => l10n.errorNetwork,
    TimeoutError _ => l10n.errorTimeout,
    ServerError(:final statusCode) => l10n.errorServer(statusCode),
    EmploymentEndedError _ => l10n.errorEmploymentEnded,
    AuthExpiredError _ => l10n.errorAuthExpired,
    UnknownError _ => l10n.errorUnknown,
    BusinessError business when business.isAccessDenied => l10n.accessDenied,
    BusinessError business => switch (business.safeCode) {
      'INVALID_CREDENTIALS' => l10n.errorBusinessInvalidCredentials,
      'MOBILE_PASSWORD_NOT_SET' => l10n.errorBusinessNoMobilePassword,
      'EMPLOYMENT_ENDED' => l10n.errorEmploymentEnded,
      'EMPLOYEE_INACTIVE' => l10n.errorBusinessEmployeeInactive,
      'INVALID_QR' => l10n.qrInvalidCode,
      'INVALID_DEVICE' => l10n.qrInvalidDevice,
      'RATE_LIMITED' => l10n.errorRateLimited,
      'SESSION_STORAGE_FAILED' => l10n.errorSessionStorageFailed,
      'PROTOCOL_ERROR' => l10n.errorProtocol,
      'PASSWORD_POLICY' => l10n.errorPasswordPolicy,
      _ => l10n.errorUnknown,
    },
  };
}

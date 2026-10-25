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
      'REQUEST_PROJECT_MISSING' => l10n.errorRequestProjectMissing,
      'REQUEST_NOTE_TOO_LONG' => l10n.errorRequestNoteTooLong,
      'REQUEST_DATE_INVALID' => l10n.errorRequestDateInvalid,
      'REQUEST_RANGE_INVALID' => l10n.errorRequestRangeInvalid,
      'REQUEST_START_TOO_OLD' => l10n.errorRequestStartTooOld,
      'REQUEST_RANGE_TOO_LONG' => l10n.errorRequestRangeTooLong,
      'REQUEST_PENDING_LIMIT' => l10n.errorRequestPendingLimit,
      'REQUEST_OVERLAP_PENDING' => l10n.errorRequestOverlapPending,
      'REQUEST_OVERLAP_APPROVED' => l10n.errorRequestOverlapApproved,
      'REQUEST_NOT_FOUND' => l10n.errorRequestNotFound,
      'REQUEST_NOT_PENDING' => l10n.errorRequestNotPending,
      'CORRECTION_DATE_OUT_OF_RANGE' => l10n.errorCorrectionDateOutOfRange,
      'CORRECTION_REASON_LENGTH' => l10n.errorCorrectionReasonLength,
      'CORRECTION_TIMES_MISMATCH' => l10n.errorCorrectionTimesMismatch,
      'CORRECTION_TIME_INVALID' => l10n.errorCorrectionTimeInvalid,
      'CORRECTION_PENDING_EXISTS' => l10n.errorCorrectionPendingExists,
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

import 'dart:async';
import 'dart:io';

/// Stable codes and allowlisted presentation; server text is never display text.
sealed class AppError implements Exception {
  const AppError();

  String get userMessage;
  String get debugMessage;

  @override
  // Legacy UI catch sites sometimes render toString directly. Keep it safe.
  String toString() => userMessage;

  static AppError fromException(Object error, [StackTrace? stack]) {
    if (error is AppError) return error;
    if (error is TimeoutException) return const TimeoutError();
    if (error is SocketException) return NetworkError(error.message);
    if (error is HttpException) return NetworkError(error.message);
    return UnknownError(error);
  }
}

class NetworkError extends AppError {
  const NetworkError([this.detail]);
  // Compatibility only. Never interpolate untrusted details into logs/UI.
  final String? detail;
  @override
  String get userMessage =>
      'İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.';
  @override
  String get debugMessage => 'NetworkError';
}

class TimeoutError extends AppError {
  const TimeoutError();
  @override
  String get userMessage =>
      'Sunucu yanıt vermedi. Lütfen daha sonra tekrar deneyin.';
  @override
  String get debugMessage => 'TimeoutError';
}

class ServerError extends AppError {
  const ServerError({required this.statusCode, this.body});
  final int statusCode;
  // Retained for source compatibility; transport deliberately leaves this null.
  final String? body;
  @override
  String get userMessage =>
      'Sunucu hatası ($statusCode). Lütfen biraz sonra tekrar deneyin.';
  @override
  String get debugMessage => 'ServerError: HTTP $statusCode';
}

class AuthExpiredError extends AppError {
  const AuthExpiredError([this.detail]);
  final String? detail;
  String get code => 'AUTH_EXPIRED';
  @override
  String get userMessage => 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.';
  @override
  String get debugMessage => 'AuthExpiredError';
}

class BusinessError extends AppError {
  const BusinessError({required this.message, this.code, this.retryAfterMs});
  // Compatibility field: consumers must use userMessage/localizeAppError.
  final String message;
  final String? code;
  final int? retryAfterMs;

  String get safeCode =>
      normalizeBusinessCode(code) ??
      legacyBusinessCode(message) ??
      'BUSINESS_ERROR';

  /// Keep the server's precise reason while sharing safe denial presentation.
  bool get isAccessDenied => const {
    'ACCESS_DENIED',
    'TARGET_NOT_ALLOWED',
    'DOOR_REQUIRED',
    'DEVICE_INACTIVE',
    'DOOR_INACTIVE',
    'ACCESS_EPOCH_DENIED',
    'SCHEDULE_DENIED',
    'TARGET_UNSUPPORTED',
    'TRANSPORT_UNSUPPORTED',
    'ACCESS_GRAPH_LIMIT',
    'REQUEST_TARGET_MISMATCH',
    'READER_REQUIRED',
  }.contains(safeCode);

  @override
  String get userMessage => isAccessDenied
      ? 'Erişim reddedildi.'
      : switch (safeCode) {
          'INVALID_CREDENTIALS' => 'E-posta veya şifre hatalı',
          'MOBILE_PASSWORD_NOT_SET' =>
            'Mobil şifreniz henüz kurulmamış. Yöneticinizden kurulum bağlantısı isteyin.',
          'EMPLOYEE_INACTIVE' => 'Çalışan kaydınız aktif değil',
          'INVALID_QR' => 'Geçersiz QR kod.',
          'INVALID_DEVICE' => 'QR kodda cihaz bilgisi yok.',
          'PASSWORD_POLICY' => 'Yeni şifre güvenlik koşullarını karşılamıyor.',
          'SESSION_STORAGE_FAILED' =>
            'Oturum güvenli biçimde saklanamadı. Lütfen tekrar giriş yapın.',
          'RATE_LIMITED' =>
            'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.',
          'CONFIGURATION_ERROR' =>
            'Uygulama sunucu adresi eksik veya geçersiz. Lütfen destek ekibine başvurun.',
          'PROTOCOL_ERROR' =>
            'Sunucudan geçerli bir yanıt alınamadı. Lütfen tekrar deneyin.',
          'SESSION_CHANGED' =>
            'Oturum değişti. Lütfen işlemi yeniden başlatın.',
          'CLIENT_CLOSED' =>
            'Bağlantı kapatıldı. Lütfen uygulamayı yeniden açın.',
          _ => 'İşlem tamamlanamadı. Lütfen tekrar deneyin.',
        };

  @override
  String get debugMessage => 'BusinessError($safeCode)';
}

/// Subtype preserves existing exhaustive AppError switches' BusinessError arm.
class ProtocolError extends BusinessError {
  const ProtocolError() : super(message: '', code: 'PROTOCOL_ERROR');
}

class ConfigurationError extends BusinessError {
  const ConfigurationError() : super(message: '', code: 'CONFIGURATION_ERROR');
}

class UnknownError extends AppError {
  const UnknownError(this.cause);
  final Object cause;
  @override
  String get userMessage =>
      'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
  @override
  String get debugMessage => 'UnknownError';
}

String? normalizeBusinessCode(String? code) => switch (code) {
  'INVALID_CREDENTIALS' || 'AUTH_INVALID_CREDENTIALS' => 'INVALID_CREDENTIALS',
  'MOBILE_PASSWORD_NOT_SET' ||
  'NO_MOBILE_PASSWORD' ||
  'AUTH_PASSWORD_NOT_SET' => 'MOBILE_PASSWORD_NOT_SET',
  'EMPLOYEE_INACTIVE' || 'AUTH_EMPLOYEE_INACTIVE' => 'EMPLOYEE_INACTIVE',
  'ACCESS_DENIED' || 'FORBIDDEN' => 'ACCESS_DENIED',
  'RATE_LIMITED' ||
  'TOO_MANY_ATTEMPTS' ||
  'AUTH_RATE_LIMITED' => 'RATE_LIMITED',
  'PROTOCOL_ERROR' ||
  'CONFIGURATION_ERROR' ||
  'SESSION_CHANGED' ||
  'CLIENT_CLOSED' ||
  'BUSINESS_ERROR' ||
  'SESSION_STORAGE_FAILED' ||
  'INVALID_QR' ||
  'INVALID_DEVICE' ||
  'PASSWORD_POLICY' ||
  'TARGET_NOT_ALLOWED' ||
  'DOOR_REQUIRED' ||
  'DEVICE_INACTIVE' ||
  'DOOR_INACTIVE' ||
  'ACCESS_EPOCH_DENIED' ||
  'SCHEDULE_DENIED' ||
  'TARGET_UNSUPPORTED' ||
  'TRANSPORT_UNSUPPORTED' ||
  'ACCESS_GRAPH_LIMIT' ||
  'INVALID_REQUEST_ID' ||
  'REQUEST_TARGET_MISMATCH' ||
  'OPERATION_NOT_FOUND' ||
  'OPERATION_STORAGE_FAILED' ||
  'OPERATION_UNRESOLVED' ||
  'READER_REQUIRED' => code,
  _ => null,
};

/// Exact legacy texts only; no substring match over arbitrary response bodies.
String? legacyBusinessCode(String message) => switch (message.trim()) {
  'E-posta veya şifre hatalı' => 'INVALID_CREDENTIALS',
  'Mobil şifreniz henüz kurulmamış' ||
  'Mobil şifreniz henüz kurulmamış. Yöneticinizden kurulum bağlantısı isteyin.' =>
    'MOBILE_PASSWORD_NOT_SET',
  'Çalışan aktif değil' ||
  'Çalışan kaydınız aktif değil' => 'EMPLOYEE_INACTIVE',
  _ => null,
};

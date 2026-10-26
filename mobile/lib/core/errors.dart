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

/// Terminal session denial that retains the safe employment-end reason.
class EmploymentEndedError extends AuthExpiredError {
  const EmploymentEndedError();
  @override
  String get code => 'EMPLOYMENT_ENDED';
  @override
  String get userMessage => 'İşten ayrıldınız. Mobil erişiminiz kapatıldı.';
  @override
  String get debugMessage => 'EmploymentEndedError';
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
          'SUMMARY_TOO_LARGE' =>
            "Bu dönem için özet oluşturulamıyor. Tarih aralığını küçültün.",
          'INVALID_CURSOR' =>
            "Geçmiş sayfası artık geçerli değil. Listeyi yenileyin.",
          'DEVICE_NOT_FOUND' =>
            "Cihaz bu projede bulunamadı. Cihaz seçimini yenileyin veya yöneticinize başvurun.",
          'SUMMARY_INVALID_DATA' =>
            "Kayıt zamanları doğrulanamadı. Kayıtların kontrolü için yöneticinize başvurun.",
          'VISITOR_INVALID' =>
            "Ziyaretçi bilgileri veya liste sayfası geçersiz. Bilgileri ve tarihleri kontrol edin; gerekirse listeyi yenileyin.",
          'VISITOR_LOCKED' =>
            "Bu davet artık düzenlenemiyor. Daveti yenileyin veya operatöre başvurun.",
          'VISITOR_NOTICE_CHANGED' =>
            "Ziyaretçi aydınlatma metni değişti. Davet formunu yenileyip güncel metni okuyun ve tekrar onaylayın.",
          'REQUEST_CONFLICT' =>
            "Bu işlem farklı ziyaretçi bilgileriyle daha önce kaydedilmiş. Ziyaretçi listesini yenileyip mevcut daveti kontrol edin.",
          'REQUEST_PROJECT_MISSING' => "Çalışanın proje bilgisi bulunamadı",
          'REQUEST_NOTE_TOO_LONG' => "Not en fazla 500 karakter olabilir",
          'REQUEST_DATE_INVALID' => "Geçerli bir tarih girin (YYYY-MM-DD)",
          'REQUEST_RANGE_INVALID' => "Bitiş tarihi başlangıçtan önce olamaz",
          'REQUEST_START_TOO_OLD' =>
            "İzin başlangıcı en fazla 30 gün geçmiş olabilir",
          'REQUEST_RANGE_TOO_LONG' => "İzin aralığı en fazla 60 gün olabilir",
          'REQUEST_PENDING_LIMIT' =>
            "En fazla 10 bekleyen izin talebiniz olabilir",
          'REQUEST_OVERLAP_PENDING' =>
            "Seçilen tarihler bekleyen başka bir izin talebiyle çakışıyor",
          'REQUEST_OVERLAP_APPROVED' =>
            "Seçilen tarihler onaylı başka bir izinle çakışıyor",
          'REQUEST_NOT_FOUND' => "Talep bulunamadı.",
          'REQUEST_NOT_PENDING' =>
            "Yalnız bekleyen kendi talebinizi geri çekebilirsiniz.",
          'CORRECTION_DATE_OUT_OF_RANGE' =>
            "Tarih bugün ile son 30 gün arasında olmalı",
          'CORRECTION_REASON_LENGTH' => "Gerekçe 5–300 karakter olmalı",
          'CORRECTION_TIMES_MISMATCH' =>
            "Düzeltme türüne uygun giriş ve çıkış saatlerini belirtin",
          'CORRECTION_TIME_INVALID' => "Geçerli bir saat girin (HH:mm).",
          'CORRECTION_PENDING_EXISTS' =>
            "Bu gün için bekleyen bir düzeltme talebiniz var",
          'INVALID_CREDENTIALS' => 'E-posta veya şifre hatalı',
          'MOBILE_PASSWORD_NOT_SET' =>
            'Mobil şifreniz henüz kurulmamış. Yöneticinizden kurulum bağlantısı isteyin.',
          'EMPLOYEE_INACTIVE' => 'Çalışan kaydınız aktif değil',
          'EMPLOYMENT_ENDED' => const EmploymentEndedError().userMessage,
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
  'EMPLOYMENT_ENDED' => 'EMPLOYMENT_ENDED',
  'INVALID_CREDENTIALS' || 'AUTH_INVALID_CREDENTIALS' => 'INVALID_CREDENTIALS',
  'MOBILE_PASSWORD_NOT_SET' ||
  'NO_MOBILE_PASSWORD' ||
  'AUTH_PASSWORD_NOT_SET' => 'MOBILE_PASSWORD_NOT_SET',
  'EMPLOYEE_INACTIVE' || 'AUTH_EMPLOYEE_INACTIVE' => 'EMPLOYEE_INACTIVE',
  'ACCESS_DENIED' || 'FORBIDDEN' => 'ACCESS_DENIED',
  'RATE_LIMITED' ||
  'TOO_MANY_ATTEMPTS' ||
  'AUTH_RATE_LIMITED' => 'RATE_LIMITED',
  'SUMMARY_TOO_LARGE' ||
  'INVALID_CURSOR' ||
  'DEVICE_NOT_FOUND' ||
  'SUMMARY_INVALID_DATA' ||
  'VISITOR_INVALID' ||
  'VISITOR_LOCKED' ||
  'VISITOR_NOTICE_CHANGED' ||
  'REQUEST_CONFLICT' ||
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
  'REQUEST_PROJECT_MISSING' ||
  'REQUEST_NOTE_TOO_LONG' ||
  'REQUEST_DATE_INVALID' ||
  'REQUEST_RANGE_INVALID' ||
  'REQUEST_START_TOO_OLD' ||
  'REQUEST_RANGE_TOO_LONG' ||
  'REQUEST_PENDING_LIMIT' ||
  'REQUEST_OVERLAP_PENDING' ||
  'REQUEST_OVERLAP_APPROVED' ||
  'REQUEST_NOT_FOUND' ||
  'REQUEST_NOT_PENDING' ||
  'CORRECTION_DATE_OUT_OF_RANGE' ||
  'CORRECTION_REASON_LENGTH' ||
  'CORRECTION_TIMES_MISMATCH' ||
  'CORRECTION_TIME_INVALID' ||
  'CORRECTION_PENDING_EXISTS' ||
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

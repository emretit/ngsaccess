import 'dart:async';
import 'dart:io';

/// Uygulama genelinde standartlaştırılmış hata tipi.
///
/// HTTP/Convex katmanı [AppError] fırlatır. Provider'lar `userMessage`'ı
/// UI'a gösterir, `debugMessage`'ı log'lar.
sealed class AppError implements Exception {
  const AppError();

  /// UI'da gösterilecek kısa, kullanıcı dostu mesaj. Türkçe.
  String get userMessage;

  /// Debug/log için detaylı mesaj.
  String get debugMessage;

  @override
  String toString() => debugMessage;

  /// Convex/HTTP katmanından gelen istisnayı uygun [AppError]'a map'ler.
  static AppError fromException(Object error, [StackTrace? stack]) {
    if (error is AppError) return error;
    if (error is TimeoutException) {
      return const TimeoutError();
    }
    if (error is SocketException) {
      return NetworkError(error.message);
    }
    if (error is HttpException) {
      return NetworkError(error.message);
    }
    return UnknownError(error);
  }
}

class NetworkError extends AppError {
  const NetworkError([this.detail]);
  final String? detail;

  @override
  String get userMessage =>
      'İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.';

  @override
  String get debugMessage =>
      'NetworkError${detail == null ? '' : ': $detail'}';
}

class TimeoutError extends AppError {
  const TimeoutError();

  @override
  String get userMessage =>
      'Sunucu yanıt vermedi. Lütfen daha sonra tekrar deneyin.';

  @override
  String get debugMessage => 'TimeoutError: HTTP request timed out';
}

class ServerError extends AppError {
  const ServerError({required this.statusCode, this.body});
  final int statusCode;
  final String? body;

  @override
  String get userMessage =>
      'Sunucu hatası ($statusCode). Lütfen biraz sonra tekrar deneyin.';

  @override
  String get debugMessage =>
      'ServerError: HTTP $statusCode${body == null ? '' : ' — $body'}';
}

class AuthExpiredError extends AppError {
  const AuthExpiredError([this.detail]);
  final String? detail;

  @override
  String get userMessage =>
      'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.';

  @override
  String get debugMessage =>
      'AuthExpiredError${detail == null ? '' : ': $detail'}';
}

/// Convex'ten dönen `{status: error, errorMessage}` veya iş kuralı hataları.
class BusinessError extends AppError {
  const BusinessError({required this.message, this.code});
  final String message;
  final String? code;

  @override
  String get userMessage => _humanize(message);

  @override
  String get debugMessage =>
      'BusinessError${code == null ? '' : '($code)'}: $message';

  static String _humanize(String raw) {
    if (raw.contains('E-posta veya şifre hatalı')) {
      return 'E-posta veya şifre hatalı';
    }
    if (raw.contains('Mobil şifreniz henüz kurulmamış')) {
      return 'Mobil şifreniz henüz kurulmamış. Yöneticinizden kurulum bağlantısı isteyin.';
    }
    if (raw.contains('Çalışan aktif değil')) {
      return 'Çalışan kaydınız aktif değil';
    }
    return raw;
  }
}

class UnknownError extends AppError {
  const UnknownError(this.cause);
  final Object cause;

  @override
  String get userMessage =>
      'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';

  @override
  String get debugMessage => 'UnknownError: $cause';
}

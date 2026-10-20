import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';

void main() {
  group('AppError.fromException', () {
    test('zaten AppError ise olduğu gibi döner', () {
      const original = TimeoutError();
      final mapped = AppError.fromException(original);
      expect(mapped, same(original));
    });

    test('TimeoutException → TimeoutError', () {
      final mapped = AppError.fromException(TimeoutException('slow'));
      expect(mapped, isA<TimeoutError>());
    });

    test('SocketException → NetworkError', () {
      final mapped = AppError.fromException(const SocketException('offline'));
      expect(mapped, isA<NetworkError>());
      expect((mapped as NetworkError).detail, 'offline');
    });

    test('HttpException → NetworkError', () {
      final mapped = AppError.fromException(const HttpException('bad'));
      expect(mapped, isA<NetworkError>());
    });

    test('Bilinmeyen Object → UnknownError', () {
      final mapped = AppError.fromException(Object());
      expect(mapped, isA<UnknownError>());
    });
  });

  test('all error string surfaces exclude sensitive untrusted details', () {
    const marker = 'token-password-card-email-marker';
    for (final error in <AppError>[
      const NetworkError(marker),
      const ServerError(statusCode: 503, body: marker),
      const AuthExpiredError(marker),
      const BusinessError(message: marker, code: marker),
      const UnknownError(marker),
    ]) {
      expect(error.userMessage, isNot(contains(marker)));
      expect(error.debugMessage, isNot(contains(marker)));
      expect(error.toString(), isNot(contains(marker)));
      expect(error.toString(), error.userMessage);
    }
  });

  test(
    'rate limit metadata remains typed and protocol keeps exhaustive compatibility',
    () {
      const limited = BusinessError(
        message: '',
        code: 'RATE_LIMITED',
        retryAfterMs: 5000,
      );
      expect(limited.retryAfterMs, 5000);
      expect(const ProtocolError(), isA<BusinessError>());
      expect(const ConfigurationError(), isA<BusinessError>());
      expect(
        const BusinessError(
          message: '',
          code: 'SESSION_STORAGE_FAILED',
        ).safeCode,
        'SESSION_STORAGE_FAILED',
      );
    },
  );

  test(
    'operation denials retain precise codes and safe denial presentation',
    () {
      const deniedCodes = [
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
      ];
      for (final code in deniedCodes) {
        final error = BusinessError(
          message: 'private-backend-marker',
          code: code,
        );
        expect(error.safeCode, code, reason: code);
        expect(
          error.userMessage,
          const BusinessError(message: '', code: 'ACCESS_DENIED').userMessage,
          reason: code,
        );
        expect(error.debugMessage, 'BusinessError($code)');
        expect(error.toString(), isNot(contains('private-backend-marker')));
      }
    },
  );

  test(
    'operation recovery failures preserve codes without trusting server text',
    () {
      for (final code in [
        'INVALID_REQUEST_ID',
        'OPERATION_NOT_FOUND',
        'OPERATION_STORAGE_FAILED',
        'OPERATION_UNRESOLVED',
      ]) {
        final error = BusinessError(
          message: 'private-backend-marker',
          code: code,
        );
        expect(error.safeCode, code);
        expect(error.isAccessDenied, isFalse);
        expect(error.userMessage, isNot(contains('private-backend-marker')));
      }
      const unknown = BusinessError(
        message: 'private-backend-marker',
        code: 'FUTURE_PRIVATE_CODE',
      );
      expect(unknown.safeCode, 'BUSINESS_ERROR');
      expect(unknown.debugMessage, isNot(contains('FUTURE_PRIVATE_CODE')));
    },
  );

  group('userMessage', () {
    test('Network mesajı non-empty', () {
      const e = NetworkError('x');
      expect(e.userMessage.isNotEmpty, isTrue);
    });

    test('ServerError mesajında status code görünür', () {
      const e = ServerError(statusCode: 503);
      expect(e.userMessage, contains('503'));
    });

    test('BusinessError bilinen TR mesajını humanize eder', () {
      const e = BusinessError(message: 'E-posta veya şifre hatalı');
      expect(e.userMessage, 'E-posta veya şifre hatalı');
    });

    test('BusinessError bilinmeyen mesajı güvenli genel metne çevirir', () {
      const e = BusinessError(message: 'Custom error xyz');
      expect(e.userMessage, isNot(contains('Custom error xyz')));
      expect(e.debugMessage, isNot(contains('Custom error xyz')));
    });
  });
}

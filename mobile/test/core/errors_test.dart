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

    test('BusinessError bilinmeyen mesajı olduğu gibi gösterir', () {
      const e = BusinessError(message: 'Custom error xyz');
      expect(e.userMessage, 'Custom error xyz');
    });
  });
}

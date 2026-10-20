import 'dart:convert';

final _upper = RegExp(r'[A-Z]');
final _lower = RegExp(r'[a-z]');
final _digit = RegExp(r'[0-9]');

/// Mirrors convex/lib/passwordPolicy.ts (8+ UTF-16 units, ASCII upper, lower
/// and digit) plus employeeAuth.changePassword's bcrypt and reuse guards.
bool isAcceptableNewPassword(String next, {required String current}) =>
    next.length >= 8 &&
    _upper.hasMatch(next) &&
    _lower.hasMatch(next) &&
    _digit.hasMatch(next) &&
    utf8.encode(next).length <= 72 &&
    next != current;

import 'dart:collection';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'errors.dart';

enum DiagnosticOperation {
  query,
  mutation,
  action,
  framework,
  platform,
  bootstrap,
}

/// Local, bounded, memory-only diagnostics. No request name, body or identity API.
class SafeDiagnostics {
  SafeDiagnostics({this.capacity = 50, DateTime Function()? clock})
    : _clock = clock ?? DateTime.now {
    if (capacity < 1 || capacity > 200) {
      throw ArgumentError.value(capacity, 'capacity');
    }
  }

  static final instance = SafeDiagnostics();
  final int capacity;
  final DateTime Function() _clock;
  final Queue<Map<String, Object?>> _events = Queue();
  String? _lastKey;
  DateTime? _lastAt;
  int _sequence = 0;

  List<Map<String, Object?>> get events => List.unmodifiable(
    _events.map((event) => Map<String, Object?>.unmodifiable(event)),
  );

  /// User-initiated local support export. No error object or arbitrary metadata
  /// can be supplied here; only the bounded, already sanitized event schema.
  String exportJson() => jsonEncode(<String, Object?>{
    'schemaVersion': 1,
    'build': _buildIdentity(),
    'events': [
      for (final event in _events)
        <String, Object?>{
          for (final key in _eventFields)
            if (event.containsKey(key)) key: event[key],
        },
    ],
  });

  void clear() {
    _events.clear();
    _lastKey = null;
    _lastAt = null;
  }

  /// Observability must never replace the original operation's outcome.
  void record(
    Object error, {
    StackTrace? stack,
    required DiagnosticOperation operation,
    Duration? elapsed,
    int attempt = 1,
  }) {
    try {
      final mapped = AppError.fromException(error);
      final category = switch (mapped) {
        NetworkError _ => 'network',
        TimeoutError _ => 'timeout',
        ServerError _ => 'server',
        AuthExpiredError _ => 'authExpired',
        BusinessError business => business.safeCode,
        UnknownError _ => 'unknown',
      };
      final now = _clock().toUtc();
      final key = '${operation.name}:$category:${attempt.clamp(1, 100)}';
      final previous = _lastAt;
      if (_lastKey == key &&
          previous != null &&
          now.difference(previous) < const Duration(seconds: 1)) {
        return;
      }
      _lastKey = key;
      _lastAt = now;
      final event = <String, Object?>{
        'reference': 'local-${++_sequence}',
        'at': now.toIso8601String(),
        'operation': operation.name,
        'category': category,
        ..._buildIdentity(),
        'stack': List<String>.unmodifiable(_safeStack(stack)),
        'attempt': attempt.clamp(1, 100),
        if (elapsed != null)
          'elapsedMs': elapsed.inMilliseconds.clamp(0, 3600000),
        if (mapped is ServerError &&
            mapped.statusCode >= 100 &&
            mapped.statusCode <= 599)
          'httpStatus': mapped.statusCode,
      };
      if (_events.length == capacity) _events.removeFirst();
      _events.add(event);
    } catch (_) {
      // Diagnostics are deliberately best effort and have no external side effect.
    }
  }
}

const _eventFields = {
  'reference',
  'at',
  'operation',
  'category',
  'platform',
  'mode',
  'runtime',
  'environment',
  'dartVersion',
  'flutterVersion',
  'appVersion',
  'buildNumber',
  'stack',
  'attempt',
  'elapsedMs',
  'httpStatus',
};

Map<String, Object?> _buildIdentity() => {
  'platform': defaultTargetPlatform.name,
  'mode': kReleaseMode ? 'release' : (kProfileMode ? 'profile' : 'debug'),
  'runtime': 'flutter',
  'environment': _environment(),
  'dartVersion': _version(Platform.version.split(' ').first),
  'flutterVersion': _version(const String.fromEnvironment('NGS_FLUTTER_VERSION')),
  'appVersion': _version(const String.fromEnvironment('APP_VERSION')),
  'buildNumber': _buildNumber(const String.fromEnvironment('BUILD_NUMBER')),
};

List<String> _safeStack(StackTrace? stack) {
  if (stack == null) return const [];
  final result = <String>[];
  // Keep source line/column and allowlisted app paths; drop symbols, file URLs,
  // query strings, request data, home directories and arbitrary exception text.
  final frame = RegExp(
    r'(package:ngsplusapp/([a-z_/.]+\.dart)|package:flutter/[^(): ]+|dart:[a-z_]+):(\d{1,6}):(\d{1,6})(?!\d)',
  );
  const appFiles = {
    'config/convex_config.dart',
    'core/errors.dart',
    'core/response_decoder.dart',
    'core/safe_diagnostics.dart',
    'repositories/auth_repository.dart',
    'repositories/attendance_repository.dart',
    'repositories/device_repository.dart',
    'providers/auth_provider.dart',
    'providers/attendance_provider.dart',
    'main.dart',
  };
  final text = stack.toString();
  final bounded = text.length > 32768 ? text.substring(0, 32768) : text;
  for (final line in const LineSplitter().convert(bounded).take(100)) {
    if (line.length > 256) continue;
    final native = _safeNativeFrame(line.trim());
    if (native != null) {
      result.add(native);
      if (result.length == 32) break;
      continue;
    }
    final match = frame.firstMatch(line);
    if (match == null) continue;
    final source = match.group(1) ?? '';
    final appPath = match.group(2);
    final label = source.startsWith('package:ngsplusapp/')
        ? (appFiles.contains(appPath) ? appPath : 'app')
        : source.startsWith('package:flutter/')
        ? 'flutter'
        : 'dart';
    result.add('$label:${match.group(3)}:${match.group(4)}');
    if (result.length == 32) break;
  }
  return result;
}

// Grammar checked against Flutter's pinned native_stack_traces 0.6.1 parser
// (lib/src/convert.dart) and regress_262474517_trace_2.txt. Keep only canonical
// headers/PCs/snapshot offsets; never PID/thread names, paths, symbols or text.
String? _safeNativeFrame(String line) {
  const start =
      '*** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***';
  if (line == start) return line;
  final patterns = <RegExp>[
    RegExp(
      r'^os(?:=|: )(android|ios),? arch(?:=|: )(arm|arm64|x64|ia32),? comp(?:=|: )(yes|no),? sim(?:=|: )(yes|no)$',
    ),
    RegExp(r"^build_id(?:=|: )'[a-f0-9]{8,64}'$"),
    RegExp(r'^BuildId: [a-f0-9]{8,64}$'),
    RegExp(
      r'^isolate_dso_base(?:=|: )[a-f0-9]{1,16}(?:,? vm_dso_base(?:=|: )[a-f0-9]{1,16})?$',
    ),
    RegExp(
      r'^isolate_instructions(?:=|: )[a-f0-9]{1,16},? vm_instructions(?:=|: )[a-f0-9]{1,16}$',
    ),
    RegExp(
      r"^loading_unit(?:=|: )[0-9]{1,4},? (?:build_id(?:=|: )'[a-f0-9]{8,64}',? )?dso_base(?:=|: )[a-f0-9]{1,16},? instructions(?:=|: )[a-f0-9]{1,16}$",
    ),
    RegExp(
      r'^#[0-9]{1,3} +abs [a-f0-9]{1,16}(?: unit [0-9]{1,4})?(?: virt [a-f0-9]{1,16})? (?:_kDart(?:Isolate|Vm)SnapshotInstructions\+(?:0x)?[a-f0-9]{1,16}|<unknown>)$',
    ),
  ];
  return patterns.any((pattern) => pattern.hasMatch(line)) ? line : null;
}

String _version(String value) =>
    RegExp(r'^\d{1,6}(?:\.\d{1,6}){0,3}(?:\+\d{1,6})?$').hasMatch(value)
    ? value
    : 'unknown';

String _buildNumber(String value) =>
    RegExp(r'^[1-9][0-9]{0,8}$').hasMatch(value) ? value : 'unknown';

String _environment() => switch (const String.fromEnvironment('APP_ENV')) {
  'staging' => 'staging',
  'production' => 'production',
  'development' => 'development',
  _ => 'unknown',
};

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/core/safe_diagnostics.dart';

void main() {
  test(
    'retains safe stack location and operation but drops secret/PII markers',
    () {
      final diagnostics = SafeDiagnostics();
      const marker = 'token-password-card-person@example.test';
      diagnostics.record(
        StateError(marker),
        operation: DiagnosticOperation.framework,
        stack: StackTrace.fromString(
          '#0 $marker (package:ngsplusapp/core/errors.dart:23:4)\n'
          '#1 $marker (file:///Users/$marker/secret.dart:5:9)\n'
          '#2 $marker (package:flutter/src/widgets/framework.dart:12:3)',
        ),
      );
      final event = diagnostics.events.single;
      expect(event['operation'], 'framework');
      expect(event['stack'], ['core/errors.dart:23:4', 'flutter:12:3']);
      expect(event['reference'], 'local-1');
      expect(event['dartVersion'], isNotEmpty);
      expect(jsonEncode(event), isNot(contains(marker)));
      expect(jsonEncode(event), isNot(contains('/Users/')));
    },
  );

  test(
    'unknown business code and response body never enter local diagnostics',
    () {
      final diagnostics = SafeDiagnostics();
      diagnostics.record(
        const BusinessError(message: 'password-marker', code: 'token-marker'),
        operation: DiagnosticOperation.mutation,
      );
      diagnostics.record(
        const ServerError(statusCode: 503, body: 'card-marker'),
        operation: DiagnosticOperation.query,
      );
      final serialized = jsonEncode(diagnostics.events);
      for (final marker in ['password-marker', 'token-marker', 'card-marker']) {
        expect(serialized, isNot(contains(marker)));
      }
      expect(diagnostics.events.last['httpStatus'], 503);
    },
  );

  test('rate limits identical failures and bounds retained history', () {
    var time = DateTime.utc(2026);
    final diagnostics = SafeDiagnostics(capacity: 2, clock: () => time);
    diagnostics.record(
      const TimeoutError(),
      operation: DiagnosticOperation.query,
    );
    diagnostics.record(
      const TimeoutError(),
      operation: DiagnosticOperation.query,
    );
    expect(diagnostics.events, hasLength(1));
    for (var index = 0; index < 3; index++) {
      time = time.add(const Duration(seconds: 2));
      diagnostics.record(
        const TimeoutError(),
        operation: DiagnosticOperation.query,
      );
    }
    expect(diagnostics.events, hasLength(2));
    expect(diagnostics.events.last['reference'], 'local-4');
    diagnostics.clear();
    expect(diagnostics.events, isEmpty);
  });

  test('broken diagnostic clock never changes the caller outcome', () {
    final diagnostics = SafeDiagnostics(clock: () => throw StateError('clock'));
    expect(
      () => diagnostics.record(
        const TimeoutError(),
        operation: DiagnosticOperation.query,
      ),
      returnsNormally,
    );
  });

  test(
    'support JSON has a versioned allowlist and excludes every raw error field',
    () {
      final diagnostics = SafeDiagnostics();
      const marker = 'sensitive-token-qr-password-person@example.test';
      diagnostics.record(
        const ServerError(statusCode: 503, body: marker),
        operation: DiagnosticOperation.query,
        elapsed: const Duration(milliseconds: 42),
        stack: StackTrace.fromString(
          '#0 $marker (package:ngsplusapp/main.dart:12:3)',
        ),
      );
      final serialized = diagnostics.exportJson();
      final decoded = jsonDecode(serialized) as Map<String, Object?>;
      expect(
        decoded.keys,
        unorderedEquals(['schemaVersion', 'build', 'events']),
      );
      expect(decoded['schemaVersion'], 1);
      final events = decoded['events'] as List<Object?>;
      final event = events.single as Map<String, Object?>;
      expect(event['stack'], ['main.dart:12:3']);
      expect(event['elapsedMs'], 42);
      expect(event['httpStatus'], 503);
      expect(event.keys, isNot(contains('error')));
      expect(event.keys, isNot(contains('body')));
      expect(serialized, isNot(contains(marker)));
      expect(decoded['build'], containsPair('runtime', 'flutter'));
      diagnostics.clear();
      final cleared =
          jsonDecode(diagnostics.exportJson()) as Map<String, Object?>;
      expect(cleared['events'], isEmpty);
      expect(cleared['build'], decoded['build']);
    },
  );

  test(
    'retains symbolizer-compatible AOT header and PC offsets without raw context',
    () {
      final diagnostics = SafeDiagnostics();
      // Shape from the pinned Flutter tool dependency native_stack_traces 0.6.1
      // lib/src/convert.dart and its regress_262474517_trace_2.txt fixture.
      const lines = [
        '*** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***',
        'os: android arch: arm64 comp: yes sim: no',
        "build_id: 'c3126a4381294e13185549e5e94a4db9'",
        'isolate_dso_base: 7000000000, vm_dso_base: 7100000000',
        'isolate_instructions: 70001cd1f0, vm_instructions: 7100001000',
        '#00 abs 0 virt 000000000031ba6f _kDartIsolateSnapshotInstructions+0x14e87f',
        '#01 abs 0 virt 0000000000472017 _kDartIsolateSnapshotInstructions+0x2a4e27',
        '#02 abs 7000001000 _kDartVmSnapshotInstructions+0x1000',
      ];
      diagnostics.record(
        StateError('sensitive-body'),
        operation: DiagnosticOperation.platform,
        stack: StackTrace.fromString(
          [
            'pid: 123 tid: 456 name: sensitive-thread-name',
            ...lines,
            '#03 abs 0 virt 000000000031ba6f sensitive-token@example.test',
            '#04 abs 0 virt 000000000031ba6f /Users/sensitive-private/app.so',
            "build_id: 'c3126a4381294e13185549e5e94a4db9' sensitive-qr",
            'isolate_instructions: 70001cd1f0, vm_instructions: 7100001000 sensitive-card',
            '#05 abs 0 virt 000000000031ba6f _kDartIsolateSnapshotInstructions+0x14e87f sensitive-password',
            '#06 abs 12345678901234567890 virt 1 <unknown>',
          ].join('\n'),
        ),
      );
      expect(diagnostics.events.single['stack'], lines);
      expect(diagnostics.exportJson(), isNot(contains('sensitive')));
    },
  );

  test(
    'retains iOS AOT address grammar and drops arbitrary symbol and loading-unit data',
    () {
      final diagnostics = SafeDiagnostics();
      const lines = [
        'os=ios, arch=arm64, comp=no, sim=no',
        "build_id='0123456789abcdef'",
        "loading_unit: 2, build_id: '0123456789abcdef', dso_base: 1000, instructions: 1100",
        'isolate_dso_base=1000',
        'isolate_instructions=1100, vm_instructions=1200',
        '#00 abs 1123 unit 2 virt 123 _kDartIsolateSnapshotInstructions+0x23',
        '#01 abs 1223 virt 223 <unknown>',
      ];
      diagnostics.record(
        StateError('hidden'),
        operation: DiagnosticOperation.platform,
        stack: StackTrace.fromString(
          [
            ...lines,
            "loading_unit: 2, build_id: 'private-marker', dso_base: 1000, instructions: 1100",
            'os=private-marker, arch=arm64, comp=no, sim=no',
            '#02 abs 1123 virt 123 private-marker',
          ].join('\n'),
        ),
      );
      expect(diagnostics.events.single['stack'], lines);
      expect(diagnostics.exportJson(), isNot(contains('private-marker')));
    },
  );

  test(
    'untrusted large stacks remain bounded and event snapshots cannot be modified',
    () {
      final diagnostics = SafeDiagnostics(capacity: 1);
      diagnostics.record(
        StateError('hidden'),
        operation: DiagnosticOperation.framework,
        stack: StackTrace.fromString(
          List.filled(
            1000,
            '#0 hidden (package:ngsplusapp/main.dart:1:1)',
          ).join('\n'),
        ),
      );
      final event = diagnostics.events.single;
      final stack = event['stack'] as List<String>;
      expect(stack, hasLength(32));
      expect(() => stack.add('secret'), throwsUnsupportedError);
      expect(() => event['body'] = 'secret', throwsUnsupportedError);
      expect(diagnostics.exportJson().length, lessThan(3000));
    },
  );
}

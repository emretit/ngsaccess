import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/attendance.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/models/device.dart';
import 'package:ngsplusapp/models/door_operation.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/door_operation_provider.dart';
import 'package:ngsplusapp/providers/request_provider.dart';
import 'package:ngsplusapp/providers/visitor_provider.dart';
import 'package:ngsplusapp/repositories/device_repository.dart';
import 'package:ngsplusapp/repositories/door_operation_repository.dart';
import '../test/helpers/mocks.dart';
import '../test/helpers/history_fakes.dart' show HistoryTestProvider;
import '../test/helpers/request_fakes.dart' show RequestFakeRepository;
import '../test/helpers/visitor_fakes.dart' show FakeVisitorRepository;

class AuditTestBinding extends AutomatedTestWidgetsFlutterBinding {
  @override
  bool get disableShadows => false;
}

const captureKey = ValueKey('audit-capture');

/// Relative to the mobile working directory, never silently falls back.
String get auditOutputDirectory {
  const configured = String.fromEnvironment(
    'AUDIT_OUTPUT_DIR',
    defaultValue: '../docs/mobile-ui-audit/after-b',
  );
  if (configured.trim().isEmpty) {
    throw ArgumentError('AUDIT_OUTPUT_DIR must not be empty');
  }
  final directory = Directory(configured).absolute;
  final leaf = directory.uri.pathSegments.where((part) => part.isNotEmpty).last;
  if (['current', 'after-d1', 'after-d2'].contains(leaf)) {
    throw ArgumentError('Historical captures are read-only: $configured');
  }
  return directory.path;
}

final auditNow = DateTime.parse('2026-11-04T10:30:00+03:00');
const auditUser = AuthUser(
  id: 'ayse',
  email: 'ayse.yilmaz@example.test',
  firstName: 'Ayşe',
  lastName: 'Yılmaz',
  cardNumber: '004219',
  projectId: 'ngs',
  projectName: 'NGS Teknoloji — Merkez',
  departmentName: 'İnsan Kaynakları',
);

/// Use the SDK running flutter_tester, never a machine-specific SDK path.
Future<void> loadAuditFonts() async {
  final configured = Platform.environment['FLUTTER_ROOT'];
  final sdk = configured != null
      ? Directory(configured)
      : File(Platform.resolvedExecutable).parent.parent.parent.parent.parent;
  final fonts = Directory('${sdk.path}/bin/cache/artifacts/material_fonts');
  if (!fonts.existsSync()) {
    throw StateError(
      'Flutter material fonts missing: ${fonts.path}. Set FLUTTER_ROOT to the Flutter SDK root.',
    );
  }
  Future<void> load(String family, List<File> files) async {
    final loader = FontLoader(family);
    for (final file in files) {
      loader.addFont(
        Future.value(ByteData.sublistView(await file.readAsBytes())),
      );
    }
    await loader.load();
  }

  final roboto =
      fonts
          .listSync()
          .whereType<File>()
          .where(
            (f) =>
                f.uri.pathSegments.last.startsWith('Roboto-') &&
                f.path.endsWith('.ttf'),
          )
          .toList()
        ..sort((a, b) => a.path.compareTo(b.path));
  if (roboto.length < 12) {
    throw StateError('Incomplete Roboto font family in ${fonts.path}');
  }
  await load('Roboto', roboto);
  await load('MaterialIcons', [
    File('${fonts.path}/MaterialIcons-Regular.otf'),
  ]);
  final config =
      jsonDecode(File('.dart_tool/package_config.json').readAsStringSync())
          as Map<String, dynamic>;
  final packages = config['packages'] as List<dynamic>;
  for (final package in packages.cast<Map<String, dynamic>>()) {
    if (package['name'] == 'cupertino_icons') {
      final uri = File(
        '.dart_tool/package_config.json',
      ).absolute.uri.resolve(package['rootUri'] as String);
      await load('packages/cupertino_icons/CupertinoIcons', [
        File('${Directory.fromUri(uri).path}/assets/CupertinoIcons.ttf'),
      ]);
    }
  }
}

class AuditAuth extends AuthProvider {
  AuditAuth(this.state) : super(repository: MockAuthRepository());
  final String state;
  @override
  AuthUser get currentUser => auditUser;
  @override
  bool get isAuthenticated => true;
  @override
  int get sessionEpoch => 1;
  @override
  String get sessionToken => 'offline-audit';
  @override
  bool get isLoading => state == 'loading';
  @override
  AppError? get lastError =>
      state == 'error' ? const EmploymentEndedError() : null;
  @override
  Future<String?> rememberedEmail() async => null;
  @override
  void clearError({bool notify = true}) {}
}

class AuditAttendance extends HistoryTestProvider {
  AuditAttendance(this.state) {
    isLoading = state == 'loading';
    listLoaded = state != 'loading';
    listError = state == 'error' ? const NetworkError() : null;
    deviceFacets = {'main': 'Ana Giriş', 'parking': 'Otopark Turnike'};
    if (state == 'filled') {
      attendanceRecords = [
        for (final (index, time, direction, granted, device) in [
          (0, '2026-11-04T13:14:00+03:00', 'entry', true, 'main'),
          (1, '2026-11-04T12:31:00+03:00', 'exit', true, 'parking'),
          (2, '2026-11-04T08:52:00+03:00', 'entry', true, 'main'),
          (3, '2026-11-03T18:07:00+03:00', 'exit', true, 'main'),
          (4, '2026-11-03T08:48:00+03:00', 'entry', true, 'main'),
          (5, '2026-11-03T08:46:00+03:00', 'entry', false, 'parking'),
        ])
          Attendance(
            id: 'movement-$index',
            employeeId: 'ayse',
            deviceId: device,
            cardNo: '004219',
            employeeName: 'Ayşe Yılmaz',
            accessTime: DateTime.parse(time),
            granted: granted,
            direction: direction,
            deviceInfo: {
              'name': device == 'main' ? 'Ana Giriş' : 'Otopark Turnike',
            },
          ),
      ];
    }
  }
  final String state;
  @override
  bool get isSummaryLoading => state == 'loading';
  @override
  bool get hasSummaryLoaded => state == 'filled' || state == 'empty';
  @override
  bool get isTodayStatusKnown => hasSummaryLoaded;
  @override
  AppError? get summaryError => state == 'error' ? const NetworkError() : null;
  @override
  DateTime? get summaryUpdatedAt => auditNow;
  @override
  AttendanceDaySummary? get todaySummary => state != 'filled'
      ? null
      : AttendanceDaySummary(
          date: '2026-11-04',
          entryCount: 2,
          exitCount: 1,
          deniedCount: 0,
          unknownCount: 0,
          firstEntry: DateTime.parse('2026-11-04T08:52:00+03:00'),
          lastEntry: DateTime.parse('2026-11-04T13:14:00+03:00'),
          lastExit: DateTime.parse('2026-11-04T12:31:00+03:00'),
          lastDirection: AttendanceDirection.entry,
        );
  @override
  Future<AttendanceSummary?> loadDailySummary() async => null;
  @override
  AttendanceSummary? summaryFor({
    required String startDate,
    required String endDate,
  }) => state != 'filled'
      ? null
      : AttendanceSummary(
          startDate: startDate,
          endDate: endDate,
          generatedAt: auditNow,
          days: [
            AttendanceDaySummary(
              date: '2026-11-03',
              entryCount: 1,
              exitCount: 1,
              deniedCount: 1,
              unknownCount: 0,
              firstEntry: DateTime.parse('2026-11-03T08:48:00+03:00'),
              lastEntry: DateTime.parse('2026-11-03T08:48:00+03:00'),
              lastExit: DateTime.parse('2026-11-03T18:07:00+03:00'),
              lastDirection: AttendanceDirection.exit,
            ),
            ?todaySummary,
          ],
          totals: const AttendanceTotals(
            entryCount: 3,
            exitCount: 2,
            deniedCount: 1,
            unknownCount: 0,
            presentDays: 2,
          ),
        );
}

class AuditRequests extends RequestProvider {
  AuditRequests(String state) : super(repository: RequestFakeRepository()) {
    loading = state == 'loading';
    error = state == 'error' ? const NetworkError() : null;
  }
  @override
  Future<void> refresh() async {}
  // Command failures are presentation fixtures; no repository is called.
  @override
  Future<bool> submitLeave({
    required String leaveType,
    required String startDate,
    required String endDate,
    String? notes,
  }) async {
    commandError = const NetworkError();
    return false;
  }

  @override
  Future<bool> submitCorrection({
    required String date,
    required String correctionType,
    required String reason,
    String? requestedCheckIn,
    String? requestedCheckOut,
  }) async {
    commandError = const NetworkError();
    return false;
  }
}

class AuditVisitors extends VisitorProvider {
  final String state;
  @override
  Future<VisitorNotice?> loadNotice() async {
    if (state == 'loading') return Completer<VisitorNotice?>().future;
    if (state == 'error') {
      mutationError = const NetworkError();
      return null;
    }
    return const VisitorNotice(
      version: '2026-11',
      url: 'https://example.test/privacy',
    );
  }

  AuditVisitors(this.state) : super(repository: FakeVisitorRepository()) {
    loading = state == 'loading';
    loaded = state == 'filled' || state == 'empty';
    error = state == 'error' ? const NetworkError() : null;
    if (state == 'filled') {
      visitors = [
        auditVisitor,
        Visitor(
          id: 'visitor-2',
          firstName: 'Çağrı',
          lastName: 'Öztürk',
          visitStart: auditNow,
          visitEnd: auditNow.add(const Duration(hours: 2)),
          status: VisitorAccessStatus.active,
          canEdit: false,
          purpose: 'Teknik bakım',
        ),
      ];
      summary = const VisitorSummary(
        total: 2,
        counts: {
          VisitorAccessStatus.preRegistered: 1,
          VisitorAccessStatus.active: 1,
        },
        overflow: false,
      );
    }
  }
  @override
  Future<void> refresh({bool more = false}) async {}
  @override
  Future<void> refreshSummary() async {}
  @override
  Future<void> openDetail(String id) async {
    selected = auditVisitor;
  }

  @override
  void setVisible(bool visible) {}
  @override
  void setForeground(bool foreground) {}
}

final auditVisitor = Visitor(
  id: 'visitor-1',
  firstName: 'İpek',
  lastName: 'Şahin',
  phone: '+90 555 010 20 30',
  purpose: 'Proje değerlendirme toplantısı',
  notes: 'Ana girişte Ayşe Yılmaz karşılayacak.',
  visitStart: auditNow,
  visitEnd: auditNow.add(const Duration(hours: 2)),
  status: VisitorAccessStatus.preRegistered,
  canEdit: true,
);

class AuditDevices implements DeviceRepository {
  AuditDevices(this.state);
  final String state;
  @override
  Future<List<Device>> listForEmployee() {
    if (state == 'loading') return Completer<List<Device>>().future;
    if (state == 'error') return Future.error(const NetworkError());
    return Future.value(
      state == 'empty'
          ? []
          : const [
              Device(
                id: 'panel',
                name: 'Merkez',
                doorId: 'main',
                targetId: 'panel:main',
                doorName: 'Ana Giriş',
                canOpen: true,
              ),
              Device(
                id: 'panel',
                name: 'Merkez',
                doorId: 'parking',
                targetId: 'panel:parking',
                doorName: 'Otopark Turnike',
                canOpen: true,
              ),
            ],
    );
  }
}

class AuditCommands extends DoorOperationProvider {
  AuditCommands({this.unknown = false})
    : super(repository: DoorOperationRepository(MockHttpConvexClient()));
  @override
  bool get isLoading => false;
  @override
  bool get hasUnresolvedOperation => unknown;
  final bool unknown;
  @override
  DoorOperation? get operation => unknown
      ? DoorOperation(
          operationId: 'audit-operation',
          status: DoorOperationStatus.unknown,
          deviceId: 'panel',
          doorId: 'main',
          deviceName: 'Ana Giriş',
          requestedAt: auditNow,
        )
      : null;
  @override
  Future<void> checkStatus() async {}
}

Future<void> resolveAuditFontFallbacks(WidgetTester tester) async {
  // Styles that intentionally omit fontFamily normally use the system font.
  // flutter_tester instead falls back to its built-in Ahem, even after loading
  // Roboto. Resolve only that missing family on the render spans; preserve all
  // app sizes, weights, colors, layout constraints and explicit icon families.
  InlineSpan resolveFamily(InlineSpan span, String inherited) {
    if (span is! TextSpan) return span;
    final family = span.style?.fontFamily ?? inherited;
    return TextSpan(
      text: span.text,
      style: (span.style ?? const TextStyle()).copyWith(fontFamily: family),
      children: span.children
          ?.map((child) => resolveFamily(child, family))
          .toList(),
      recognizer: span.recognizer,
      semanticsLabel: span.semanticsLabel,
      locale: span.locale,
      spellOut: span.spellOut,
    );
  }

  for (final paragraph
      in tester.allRenderObjects.whereType<RenderParagraph>()) {
    paragraph.text = resolveFamily(paragraph.text, 'Roboto');
  }
  await tester.pump();
}

Future<void> saveCapture(
  WidgetTester tester,
  String filename, {
  Rect? clockProgressBounds,
}) async {
  await resolveAuditFontFallbacks(tester);
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(captureKey),
  );
  final png = await boundary.toImage(pixelRatio: 2);
  final exact = goldenFileComparator;
  if (clockProgressBounds != null) {
    final origin = tester.getTopLeft(find.byKey(captureKey));
    final rect = clockProgressBounds.shift(-origin);
    goldenFileComparator = _AuditProgressComparator(
      exact,
      Rect.fromLTRB(
        rect.left * 2,
        rect.top * 2,
        rect.right * 2,
        rect.bottom * 2,
      ),
    );
  }
  try {
    await expectLater(
      png,
      matchesGoldenFile(Uri.file('$auditOutputDirectory/$filename.png')),
    );
  } finally {
    goldenFileComparator = exact;
    png.dispose();
  }
}

/// The real-time QR progress endpoint can move a fraction of a pixel between
/// captures. All other pixels (including the QR code and countdown) stay exact.
bool auditProgressDiffAllowed(
  Uint8List actual,
  Uint8List expected, {
  required int width,
  required int height,
  required Rect bounds,
}) {
  if (actual.length != expected.length || actual.length != width * height * 4) {
    return false;
  }
  var changed = 0;
  for (var i = 0; i < actual.length; i += 4) {
    if (actual[i] == expected[i] &&
        actual[i + 1] == expected[i + 1] &&
        actual[i + 2] == expected[i + 2] &&
        actual[i + 3] == expected[i + 3]) {
      continue;
    }
    final pixel = i ~/ 4;
    if (!bounds.contains(Offset((pixel % width) + .5, (pixel ~/ width) + .5)) ||
        ++changed > 32) {
      return false;
    }
  }
  return true;
}

class _AuditProgressComparator extends GoldenFileComparator {
  _AuditProgressComparator(this.exact, this.bounds);
  final GoldenFileComparator exact;
  final Rect bounds;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final file = File.fromUri(golden);
    if (!file.existsSync()) return exact.compare(imageBytes, golden);
    Future<({int width, int height, Uint8List bytes})> decode(
      Uint8List bytes,
    ) async {
      final codec = await ui.instantiateImageCodec(bytes);
      try {
        final frame = await codec.getNextFrame();
        try {
          final data = await frame.image.toByteData(
            format: ui.ImageByteFormat.rawRgba,
          );
          if (data == null) throw StateError('Cannot decode golden image');
          return (
            width: frame.image.width,
            height: frame.image.height,
            bytes: data.buffer.asUint8List(),
          );
        } finally {
          frame.image.dispose();
        }
      } finally {
        codec.dispose();
      }
    }

    final actual = await decode(imageBytes);
    final expected = await decode(await file.readAsBytes());
    if (actual.width == expected.width &&
        actual.height == expected.height &&
        auditProgressDiffAllowed(
          actual.bytes,
          expected.bytes,
          width: actual.width,
          height: actual.height,
          bounds: bounds,
        )) {
      return true;
    }
    return exact.compare(imageBytes, golden);
  }

  @override
  Future<void> update(Uri golden, Uint8List imageBytes) =>
      exact.update(golden, imageBytes);
  @override
  Uri getTestUri(Uri key, int? version) => exact.getTestUri(key, version);
}

import 'dart:async';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/providers/auth_provider.dart';
import 'package:ngsplusapp/providers/request_provider.dart';
import 'package:ngsplusapp/screens/requests/requests_screen.dart';
import 'package:provider/provider.dart';
import '../auth_fakes.dart';
import '../helpers/history_request_app.dart';
import '../helpers/request_fakes.dart';

class TestPicker extends FilePicker {
  int calls = 0;
  List<PlatformFile> files = [];
  Completer<void> cleared = Completer<void>();
  @override
  Future<FilePickerResult?> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    bool allowCompression = false,
    int compressionQuality = 0,
    bool allowMultiple = false,
    bool withData = false,
    bool withReadStream = false,
    bool lockParentWindow = false,
    bool readSequential = false,
  }) async {
    calls++;
    expect(type, FileType.custom);
    expect(allowedExtensions, containsAll(['pdf', 'jpg', 'png']));
    expect(withData, false);
    return FilePickerResult(files);
  }

  @override
  Future<bool?> clearTemporaryFiles() async {
    if (!cleared.isCompleted) cleared.complete();
    return true;
  }
}

void main() {
  late Directory temp;
  late File pdf;
  late TestPicker picker;
  late RequestFakeRepository repo;
  late RequestProvider provider;
  late AuthProvider auth;
  setUp(() async {
    temp = await Directory.systemTemp.createTemp('request-attachment-test');
    pdf = await File('${temp.path}/rapor.pdf').writeAsString('%PDF-test');
    picker = TestPicker();
    FilePicker.platform = picker;
    repo = RequestFakeRepository();
    auth = AuthProvider(
      repository: FakeAuthRepository(),
      sessionStore: FakeSessionStore(),
    );
    await auth.bootstrap();
    await auth.signIn('test', 'password');
    provider = RequestProvider(repository: repo)..synchronizeSession(auth);
  });
  tearDown(() async {
    provider.dispose();
    auth.dispose();
    await temp.delete(recursive: true);
  });
  Future<void> mount(WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<RequestProvider>.value(
        value: provider,
        child: app(
          const RequestFormScreen(isLeave: true),
          dark: false,
          scale: 1,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> pick(WidgetTester tester) async {
    await tester.ensureVisible(find.byKey(const Key('request-add-attachment')));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<TextButton>(find.byKey(const Key('request-add-attachment')))
          .onPressed,
      isNotNull,
    );
    await tester.runAsync(() async {
      picker.cleared = Completer<void>();
      final calls = picker.calls;
      await tester.tap(find.byKey(const Key('request-add-attachment')));
      await Future<void>.delayed(Duration.zero);
      expect(picker.calls, calls + 1);
      await picker.cleared.future.timeout(const Duration(seconds: 5));
      await Future<void>.delayed(Duration.zero);
    });
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<TextButton>(find.byKey(const Key('request-add-attachment')))
          .onPressed,
      isNotNull,
    );
  }

  PlatformFile picked({int size = 9}) =>
      PlatformFile(name: 'rapor.pdf', path: pdf.path, size: size);
  testWidgets('selects and removes an optional document', (tester) async {
    picker.files = [picked()];
    await mount(tester);
    await pick(tester);
    expect(find.text('rapor.pdf'), findsOneWidget);
    await tester.tap(find.byTooltip('Belgeyi çıkar: rapor.pdf'));
    await tester.pumpAndSettle();
    expect(find.text('rapor.pdf'), findsNothing);
    expect(repo.submits, 0);
  });
  testWidgets('rejects more than 3 files and files larger than 5 MiB', (
    tester,
  ) async {
    picker.files = List.generate(4, (_) => picked());
    await mount(tester);
    await pick(tester);
    expect(find.text('En fazla 3 belge ekleyebilirsiniz.'), findsOneWidget);
    expect(find.text('rapor.pdf'), findsNothing);
    picker.files = [picked(size: 5 * 1024 * 1024 + 1)];
    await pick(tester);
    expect(
      find.text('Fotoğraf veya PDF seçin. Her dosya en fazla 5 MB olabilir.'),
      findsOneWidget,
    );
  });
  testWidgets('upload failure preserves the form and selected documents', (
    tester,
  ) async {
    picker.files = [picked()];
    repo.uploadFailure = const NetworkError();
    await mount(tester);
    await pick(tester);
    await tester.tap(find.byKey(const Key('request-submit')));
    await tester.pumpAndSettle();
    expect(find.byType(RequestFormScreen), findsOneWidget);
    expect(find.text('rapor.pdf'), findsOneWidget);
    expect(repo.uploaded, ['rapor.pdf']);
    expect(provider.attachmentUploadFailed, true);
    expect(
      find.text(
        'Belge yüklenemedi. Talebiniz gönderilmedi; dosyaları kontrol edip yeniden deneyin.',
      ),
      findsOneWidget,
    );
    expect(repo.submits, 0);
  });
  testWidgets('clears selected health documents on session change', (
    tester,
  ) async {
    picker.files = [picked()];
    await mount(tester);
    await pick(tester);
    expect(find.text('rapor.pdf'), findsOneWidget);
    await tester.runAsync(auth.signOut);
    provider.synchronizeSession(auth);
    await tester.pumpAndSettle();
    expect(find.text('rapor.pdf'), findsNothing);
  });
}

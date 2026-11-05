import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import 'dart:ui' as ui;
import 'dart:ui' show CheckedState;
import 'dart:io';
import 'package:flutter/rendering.dart';
import '../../theme/app_theme_test.dart' show contrast;
import '../../helpers/ui_mount.dart' show mount;

Future<void> mountKit(
  WidgetTester tester,
  Widget child, {
  bool dark = false,
  double scale = 1,
  Size size = const Size(320, 900),
  double keyboard = 0,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    MaterialApp(
      theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
      locale: const Locale('tr'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          textScaler: TextScaler.linear(scale),
          viewInsets: EdgeInsets.only(bottom: keyboard),
        ),
        child: child!,
      ),
      home: Scaffold(
        body: SingleChildScrollView(
          child: Padding(padding: const EdgeInsets.all(12), child: child),
        ),
      ),
    ),
  );
  await tester.pump();
}

// Models unchecked external data without triggering DateTimeRange's debug assert.
class _DraftRange implements DateTimeRange {
  @override
  final DateTime start = DateTime.utc(2026, 11, 9);
  @override
  final DateTime end = DateTime.utc(2026, 11, 4);
  @override
  Duration get duration => end.difference(start);
}

void main() {
  for (final dark in [false, true]) {
    for (final scale in [1.0, 2.0]) {
      final factories = <String, Widget Function(TextEditingController)>{
        'brand': (_) => const AppBrandBand(
          title: 'Bugünkü durum',
          subtitle: 'Kurum ve proje',
          dateLabel: '4 Kasım Çarşamba',
          overlapChild: AppSurface(child: Text('Bugün')),
        ),
        'header': (_) => AppPageHeader(
          title: 'Kayıt ayrıntısı',
          subtitle: 'Seçili gün',
          showBack: true,
          actions: [
            IconButton(
              tooltip: 'Filtrele',
              onPressed: () {},
              icon: const Icon(Icons.filter_list),
            ),
          ],
        ),
        'badge': (_) => const AppStatusBadge(
          label: 'Onay bekliyor',
          tone: AppStatusTone.warning,
        ),
        'group': (_) => const AppListGroup(
          title: 'Hesap',
          subtitle: 'Kişi bilgileri',
          children: [AppListRow(title: 'Ad soyad', subtitle: 'Ayşe Yılmaz')],
        ),
        'row': (_) => AppListRow(
          title: 'Ana giriş',
          subtitle: 'Giriş kaydı',
          leadingText: '13:20',
          leadingIcon: Icons.login,
          trailing: const AppStatusBadge(
            label: 'Onaylandı',
            tone: AppStatusTone.success,
          ),
          onTap: () {},
          showChevron: true,
        ),
        'empty': (_) => AppEmptyState(
          title: 'Henüz kayıt yok',
          message: 'Yeni geçişleriniz burada görünecek.',
          actionLabel: 'Yeniden dene',
          onAction: () {},
        ),
        'notice': (_) => AppDataNotice(
          title: 'Kayıtlar alınamadı',
          message: 'Biraz sonra yeniden deneyin.',
          actionLabel: 'Yeniden dene',
          onAction: () {},
          busy: true,
        ),
        'skeleton': (_) =>
            const AppSkeleton(semanticLabel: 'Kayıtlar yükleniyor'),
        'primary': (_) =>
            AppPrimaryButton(label: 'İzin talebi gönder', onPressed: () {}),
        'secondary': (_) => AppSecondaryButton(
          label: 'Talebi geri çek',
          onPressed: () {},
          destructive: true,
        ),
        'action bar': (_) => AppFormActionBar(
          primaryAction: AppPrimaryButton(
            label: 'İzin talebi gönder',
            onPressed: () {},
          ),
          secondaryAction: AppSecondaryButton(
            label: 'Vazgeç',
            onPressed: () {},
          ),
          supportingText: 'Bilgilerinizi kontrol edin.',
        ),
        'sheet': (_) => const SizedBox(
          height: 650,
          child: AppSheet(
            title: 'Kayıt ayrıntısı',
            body: Text('4 Kasım Çarşamba 13:20'),
          ),
        ),
        'segment': (_) => AppSegmentControl<int>(
          segments: const [
            AppSegment(value: 0, label: 'Kayıtlar'),
            AppSegment(value: 1, label: 'Takvim'),
            AppSegment(value: 2, label: 'Özet'),
          ],
          selected: 1,
          onChanged: (_) {},
        ),
        'text field': (controller) => AppTextField(
          label: 'Gerekçe',
          controller: controller,
          helperText: 'En az beş karakter yazın.',
          errorText: 'Lütfen gerekçeyi tamamlayın.',
        ),
        'date field': (_) => AppDateField(
          label: 'Tarih',
          value: DateTime.utc(2026, 11, 4),
          firstDate: DateTime.utc(2020),
          lastDate: DateTime.utc(2030),
          onChanged: (_) {},
        ),
        'range field': (_) => AppDateRangeField(
          label: 'Ziyaret tarihleri',
          value: DateTimeRange(
            start: DateTime.utc(2026, 11, 4),
            end: DateTime.utc(2026, 11, 6),
          ),
          firstDate: DateTime.utc(2020),
          lastDate: DateTime.utc(2030),
          onChanged: (_) {},
        ),
        'time field': (_) => AppTimeField(
          label: 'Giriş saati',
          value: const TimeOfDay(hour: 13, minute: 20),
          onChanged: (_) {},
        ),
        'select field': (_) => AppSelectField<int>(
          label: 'İzin türü',
          value: 1,
          options: const [
            AppSelectOption(value: 1, label: 'Yıllık izin'),
            AppSelectOption(value: 2, label: 'Diğer'),
          ],
          onChanged: (_) {},
        ),
        'navigation': (_) => AppBottomNavigation(
          selectedIndex: 2,
          onDestinationSelected: (_) {},
        ),
        'metrics': (_) => const AppMetricRow(
          metrics: [
            AppMetric(label: 'İlk giriş', value: '08:52'),
            AppMetric(label: 'Son giriş', value: '13:14'),
            AppMetric(label: 'Son çıkış', value: '—'),
          ],
        ),
        'dialog': (_) => SizedBox(
          height: 600,
          child: AppDialog(
            title: 'Talebi geri çek',
            body: const Text('Bu işlem talebinizi geri çeker.'),
            confirmLabel: 'Talebi geri çek',
            onConfirm: () {},
            cancelLabel: 'Vazgeç',
            destructive: true,
          ),
        ),
        'scaffold': (_) => const SizedBox(
          height: 650,
          child: AppScaffold(
            brandedSystemBar: true,
            body: SingleChildScrollView(
              child: AppBrandBand(title: 'Giriş yap', consumeTopInset: false),
            ),
          ),
        ),
        'surface': (_) => const AppSurface(child: Text('Kayıtlar')),
      };
      for (final entry in factories.entries) {
        testWidgets(
          '${entry.key} renders with semantics dark=$dark scale=$scale',
          (tester) async {
            final controller = TextEditingController(text: 'Bilgi');
            addTearDown(controller.dispose);
            final semantics = tester.ensureSemantics();
            try {
              await mountKit(
                tester,
                entry.value(controller),
                dark: dark,
                scale: scale,
              );
              expect(tester.takeException(), isNull);
              final semanticText = switch (entry.key) {
                'brand' => 'Bugünkü durum',
                'header' => 'Kayıt ayrıntısı',
                'badge' => 'Onay bekliyor',
                'group' => 'Hesap',
                'row' => 'Ana giriş',
                'empty' => 'Henüz kayıt yok',
                'notice' => 'Kayıtlar alınamadı',
                'skeleton' => 'Kayıtlar yükleniyor',
                'primary' || 'action bar' => 'İzin talebi gönder',
                'secondary' || 'dialog' => 'Talebi geri çek',
                'sheet' => 'Kayıt ayrıntısı',
                'segment' => 'Takvim',
                'text field' => 'Gerekçe',
                'date field' => 'Tarih',
                'range field' => 'Ziyaret tarihleri',
                'time field' => 'Giriş saati',
                'select field' => 'İzin türü',
                'navigation' => 'QR İşlemleri',
                'metrics' => 'İlk giriş',
                'scaffold' => 'Giriş yap',
                _ => 'Kayıtlar',
              };
              expect(
                find.bySemanticsLabel(RegExp(RegExp.escape(semanticText))),
                findsWidgets,
              );
            } finally {
              semantics.dispose();
            }
          },
        );
      }
    }
  }
  testWidgets(
    'buttons keep labels, reject duplicate and disabled taps, announce busy once',
    (tester) async {
      var calls = 0;
      var busy = false;
      await mountKit(
        tester,
        StatefulBuilder(
          builder: (context, setState) => Column(
            children: [
              AppPrimaryButton(
                label: 'Gönder',
                busyLabel: 'Gönderiliyor',
                busy: busy,
                onPressed: () {
                  calls++;
                  setState(() => busy = true);
                },
              ),
              const AppSecondaryButton(label: 'Kapalı', onPressed: null),
            ],
          ),
        ),
      );
      await tester.tap(find.text('Gönder'));
      await tester.pump();
      await tester.tap(find.text('Gönderiliyor'));
      await tester.tap(find.text('Kapalı'));
      await tester.pump();
      expect(calls, 1);
      expect(find.text('Gönderiliyor'), findsOneWidget);
      final node = tester.widget<Semantics>(
        find
            .ancestor(
              of: find.byType(FilledButton),
              matching: find.byType(Semantics),
            )
            .first,
      );
      expect(node.properties.enabled, isFalse);
      expect(node.properties.liveRegion, isTrue);
    },
  );
  testWidgets('disabled list and fields do not invoke callbacks', (
    tester,
  ) async {
    var calls = 0;
    await mountKit(
      tester,
      Column(
        children: [
          AppListRow(
            title: 'Kapalı satır',
            onTap: () => calls++,
            enabled: false,
          ),
          AppTimeField(
            label: 'Saat',
            value: null,
            onChanged: (_) => calls++,
            enabled: false,
          ),
          AppSelectField<int>(
            label: 'Tür',
            value: null,
            options: const [AppSelectOption(value: 1, label: 'Seçenek')],
            onChanged: (_) => calls++,
            enabled: false,
          ),
        ],
      ),
    );
    await tester.tap(find.text('Kapalı satır'));
    await tester.tap(find.text('Saat seçin'));
    await tester.tap(find.text('Seçin'));
    await tester.pump();
    expect(calls, 0);
    expect(find.byType(TimePickerDialog), findsNothing);
  });
  testWidgets('date picker cancel preserves value and restores caller focus', (
    tester,
  ) async {
    var calls = 0;
    final focus = FocusNode();
    addTearDown(focus.dispose);
    await mountKit(
      tester,
      AppDateField(
        label: 'Tarih',
        value: DateTime.utc(2026, 11, 4),
        firstDate: DateTime.utc(2026),
        lastDate: DateTime.utc(2027),
        focusNode: focus,
        onChanged: (_) => calls++,
      ),
    );
    await tester.tap(find.text('4 Kas 2026 Çar'));
    await tester.pumpAndSettle();
    expect(find.byType(DatePickerDialog), findsOneWidget);
    await tester.tap(find.text('İptal'));
    await tester.pumpAndSettle();
    expect(calls, 0);
    expect(focus.hasFocus, isTrue);
  });
  testWidgets('time picker is 24 hour, cancellation emits no value', (
    tester,
  ) async {
    var calls = 0;
    await mountKit(
      tester,
      AppTimeField(label: 'Saat', value: null, onChanged: (_) => calls++),
    );
    await tester.tap(find.text('Saat seçin'));
    await tester.pumpAndSettle();
    final context = tester.element(find.byType(TimePickerDialog));
    expect(MediaQuery.alwaysUse24HourFormatOf(context), isTrue);
    await tester.tap(find.text('İptal'));
    await tester.pumpAndSettle();
    expect(calls, 0);
  });
  testWidgets(
    'select sheet respects disabled options and returns chosen value',
    (tester) async {
      int? selected;
      await mountKit(
        tester,
        AppSelectField<int>(
          label: 'Tür',
          value: null,
          options: const [
            AppSelectOption(value: 1, label: 'Kapalı', enabled: false),
            AppSelectOption(value: 2, label: 'Yıllık izin'),
          ],
          onChanged: (v) => selected = v,
        ),
      );
      await tester.tap(find.text('Seçin'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kapalı'));
      await tester.pump();
      expect(selected, isNull);
      await tester.tap(find.text('Yıllık izin'));
      await tester.pumpAndSettle();
      expect(selected, 2);
      expect(find.byType(AppSheet), findsNothing);
    },
  );
  testWidgets('segment arrows skip disabled choices and reveal selected item', (
    tester,
  ) async {
    var selected = 0;
    await mountKit(
      tester,
      StatefulBuilder(
        builder: (context, setState) => AppSegmentControl<int>(
          segments: const [
            AppSegment(value: 0, label: 'Kayıtlar'),
            AppSegment(value: 1, label: 'Takvim', enabled: false),
            AppSegment(value: 2, label: 'Genel istatistikler'),
          ],
          selected: selected,
          onChanged: (v) => setState(() => selected = v),
        ),
      ),
      scale: 2,
    );
    await tester.tap(find.text('Kayıtlar'));
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
    await tester.pumpAndSettle();
    expect(selected, 2);
    expect(find.text('Genel istatistikler').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('keyboard resizes scaffold while footer stays above keyboard', (
    tester,
  ) async {
    await mountKit(
      tester,
      SizedBox(
        height: 500,
        child: AppScaffold(
          body: ListView(children: const [Text('Form')]),
          bottomBar: AppFormActionBar(
            primaryAction: AppPrimaryButton(label: 'Gönder', onPressed: () {}),
          ),
        ),
      ),
      keyboard: 250,
    );
    expect(
      tester.getRect(find.byType(AppFormActionBar)).bottom,
      lessThanOrEqualTo(650),
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets('compact busy buttons preserve size and support reduced motion', (
    tester,
  ) async {
    var busy = false;
    await mountKit(
      tester,
      StatefulBuilder(
        builder: (context, setState) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: Column(
            children: [
              AppPrimaryButton(
                label: 'Gönder',
                busyLabel: 'Gönderiliyor',
                expanded: false,
                busy: busy,
                onPressed: () => setState(() => busy = true),
              ),
              AppSecondaryButton(
                label: 'Kontrol et',
                busy: busy,
                onPressed: () {},
              ),
            ],
          ),
        ),
      ),
    );
    final beforePrimary = tester.getSize(find.byType(FilledButton));
    final beforeSecondary = tester.getSize(find.byType(OutlinedButton));
    await tester.tap(find.text('Gönder'));
    await tester.pump();
    expect(tester.getSize(find.byType(FilledButton)), beforePrimary);
    expect(tester.getSize(find.byType(OutlinedButton)), beforeSecondary);
    expect(
      tester
          .widget<FilledButton>(find.byType(FilledButton))
          .style
          ?.animationDuration,
      Duration.zero,
    );
    expect(
      tester
          .widget<OutlinedButton>(find.byType(OutlinedButton))
          .style
          ?.animationDuration,
      Duration.zero,
    );
  });
  testWidgets(
    'sheet consumes keyboard once and keeps CTA and last error reachable',
    (tester) async {
      await mountKit(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showAppSheet<void>(
              context: context,
              builder: (_) => AppSheet(
                title: 'İzin talebi',
                body: Column(
                  children: [
                    for (var i = 0; i < 12; i++)
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('Form alanı'),
                      ),
                    const Text('Son alan hatası'),
                  ],
                ),
                actionBar: AppFormActionBar(
                  primaryAction: AppPrimaryButton(
                    label: 'Talebi gönder',
                    onPressed: () {},
                  ),
                ),
              ),
            ),
            child: const Text('Formu aç'),
          ),
        ),
        keyboard: 280,
      );
      await tester.tap(find.text('Formu aç'));
      await tester.pumpAndSettle();
      final submit = find.text('Talebi gönder');
      expect(tester.getRect(submit).bottom, lessThanOrEqualTo(620));
      await tester.scrollUntilVisible(
        find.text('Son alan hatası'),
        200,
        scrollable: find
            .descendant(
              of: find.byType(AppSheet),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.text('Son alan hatası').hitTestable(), findsOneWidget);
      expect(submit.hitTestable(), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  group('UI kit layout and accessibility regressions', () {
    for (final dark in [false, true]) {
      testWidgets(
        'RV1-01 52dp controls fill the row; focus ring does not affect layout $dark',
        (tester) async {
          final focus = FocusNode();
          addTearDown(focus.dispose);
          await mount(
            tester,
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppPrimaryButton(
                  label: 'Send',
                  onPressed: () {},
                  focusNode: focus,
                ),
                AppSecondaryButton(
                  label: 'Cancel',
                  onPressed: () {},
                  expanded: true,
                ),
              ],
            ),
            dark: dark,
          );
          for (final type in [FilledButton, OutlinedButton]) {
            expect(tester.getSize(find.byType(type)), const Size(390, 52));
          }
          expect(tester.getSize(find.byType(AppPrimaryButton)).height, 52);
          expect(tester.getSize(find.byType(AppSecondaryButton)).height, 52);
          focus.requestFocus();
          await tester.pumpAndSettle();
          expect(
            tester.getSize(find.byType(FilledButton)),
            const Size(390, 52),
          );
          final ring = tester
              .widgetList<Positioned>(
                find.descendant(
                  of: find.byType(AppPrimaryButton),
                  matching: find.byType(Positioned),
                ),
              )
              .single;
          expect([
            ring.left,
            ring.right,
            ring.top,
            ring.bottom,
          ], everyElement(-5));
        },
      );
      testWidgets(
        'RV1-03 selected first and last rows cannot paint outside rounded group $dark',
        (tester) async {
          const capture = ValueKey('rounded-group');
          await mount(
            tester,
            const RepaintBoundary(
              key: capture,
              child: SizedBox(
                width: 240,
                child: AppListGroup(
                  children: [
                    AppListRow(title: 'First', selected: true),
                    AppListRow(title: 'Last', selected: true),
                  ],
                ),
              ),
            ),
            dark: dark,
          );
          final boundary = tester.renderObject<RenderRepaintBoundary>(
            find.byKey(capture),
          );
          await tester.runAsync(() async {
            final image = await boundary.toImage();
            try {
              final data = await image.toByteData(
                format: ui.ImageByteFormat.rawRgba,
              );
              expect(data, isNotNull);
              int alpha(int x, int y) =>
                  data!.getUint8((y * image.width + x) * 4 + 3);
              expect(alpha(2, 2), 0);
              expect(alpha(2, image.height - 3), 0);
              expect(alpha(120, 8), 255);
            } finally {
              image.dispose();
            }
          });
        },
      );
      testWidgets(
        'RV1-06 disabled destructive uses the exact disabled foreground $dark',
        (tester) async {
          await mount(
            tester,
            const AppSecondaryButton(
              label: 'Delete',
              onPressed: null,
              destructive: true,
            ),
            dark: dark,
          );
          final t = AppUiTokens.of(
            tester.element(find.byType(AppSecondaryButton)),
          );
          final button = tester.widget<OutlinedButton>(
            find.byType(OutlinedButton),
          );
          expect(
            button.style?.foregroundColor?.resolve({WidgetState.disabled}),
            t.disabledForeground,
          );
          expect(
            contrast(t.disabledForeground, t.disabledBackground),
            greaterThanOrEqualTo(3),
          );
          expect(
            DefaultTextStyle.of(
              tester.element(find.text('Delete')),
            ).style.color,
            t.disabledForeground,
          );
        },
      );
      for (final type in [
        FilledButton,
        OutlinedButton,
        TextButton,
        IconButton,
      ]) {
        testWidgets('RV1-07 SDK $type has a 2dp focused border $dark', (
          tester,
        ) async {
          final focus = FocusNode();
          addTearDown(focus.dispose);
          final Widget button;
          if (type == FilledButton) {
            button = FilledButton(
              focusNode: focus,
              onPressed: () {},
              child: const Text('SDK'),
            );
          } else if (type == OutlinedButton) {
            button = OutlinedButton(
              focusNode: focus,
              onPressed: () {},
              child: const Text('SDK'),
            );
          } else if (type == TextButton) {
            button = TextButton(
              focusNode: focus,
              onPressed: () {},
              child: const Text('SDK'),
            );
          } else {
            button = IconButton(
              focusNode: focus,
              onPressed: () {},
              icon: const Icon(Icons.add),
              tooltip: 'SDK',
            );
          }
          await mount(tester, button, dark: dark);
          focus.requestFocus();
          await tester.pumpAndSettle();
          final material = tester.widget<Material>(
            find
                .descendant(
                  of: find.byType(type),
                  matching: find.byType(Material),
                )
                .first,
          );
          final border = material.shape! as OutlinedBorder;
          expect(border.side.width, 2);
          expect(
            border.side.color,
            AppUiTokens.of(tester.element(find.byType(type))).focus,
          );
        });
      }
    }
    for (final locale in ['tr', 'en']) {
      testWidgets(
        'RV1-04 localized empty, missing metric, and field-specific clear $locale',
        (tester) async {
          final handle = tester.ensureSemantics();
          try {
            var clears = 0;
            await mount(
              tester,
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AppDateField(
                    label: 'Date',
                    value: DateTime.utc(2026, 11, 4),
                    firstDate: DateTime.utc(2020),
                    lastDate: DateTime.utc(2030),
                    allowClear: true,
                    onChanged: (value) {
                      if (value == null) clears++;
                    },
                  ),
                  const AppMetricRow(
                    metrics: [AppMetric(label: 'Entry', value: '—')],
                  ),
                  AppSelectField<int>(
                    label: 'Option',
                    value: null,
                    options: const [],
                    onChanged: (_) {},
                  ),
                ],
              ),
              locale: locale,
            );
            final l = AppLocalizations.of(
              tester.element(find.byType(AppDateField)),
            );
            expect(
              find.bySemanticsLabel('Date, ${l.fieldClear}'),
              findsOneWidget,
            );
            expect(
              find.bySemanticsLabel('Entry ${l.metricNoRecord}'),
              findsOneWidget,
            );
            await tester.tap(find.text(l.fieldClear));
            expect(clears, 1);
            await tester.tap(find.text(l.fieldSelectOption));
            await tester.pumpAndSettle();
            expect(find.text(l.fieldNoOptions), findsOneWidget);
          } finally {
            handle.dispose();
          }
        },
      );
    }
    testWidgets(
      'RV1-05 metric semantic override is a single accessible value',
      (tester) async {
        final handle = tester.ensureSemantics();
        try {
          await mount(
            tester,
            const AppMetricRow(
              metrics: [
                AppMetric(
                  label: 'Visible label',
                  value: '08:52',
                  detail: 'Visible detail',
                  semanticLabel: 'First entry at eight fifty two',
                ),
              ],
            ),
          );
          final node = tester.getSemantics(
            find.bySemanticsLabel('First entry at eight fifty two'),
          );
          expect(
            node.getSemanticsData().label,
            'First entry at eight fifty two',
          );
          expect(
            node.debugListChildrenInOrder(
              DebugSemanticsDumpOrder.traversalOrder,
            ),
            isEmpty,
          );
          expect(find.bySemanticsLabel(RegExp('Visible|08:52')), findsNothing);
        } finally {
          handle.dispose();
        }
      },
    );
    for (final scale in [1.0, 1.3, 2.0]) {
      testWidgets(
        'RV1-08 short actions share a phone row until large-text reflow $scale',
        (tester) async {
          await mount(
            tester,
            AppFormActionBar(
              primaryAction: AppPrimaryButton(label: 'Yes', onPressed: () {}),
              secondaryAction: AppSecondaryButton(
                label: 'No',
                onPressed: () {},
              ),
            ),
            scale: scale,
          );
          final primary = tester.getRect(find.byType(FilledButton));
          final secondary = tester.getRect(find.byType(OutlinedButton));
          if (scale <= 1.3) {
            expect(primary.top, secondary.top);
            expect(primary.left, greaterThan(secondary.right));
          } else {
            expect(primary.top, greaterThan(secondary.bottom));
          }
        },
      );
    }
    testWidgets('RV1-08 long action labels stack even on a wide phone', (
      tester,
    ) async {
      await mount(
        tester,
        AppFormActionBar(
          primaryAction: AppPrimaryButton(
            label: 'Send the complete correction request',
            onPressed: () {},
          ),
          secondaryAction: AppSecondaryButton(
            label: 'Keep editing this request',
            onPressed: () {},
          ),
        ),
        width: 480,
      );
      expect(
        tester.getTopLeft(find.byType(FilledButton)).dy,
        greaterThan(tester.getBottomLeft(find.byType(OutlinedButton)).dy),
      );
      expect(tester.takeException(), isNull);
    });
    testWidgets(
      'RV1-10 large-text time retains tabular figures, tone, and spacing',
      (tester) async {
        await mount(
          tester,
          const AppListRow(
            title: 'Denied',
            leadingText: '13:20',
            leadingIcon: Icons.block,
            tone: AppStatusTone.danger,
          ),
          scale: 2,
        );
        final text = tester.widget<Text>(find.text('13:20'));
        final tokens = AppUiTokens.of(tester.element(find.byType(AppListRow)));
        expect(text.style?.color, tokens.danger.foreground);
        expect(
          text.style?.fontFeatures,
          contains(const FontFeature.tabularFigures()),
        );
        expect(
          tester.getTopLeft(find.byIcon(Icons.block)).dy -
              tester.getBottomLeft(find.text('13:20')).dy,
          4,
        );
      },
    );
    testWidgets(
      'RV1-11 arrows do not re-emit selected value when alternatives disabled',
      (tester) async {
        var calls = 0;
        await mount(
          tester,
          AppSegmentControl<int>(
            segments: const [
              AppSegment(value: 0, label: 'A'),
              AppSegment(value: 1, label: 'B', enabled: false),
            ],
            selected: 0,
            onChanged: (_) => calls++,
          ),
        );
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'A'))
            .focusNode
            ?.requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
        await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
        expect(calls, 0);
      },
    );
    testWidgets(
      'RV1-11 unbounded parent uses finite widths and removed nodes are disposed',
      (tester) async {
        var alternate = false;
        late StateSetter update;
        await mount(
          tester,
          StatefulBuilder(
            builder: (context, setState) {
              update = setState;
              return Row(
                children: [
                  AppSegmentControl<int>(
                    segments: [
                      const AppSegment(value: 0, label: 'A'),
                      AppSegment(
                        value: alternate ? 2 : 1,
                        label: alternate ? 'C' : 'B',
                      ),
                    ],
                    selected: 0,
                    onChanged: (_) {},
                  ),
                ],
              );
            },
          ),
        );
        expect(
          tester.getSize(find.byType(AppSegmentControl<int>)).width.isFinite,
          isTrue,
        );
        expect(tester.takeException(), isNull);
        final removed = tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'B'))
            .focusNode!;
        update(() => alternate = true);
        await tester.pumpAndSettle();
        expect(() => removed.addListener(() {}), throwsFlutterError);
        expect(find.text('C'), findsOneWidget);
      },
    );
    testWidgets('RV1-12 sheet announces its route name and scope', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      try {
        await mount(
          tester,
          const SizedBox(
            height: 500,
            child: AppSheet(title: 'Details', body: Text('Body')),
          ),
        );
        final nodes = find.byWidgetPredicate(
          (w) =>
              w is Semantics &&
              w.properties.scopesRoute == true &&
              w.properties.label == 'Details',
        );
        expect(nodes, findsOneWidget);
        final flags = tester
            .getSemantics(nodes)
            .getSemanticsData()
            .flagsCollection;
        expect(flags.scopesRoute, isTrue);
        expect(flags.namesRoute, isTrue);
      } finally {
        handle.dispose();
      }
    });
    testWidgets(
      'RV1-15 shared large-text policy preserves 130 percent boundary',
      (tester) async {
        await mount(
          tester,
          Builder(
            builder: (context) =>
                Text(isLargeText(context) ? 'large' : 'normal'),
          ),
          scale: 1.3,
        );
        expect(find.text('normal'), findsOneWidget);
        await mount(
          tester,
          Builder(
            builder: (context) =>
                Text(isLargeText(context) ? 'large' : 'normal'),
          ),
          scale: 2,
        );
        expect(find.text('large'), findsOneWidget);
      },
    );
  });
  group('sheet dialog and semantics regressions', () {
    for (final ownsScroll in [false, true]) {
      testWidgets(
        'RV2-03 busy blocks drag, barrier, back; idle restores drag ($ownsScroll)',
        (tester) async {
          final busy = ValueNotifier(false);
          addTearDown(busy.dispose);
          await mount(
            tester,
            Builder(
              builder: (context) => TextButton(
                onPressed: () => showAppSheet<void>(
                  context: context,
                  builder: (_) => ValueListenableBuilder<bool>(
                    valueListenable: busy,
                    builder: (_, saving, _) => AppSheet(
                      title: 'Preferences',
                      busy: saving,
                      bodyOwnsScroll: ownsScroll,
                      body: const SizedBox(
                        height: 220,
                        child: Center(child: Text('Options')),
                      ),
                    ),
                  ),
                ),
                child: const Text('Open'),
              ),
            ),
          );
          await tester.tap(find.text('Open'));
          await tester.pumpAndSettle();
          busy.value = true;
          await tester.pump();
          final before = tester.getTopLeft(find.byType(AppSheet));
          // Exercise the handle, title, and body rather than only the close button.
          for (final offset in [
            const Offset(195, 10),
            const Offset(35, 40),
            const Offset(195, 150),
          ]) {
            await tester.flingFrom(before + offset, const Offset(0, 400), 1800);
            await tester.pump(const Duration(milliseconds: 500));
            expect(find.byType(AppSheet), findsOneWidget);
            expect(tester.getTopLeft(find.byType(AppSheet)), before);
          }
          await tester.tapAt(const Offset(20, 80));
          await tester.pump(const Duration(milliseconds: 500));
          expect(find.byType(AppSheet), findsOneWidget);
          await tester.binding.handlePopRoute();
          await tester.pump(const Duration(milliseconds: 500));
          expect(find.byType(AppSheet), findsOneWidget);
          expect(
            tester.widget<IconButton>(find.byType(IconButton)).onPressed,
            isNull,
          );
          busy.value = false;
          await tester.pumpAndSettle();
          await tester.flingFrom(
            tester.getTopLeft(find.byType(AppSheet)) + const Offset(195, 10),
            const Offset(0, 400),
            1800,
          );
          await tester.pumpAndSettle();
          expect(find.byType(AppSheet), findsNothing);
          expect(tester.takeException(), isNull);
        },
      );
    }
    testWidgets('RV2-03 idle sheet remains barrier-dismissible', (
      tester,
    ) async {
      await mount(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showAppSheet<void>(
              context: context,
              builder: (_) =>
                  const AppSheet(title: 'Sheet', body: Text('Body')),
            ),
            child: const Text('Open'),
          ),
        ),
      );
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(20, 80));
      await tester.pumpAndSettle();
      expect(find.byType(AppSheet), findsNothing);
    });
    testWidgets('RV2-08 close-only dialog uses one secondary and dismisses', (
      tester,
    ) async {
      await mount(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showDialog<void>(
              context: context,
              builder: (_) => const AppDialog(
                title: 'Result',
                body: Text('Done'),
                cancelLabel: 'Close',
              ),
            ),
            child: const Text('Open'),
          ),
        ),
      );
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(find.byType(AppSecondaryButton), findsOneWidget);
      expect(find.byType(AppPrimaryButton), findsNothing);
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      expect(find.byType(AppDialog), findsNothing);
    });
    testWidgets(
      'RV2-08 confirm and destructive callbacks retain their behavior',
      (tester) async {
        var confirms = 0;
        var cancels = 0;
        for (final destructive in [false, true]) {
          await mount(
            tester,
            AppDialog(
              title: 'Confirm',
              body: const Text('Details'),
              confirmLabel: 'Continue',
              cancelLabel: 'Cancel',
              destructive: destructive,
              onConfirm: () => confirms++,
              onCancel: () => cancels++,
            ),
          );
          expect(
            find.byType(AppPrimaryButton),
            destructive ? findsNothing : findsOneWidget,
          );
          expect(
            find.byType(AppSecondaryButton),
            findsNWidgets(destructive ? 2 : 1),
          );
          await tester.tap(find.text('Continue'));
          await tester.tap(find.text('Cancel'));
        }
        expect(confirms, 2);
        expect(cancels, 2);
      },
    );
    testWidgets('RV2-08 busy close-only dialog disables its secondary', (
      tester,
    ) async {
      var closes = 0;
      await mount(
        tester,
        AppDialog(
          title: 'Busy',
          body: const Text('Saving'),
          cancelLabel: 'Close',
          busy: true,
          onCancel: () => closes++,
        ),
      );
      await tester.tap(find.text('Close'));
      expect(closes, 0);
      expect(
        tester
            .widget<AppSecondaryButton>(find.byType(AppSecondaryButton))
            .onPressed,
        isNull,
      );
      expect(find.byType(AppPrimaryButton), findsNothing);
    });
    for (final selected in [false, true]) {
      testWidgets(
        'RV2-10 radio row exposes mutually exclusive checked=$selected',
        (tester) async {
          final semantics = tester.ensureSemantics();
          try {
            await mount(
              tester,
              AppListRow(
                title: 'Choice',
                radio: true,
                selected: selected,
                onTap: () {},
              ),
            );
            final flags = tester
                .getSemantics(find.bySemanticsLabel('Choice'))
                .getSemanticsData()
                .flagsCollection;
            expect(flags.isInMutuallyExclusiveGroup, isTrue);
            expect(
              flags.isChecked,
              selected ? CheckedState.isTrue : CheckedState.isFalse,
            );
          } finally {
            semantics.dispose();
          }
        },
      );
    }
    testWidgets('RV2-10 ordinary row does not acquire a radio role', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      try {
        await mount(
          tester,
          AppListRow(title: 'Item', selected: true, onTap: () {}),
        );
        final flags = tester
            .getSemantics(find.bySemanticsLabel('Item'))
            .getSemanticsData()
            .flagsCollection;
        expect(flags.isInMutuallyExclusiveGroup, isFalse);
        expect(flags.isChecked, CheckedState.none);
      } finally {
        semantics.dispose();
      }
    });
    for (final scale in [1.0, 2.0]) {
      testWidgets(
        'RV2-15 metrics announce label value detail once at scale $scale',
        (tester) async {
          final semantics = tester.ensureSemantics();
          try {
            await mount(
              tester,
              const AppMetricRow(
                metrics: [
                  AppMetric(
                    label: 'First entry',
                    value: '08:52',
                    detail: 'Main door',
                  ),
                  AppMetric(label: 'Last exit', value: '—'),
                ],
              ),
              scale: scale,
            );
            for (final label in [
              'First entry 08:52 Main door',
              'Last exit No record',
            ]) {
              final node = tester.getSemantics(find.bySemanticsLabel(label));
              expect(node.getSemanticsData().label, label);
              expect(
                node.debugListChildrenInOrder(
                  DebugSemanticsDumpOrder.traversalOrder,
                ),
                isEmpty,
              );
            }
            expect(
              tester.getTopLeft(find.text('First entry')).dy,
              lessThan(tester.getTopLeft(find.text('08:52')).dy),
            );
            expect(tester.takeException(), isNull);
          } finally {
            semantics.dispose();
          }
        },
      );
    }
  });
  group('invalid date range picker', () {
    TestWidgetsFlutterBinding.ensureInitialized();
    setUpAll(() async {
      // Native range-picker headers assume proportional Material font metrics.
      // Ahem makes the unselected start-date label overflow even at scale 1.
      final configured = Platform.environment['FLUTTER_ROOT'];
      final sdk = configured != null
          ? Directory(configured)
          : File(
              Platform.resolvedExecutable,
            ).parent.parent.parent.parent.parent;
      final loader = FontLoader('Roboto');
      final font = File(
        '${sdk.path}/bin/cache/artifacts/material_fonts/Roboto-Regular.ttf',
      );
      loader.addFont(
        Future.value(ByteData.sublistView(await font.readAsBytes())),
      );
      await loader.load();
    });
    testWidgets(
      'RV1-13 invalid range field stays renderable and opens a clean picker',
      (tester) async {
        await mount(
          tester,
          AppDateRangeField(
            label: 'Dates',
            value: _DraftRange(),
            firstDate: DateTime.utc(2026),
            lastDate: DateTime.utc(2027),
            onChanged: (_) {},
          ),
        );
        expect(tester.takeException(), isNull);
        expect(find.text('Choose a date'), findsOneWidget);
        await tester.tap(find.text('Choose a date'));
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<DateRangePickerDialog>(find.byType(DateRangePickerDialog))
              .initialDateRange,
          isNull,
        );
        expect(tester.takeException(), isNull);
      },
    );
  });
  group('text counters and supporting rows', () {
    TestWidgetsFlutterBinding.ensureInitialized();
    setUpAll(() async {
      // Measure the same proportional glyph widths used by the app, not Ahem.
      final configured = Platform.environment['FLUTTER_ROOT'];
      final sdk = configured != null
          ? Directory(configured)
          : File(
              Platform.resolvedExecutable,
            ).parent.parent.parent.parent.parent;
      final loader = FontLoader('Roboto');
      final font = File(
        '${sdk.path}/bin/cache/artifacts/material_fonts/Roboto-Regular.ttf',
      );
      loader.addFont(
        Future.value(ByteData.sublistView(await font.readAsBytes())),
      );
      await loader.load();
    });

    testWidgets('text field hides counter but keeps maxLength', (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await mount(
        tester,
        AppTextField(
          label: 'Notes',
          controller: controller,
          maxLength: 5,
          showCounter: false,
        ),
      );
      await tester.enterText(find.byType(TextField), 'abcdefgh');
      await tester.pump();
      expect(controller.text, 'abcde');
      expect(find.text('5/5'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('text field shows counter by default', (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await mount(
        tester,
        AppTextField(label: 'Notes', controller: controller, maxLength: 5),
      );
      await tester.enterText(find.byType(TextField), 'abc');
      await tester.pump();
      expect(find.text('3/5'), findsOneWidget);
    });

    for (final (width, scale) in [(390.0, 1.0), (320.0, 2.0)]) {
      testWidgets(
        'list row supporting renders under subtitle at $width/$scale',
        (tester) async {
          await mount(
            tester,
            const AppListRow(
              title: 'Ayşe Yılmaz',
              subtitle: '9–11 Kas, 09:00–18:00',
              supporting: Text('Erişim aktif · İçeride değil'),
              trailing: Icon(Icons.chevron_right),
            ),
            width: width,
            scale: scale,
            locale: 'tr',
          );
          final subtitle = tester.getBottomLeft(
            find.text('9–11 Kas, 09:00–18:00'),
          );
          final supporting = tester.getTopLeft(
            find.text('Erişim aktif · İçeride değil'),
          );
          expect(supporting.dy, greaterThanOrEqualTo(subtitle.dy));
          expect(supporting.dx, closeTo(subtitle.dx, .01));
          expect(tester.takeException(), isNull);
        },
      );
    }
  });
}

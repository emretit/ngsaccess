import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';

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
}

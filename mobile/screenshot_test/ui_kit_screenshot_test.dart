import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:ngsplusapp/widgets/ui/ui.dart';
import '_harness.dart';

void main() {
  AuditTestBinding();
  setUpAll(loadAuditFonts);
  for (final dark in [false, true]) {
    testWidgets('UI kit catalog ${dark ? 'dark' : 'light'}', (tester) async {
      tester.view.physicalSize = const Size(1200, 4200);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final controller = TextEditingController(
        text: 'İzin talebim için açıklama',
      );
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        RepaintBoundary(
          key: captureKey,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
            locale: const Locale('tr'),
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            home: Scaffold(
              bottomNavigationBar: AppBottomNavigation(
                selectedIndex: 0,
                onDestinationSelected: (_) {},
              ),
              body: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const AppBrandBand(
                      title: 'Bileşen kiti',
                      subtitle: 'NGS Plus · Yön B',
                      dateLabel: '4 Kasım Çarşamba',
                      overlapChild: AppSurface(
                        kind: AppSurfaceKind.attendanceOverlap,
                        child: AppMetricRow(
                          metrics: [
                            AppMetric(label: 'İlk giriş', value: '08:52'),
                            AppMetric(label: 'Son giriş', value: '13:14'),
                            AppMetric(label: 'Son çıkış', value: '—'),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const AppPageHeader(
                            title: 'Formlar ve durumlar',
                            subtitle:
                                'Nötr yüzeyler · anlam taşıyan durum renkleri',
                            consumeTopInset: false,
                          ),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: const [
                              AppStatusBadge(
                                label: 'Onaylandı',
                                tone: AppStatusTone.success,
                              ),
                              AppStatusBadge(
                                label: 'Bekliyor',
                                tone: AppStatusTone.warning,
                              ),
                              AppStatusBadge(
                                label: 'İşlem başarısız',
                                tone: AppStatusTone.danger,
                              ),
                              AppStatusBadge(
                                label: 'Bilgi',
                                tone: AppStatusTone.info,
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          AppSegmentControl<int>(
                            segments: const [
                              AppSegment(value: 0, label: 'Kayıtlar'),
                              AppSegment(value: 1, label: 'Takvim'),
                              AppSegment(value: 2, label: 'Özet'),
                            ],
                            selected: 0,
                            onChanged: (_) {},
                          ),
                          const SizedBox(height: 24),
                          AppListGroup(
                            title: 'Bugünkü geçişler',
                            children: [
                              AppListRow(
                                title: 'Ana giriş',
                                subtitle: 'Giriş kaydı',
                                supporting: const Text('Geçiş kaydedildi'),
                                leadingText: '13:14',
                                leadingIcon: Icons.login,
                                onTap: () {},
                                showChevron: true,
                              ),
                              const AppListRow(
                                title: 'Ana giriş',
                                subtitle: 'Çıkış kaydı',
                                leadingText: '12:10',
                                leadingIcon: Icons.logout,
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          AppTextField(
                            label: 'Açıklama',
                            controller: controller,
                            helperText: 'İsteğe bağlı',
                          ),
                          AppCheckboxRow(
                            label: 'Aydınlatma metnini okudum',
                            value: false,
                            errorText: 'Devam etmek için onaylayın',
                            onChanged: (_) {},
                          ),
                          const SizedBox(height: 16),
                          AppDateRangeField(
                            label: 'İzin tarihleri',
                            value: DateTimeRange(
                              start: DateTime.utc(2026, 11, 9),
                              end: DateTime.utc(2026, 11, 11),
                            ),
                            firstDate: DateTime.utc(2026),
                            lastDate: DateTime.utc(2027),
                            onChanged: (_) {},
                          ),
                          const SizedBox(height: 16),
                          AppTimeField(
                            label: 'Giriş saati',
                            value: const TimeOfDay(hour: 8, minute: 52),
                            onChanged: (_) {},
                          ),
                          const SizedBox(height: 16),
                          AppSelectField<int>(
                            label: 'İzin türü',
                            value: 1,
                            options: const [
                              AppSelectOption(value: 1, label: 'Yıllık izin'),
                            ],
                            onChanged: (_) {},
                          ),
                          const SizedBox(height: 24),
                          const AppDataNotice(
                            title: 'Kayıtlar alınamadı',
                            message:
                                'Önceki kayıtlar gösteriliyor. Biraz sonra yeniden deneyin.',
                            tone: AppStatusTone.warning,
                          ),
                          const SizedBox(height: 16),
                          AppPrimaryButton(
                            label: 'İzin talebi gönder',
                            onPressed: () {},
                            icon: Icons.send_outlined,
                          ),
                          AppSecondaryButton(
                            label: 'Filtreleri temizle',
                            onPressed: () {},
                            expanded: true,
                          ),
                          const AppPrimaryButton(
                            label: 'Devre dışı eylem',
                            onPressed: null,
                          ),
                          AppSecondaryButton(
                            label: 'Gönderiliyor',
                            onPressed: () {},
                            busy: true,
                            expanded: true,
                          ),
                          const SizedBox(height: 16),
                          const AppSkeleton(
                            semanticLabel: 'Yükleniyor',
                            itemCount: 1,
                            kind: AppSkeletonKind.list,
                          ),
                          const AppEmptyState(
                            title: 'Henüz kayıt yok',
                            message: 'Yeni geçişleriniz burada görünecek.',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));
      await saveCapture(tester, 'ui_kit_${dark ? 'dark' : 'light'}');
      expect(tester.takeException(), isNull);
    });
  }
}

import 'package:flutter/material.dart';
import 'package:ngsplusapp/l10n/app_localizations.dart';
import 'package:ngsplusapp/screens/history/history_screen.dart';
import 'package:ngsplusapp/theme/app_theme.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/attendance.dart';
import 'package:ngsplusapp/models/attendance_summary.dart';
import 'package:ngsplusapp/providers/attendance_provider.dart';
import 'mocks.dart';

typedef FilterRequest = ({
  String? startDate,
  String? endDate,
  String? deviceId,
});

class HistoryTestProvider extends AttendanceProvider {
  HistoryTestProvider() : super(repository: MockAttendanceRepository());

  @override
  List<Attendance> attendanceRecords = [];
  @override
  Map<String, String> deviceFacets = {};
  @override
  bool hasMore = false;
  @override
  bool isLoading = false;
  @override
  bool isLoadingMore = false;
  @override
  bool listLoaded = true;
  @override
  bool isStale = false;
  @override
  AppError? listError;
  @override
  AppError? loadMoreError;

  int moreCalls = 0;
  int refreshCalls = 0;
  final filters = <FilterRequest>[];
  final ranges = <String>[];
  final summaries = <String, AttendanceSummary>{};
  Completer<void>? refresh;

  @override
  Future<void> setFilters({
    String? startDate,
    String? endDate,
    String? deviceId,
  }) async {
    filters.add((startDate: startDate, endDate: endDate, deviceId: deviceId));
  }

  @override
  Future<void> loadMore() async {
    moreCalls++;
  }

  @override
  Future<void> loadAttendanceRecords() async {
    refreshCalls++;
    await refresh?.future;
  }

  @override
  AttendanceSummary? summaryFor({
    required String startDate,
    required String endDate,
  }) => summaries['$startDate/$endDate'];

  @override
  bool isSummaryLoadingFor({
    required String startDate,
    required String endDate,
  }) => false;

  @override
  AppError? summaryErrorFor({
    required String startDate,
    required String endDate,
  }) => null;

  @override
  Future<AttendanceSummary?> loadSummary({
    required String startDate,
    required String endDate,
  }) async {
    ranges.add('$startDate/$endDate');
    return summaryFor(startDate: startDate, endDate: endDate);
  }

  void publish() => notifyListeners();
}

Attendance event(int index) => Attendance(
  id: 'event-$index',
  employeeId: 'employee',
  deviceId: 'device-$index',
  cardNo: '',
  employeeName: null,
  accessTime: DateTime.utc(2026, 10, 19, 6),
  granted: true,
  direction: 'entry',
  deviceInfo: {'name': 'Entrance $index'},
);

AttendanceSummary summary(String start, String end, int entries) =>
    AttendanceSummary(
      startDate: start,
      endDate: end,
      generatedAt: DateTime.utc(2026, 10, 21, 12),
      days: const [
        AttendanceDaySummary(
          date: '2026-10-19',
          entryCount: 2,
          exitCount: 1,
          deniedCount: 5,
          unknownCount: 0,
          firstEntry: null,
          lastEntry: null,
          lastExit: null,
          lastDirection: AttendanceDirection.exit,
        ),
      ],
      totals: AttendanceTotals(
        entryCount: entries,
        exitCount: 70,
        deniedCount: 12,
        unknownCount: 3,
        presentDays: 18,
      ),
    );

Widget screen(
  HistoryTestProvider provider, {
  double textScale = 1,
  Locale locale = const Locale('en'),
  ThemeMode themeMode = ThemeMode.light,
}) => ChangeNotifierProvider<AttendanceProvider>.value(
  value: provider,
  child: MaterialApp(
    locale: locale,
    theme: AppTheme.lightTheme,
    darkTheme: AppTheme.darkTheme,
    themeMode: themeMode,
    supportedLocales: AppLocalizations.supportedLocales,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: TextScaler.linear(textScale)),
      child: child ?? const SizedBox.shrink(),
    ),
    home: HistoryScreen(now: () => DateTime.utc(2026, 10, 21, 12)),
  ),
);

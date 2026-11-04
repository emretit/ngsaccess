import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/attendance_date.dart';
import '../../core/branch_visibility.dart';
import '../../core/error_localizer.dart';
import '../../l10n/app_localizations.dart';
import '../../models/attendance.dart';
import '../../models/attendance_summary.dart';
import '../../providers/attendance_provider.dart';
import '../../widgets/history/history_calendar.dart';
import '../../widgets/history/history_filter_sheet.dart';
import '../../widgets/history/history_record_tile.dart';
import '../../widgets/history/history_records_list.dart';
import '../../widgets/ui/ui.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, this.now});

  /// Allows period boundaries to be exercised without changing the device clock.
  final DateTime Function()? now;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final TabController _tabs;
  final _scroll = ScrollController();
  DateTime? _selectedDate;
  String? _selectedDeviceId;
  late DateTime _periodInstant;
  bool _weeklyOverview = false;
  DateTime? _calendarSelection;
  DateTime? _calendarMonth;
  bool _isAppActive = true;
  bool _isVisible = true;
  bool _periodReady = false;
  bool _periodCheckScheduled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _isAppActive =
        (WidgetsBinding.instance.lifecycleState ?? AppLifecycleState.resumed) ==
        AppLifecycleState.resumed;
    _periodInstant = widget.now?.call() ?? DateTime.now();
    _tabs = TabController(length: 3, vsync: this)..addListener(_tabChanged);
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _periodReady = true;
      final provider = context.read<AttendanceProvider>();
      unawaited(provider.setFilters());
      unawaited(_loadSummaries(provider));
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Standalone routes/tests have no shell. In the retained shell, history is
    // branch 1 and root overlays make every branch invisible (index -1).
    final visibility = context
        .dependOnInheritedWidgetOfExactType<BranchVisibility>();
    final visible = visibility == null || visibility.activeIndex == 1;
    if (_isVisible == visible) return;
    _isVisible = visible;
    if (visible) _schedulePeriodCheck();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _isAppActive = state == AppLifecycleState.resumed;
    if (_isAppActive) _schedulePeriodCheck();
  }

  void _schedulePeriodCheck() {
    if (_periodCheckScheduled) return;
    _periodCheckScheduled = true;
    // Summary loads notify the provider; visibility can change during build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _periodCheckScheduled = false;
      if (!mounted || !_periodReady || !_isVisible || !_isAppActive) return;
      final now = widget.now?.call() ?? DateTime.now();
      if (AttendanceDate.instantKey(now) ==
          AttendanceDate.instantKey(_periodInstant)) {
        return;
      }
      // A new business day also invalidates totals within the same week/month.
      // Advance before loading so resume + visibility cannot duplicate queries.
      setState(() => _periodInstant = now);
      unawaited(_loadSummaries(context.read<AttendanceProvider>()));
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _tabs.removeListener(_tabChanged);
    _tabs.dispose();
    super.dispose();
  }

  void _tabChanged() {
    if (mounted) setState(() {});
  }

  void _onScroll() {
    if (!mounted || !_scroll.hasClients) return;
    if (_scroll.position.maxScrollExtent <= 0 ||
        _scroll.position.extentAfter > 240) {
      return;
    }
    // Scroll callbacks run outside build and must never establish a listener.
    final provider = context.read<AttendanceProvider>();
    if (provider.hasMore &&
        !provider.isLoading &&
        !provider.isLoadingMore &&
        provider.listError == null) {
      unawaited(provider.loadMore());
    }
  }

  Future<void> _loadSummaries(AttendanceProvider provider) async {
    final month = AttendanceDate.month(_periodInstant);
    final week = AttendanceDate.week(_periodInstant);
    await Future.wait([
      provider.loadSummary(startDate: month.startDate, endDate: month.endDate),
      provider.loadSummary(startDate: week.startDate, endDate: week.endDate),
      if (_calendarMonth case final displayed?)
        if (_calendarRange(displayed).startDate != month.startDate)
          provider.loadSummary(
            startDate: _calendarRange(displayed).startDate,
            endDate: _calendarRange(displayed).endDate,
          ),
    ]);
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    final provider = context.read<AttendanceProvider>();
    setState(() => _periodInstant = widget.now?.call() ?? DateTime.now());
    await Future.wait([
      provider.loadAttendanceRecords(),
      _loadSummaries(provider),
    ]);
    // No widget state is written after the asynchronous refresh.
  }

  void _applyFilter({required DateTime? date, required String? deviceId}) {
    if (!mounted) return;
    setState(() {
      if (!DateUtils.isSameDay(date, _calendarSelection)) {
        _calendarSelection = null;
      }
      _selectedDate = date;
      _selectedDeviceId = deviceId;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
    final day = date == null ? null : AttendanceDate.calendarKey(date);
    // The API accepts inclusive date strings; the server resolves these to
    // [Istanbul midnight, next midnight), including an event exactly at 00:00.
    unawaited(
      context.read<AttendanceProvider>().setFilters(
        startDate: day,
        endDate: day,
        deviceId: deviceId,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return AppScaffold(
      consumeBottomInset: false,
      header: AppPageHeader(
        title: l.historyTitle,
        actions: [
          IconButton(
            tooltip: l.qrRefresh,
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refresh,
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: AppSegmentControl<int>(
                  segments: [
                    AppSegment(value: 0, label: l.historyTabAll),
                    AppSegment(value: 1, label: l.historyTabThisMonth),
                    AppSegment(value: 2, label: l.historyTabStats),
                  ],
                  selected: _tabs.index,
                  onChanged: _tabs.animateTo,
                ),
              ),
              Expanded(
                child: Consumer<AttendanceProvider>(
                  builder: (context, provider, child) => TabBarView(
                    controller: _tabs,
                    children: [
                      _buildRecords(provider),
                      _buildMonth(provider),
                      _buildStats(provider),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRecords(AttendanceProvider provider) {
    final records = provider.attendanceRecords;
    final loadMoreError = provider.loadMoreError;
    final error = identical(provider.listError, loadMoreError)
        ? null
        : provider.listError;
    final days = <List<Attendance>>[];
    for (final record in records) {
      if (days.isEmpty ||
          AttendanceDate.instantKey(days.last.first.timestamp) !=
              AttendanceDate.instantKey(record.timestamp)) {
        days.add(<Attendance>[]);
      }
      days.last.add(record);
    }
    return HistoryRecordsList(
      controller: _scroll,
      recordCount: days.length,
      itemBuilder: (context, index) {
        final dayRecords = days[index];
        return Padding(
          padding: const EdgeInsets.only(top: 20),
          child: AppListGroup(
            title: DateFormat.yMMMEd(
              Localizations.localeOf(context).toLanguageTag(),
            ).format(AttendanceDate.businessTime(dayRecords.first.timestamp)),
            children: [
              for (final record in dayRecords)
                HistoryRecordTile(
                  key: ValueKey(record.id),
                  record: record,
                  accessState: _accessState(record),
                  onTap: () => _showRecordDetails(record),
                ),
            ],
          ),
        );
      },
      hasMore: provider.listLoaded && provider.hasMore,
      isLoading: provider.isLoading || (!provider.listLoaded && error == null),
      isLoadingMore: provider.isLoadingMore,
      hasPreviousData: provider.isStale,
      errorMessage: error == null ? null : localizeAppError(context, error),
      loadMoreErrorMessage: loadMoreError == null
          ? null
          : localizeAppError(context, loadMoreError),
      onRefresh: _refresh,
      onLoadMore: () => unawaited(provider.loadMore()),
      header: _filterHeader(provider),
      emptyHint: _selectedDate != null || _selectedDeviceId != null
          ? AppLocalizations.of(context).historyFilteredEmptyHint
          : null,
      onClearFilters: _selectedDate != null || _selectedDeviceId != null
          ? () => _applyFilter(date: null, deviceId: null)
          : null,
    );
  }

  Widget _filterHeader(AttendanceProvider provider) {
    final l10n = AppLocalizations.of(context);
    final date = _selectedDate;
    final deviceId = _selectedDeviceId;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
          Text(
            [
              date == null ? l10n.historyAllDates : _formatDay(date),
              deviceId == null
                  ? l10n.historyAllDevices
                  : _deviceLabel(provider.deviceFacets[deviceId]),
            ].join(' · '),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          Tooltip(
            message: l10n.historyFilterTitle,
            child: AppSecondaryButton(
              label: l10n.historyFilterTitle,
              icon: Icons.tune_rounded,
              onPressed: _showFilterDialog,
            ),
          ),
          if (date != null || deviceId != null)
            AppSecondaryButton(
              label: l10n.historyFilterClear,
              onPressed: () => _applyFilter(date: null, deviceId: null),
            ),
        ],
      ),
    );
  }

  ({String startDate, String endDate}) _calendarRange(DateTime day) => (
    startDate: AttendanceDate.calendarKey(DateTime(day.year, day.month)),
    endDate: AttendanceDate.calendarKey(DateTime(day.year, day.month + 1, 0)),
  );

  void _changeMonth(int offset) {
    final base = _calendarMonth ?? AttendanceDate.businessTime(_periodInstant);
    final next = DateTime(base.year, base.month + offset);
    setState(() => _calendarMonth = next);
    final range = _calendarRange(next);
    unawaited(
      context.read<AttendanceProvider>().loadSummary(
        startDate: range.startDate,
        endDate: range.endDate,
      ),
    );
  }

  Widget _buildMonth(AttendanceProvider provider) {
    final l = AppLocalizations.of(context);
    final now = AttendanceDate.businessTime(_periodInstant);
    final displayed = _calendarMonth ?? now;
    final month = _calendarRange(displayed);
    final summary = provider.summaryFor(
      startDate: month.startDate,
      endDate: month.endDate,
    );
    final selected = _calendarSelection;
    final loading = provider.isSummaryLoadingFor(
      startDate: month.startDate,
      endDate: month.endDate,
    );
    final monthHeader = Row(
      children: [
        IconButton(
          tooltip: MaterialLocalizations.of(context).previousMonthTooltip,
          onPressed: () => _changeMonth(-1),
          icon: const Icon(Icons.chevron_left),
        ),
        Expanded(
          child: Semantics(
            header: true,
            liveRegion: true,
            child: Text(
              DateFormat.yMMMM(
                Localizations.localeOf(context).toLanguageTag(),
              ).format(displayed),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
        IconButton(
          tooltip: MaterialLocalizations.of(context).nextMonthTooltip,
          onPressed: displayed.year == now.year && displayed.month == now.month
              ? null
              : () => _changeMonth(1),
          icon: const Icon(Icons.chevron_right),
        ),
      ],
    );
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: monthHeader,
        ),
        Expanded(
          child: _refreshablePage([
            const SizedBox(height: 8),
            HistoryCalendar(
              month: displayed,
              today: now,
              selectedDay: selected,
              dayCounts: summary == null
                  ? null
                  : {
                      for (final day in summary.days)
                        day.date:
                            day.entryCount +
                            day.exitCount +
                            day.deniedCount +
                            day.unknownCount,
                    },
              onDaySelected: (day) {
                setState(() => _calendarSelection = day);
                _applyFilter(date: day, deviceId: null);
                _tabs.animateTo(0);
              },
            ),
            const SizedBox(height: 12),
            Text(
              l.historyCalendarLegend,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            Text(
              l.historySelectDayHint,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (summary != null &&
                summary.totals.entryCount +
                        summary.totals.exitCount +
                        summary.totals.deniedCount +
                        summary.totals.unknownCount ==
                    0)
              AppEmptyState(
                title: l.historyNoActivity,
                message: l.historyNoActivityHint,
                icon: Icons.calendar_today_outlined,
              ),
            if (summary == null ||
                loading ||
                provider.summaryErrorFor(
                      startDate: month.startDate,
                      endDate: month.endDate,
                    ) !=
                    null)
              _summaryPanel(provider, month, l.historyMonthSummary),
          ]),
        ),
      ],
    );
  }

  Widget _buildStats(AttendanceProvider provider) {
    final l10n = AppLocalizations.of(context);
    return _refreshablePage([
      AppSegmentControl<bool>(
        segments: [
          AppSegment(value: false, label: l10n.historyTabThisMonthPeriod),
          AppSegment(value: true, label: l10n.historyThisWeek),
        ],
        selected: _weeklyOverview,
        onChanged: (value) => setState(() => _weeklyOverview = value),
      ),
      const SizedBox(height: 16),
      _summaryPanel(
        provider,
        _weeklyOverview
            ? AttendanceDate.week(_periodInstant)
            : AttendanceDate.month(_periodInstant),
        _weeklyOverview ? l10n.historyWeeklySummary : l10n.historyMonthSummary,
      ),
    ]);
  }

  Widget _refreshablePage(List<Widget> children) => RefreshIndicator(
    onRefresh: _refresh,
    child: ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: children,
    ),
  );

  Widget _summaryPanel(
    AttendanceProvider provider,
    ({String startDate, String endDate}) range,
    String title,
  ) {
    final l10n = AppLocalizations.of(context);
    final summary = provider.summaryFor(
      startDate: range.startDate,
      endDate: range.endDate,
    );
    final isLoading = provider.isSummaryLoadingFor(
      startDate: range.startDate,
      endDate: range.endDate,
    );
    final error = provider.summaryErrorFor(
      startDate: range.startDate,
      endDate: range.endDate,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 24),
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        Text(
          AppDateFormat(
            locale: Localizations.localeOf(context),
            now: _periodInstant,
          ).dateRange(
            startDay: AttendanceDate.parseDay(range.startDate),
            endDay: AttendanceDate.parseDay(range.endDate),
          ),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        if (isLoading) ...[
          const SizedBox(height: 12),
          if (summary == null)
            AppSkeleton(
              semanticLabel: l10n.historyLoading,
              kind: AppSkeletonKind.metrics,
              itemCount: 1,
            )
          else
            LinearProgressIndicator(semanticsLabel: l10n.historyLoading),
        ],
        if (error != null || (summary == null && !isLoading)) ...[
          const SizedBox(height: 12),
          AppDataNotice(
            title: summary == null
                ? l10n.historySummaryUnavailable
                : l10n.historyStaleData,
            message: error == null
                ? l10n.historySummaryUnavailable
                : localizeAppError(context, error),
            tone: AppStatusTone.warning,
            actionLabel: l10n.commonRetry,
            onAction: isLoading
                ? null
                : () => unawaited(
                    provider.loadSummary(
                      startDate: range.startDate,
                      endDate: range.endDate,
                    ),
                  ),
          ),
        ],
        if (summary != null) ...[
          const SizedBox(height: 16),
          _summaryNumbers(summary.totals),
          const SizedBox(height: 12),
          Text(
            l10n.homeUpdatedAt(
              AppDateFormat(
                locale: Localizations.localeOf(context),
                now: _periodInstant,
              ).dateTime(summary.generatedAt),
            ),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerLeft,
          child: AppSecondaryButton(
            label: l10n.historyInfoTitle,
            icon: Icons.info_outline_rounded,
            onPressed: _showInfo,
          ),
        ),
      ],
    );
  }

  Widget _summaryNumbers(AttendanceTotals totals) {
    final l = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppMetricRow(
          metrics: [
            AppMetric(
              label: l.historyEntryShort,
              value: '${totals.entryCount}',
            ),
            AppMetric(label: l.historyExitShort, value: '${totals.exitCount}'),
            AppMetric(
              label: l.historyActiveDays,
              value: '${totals.presentDays}',
            ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          children: [
            AppStatusBadge(
              label: '${l.historyDeniedCount}: ${totals.deniedCount}',
              tone: AppStatusTone.danger,
              icon: Icons.block_rounded,
            ),
            AppStatusBadge(
              label: '${l.historyUnknownCount}: ${totals.unknownCount}',
              tone: AppStatusTone.info,
              icon: Icons.help_outline_rounded,
            ),
          ],
        ),
        if (totals.entryCount +
                totals.exitCount +
                totals.deniedCount +
                totals.unknownCount ==
            0)
          AppEmptyState(
            title: l.historyNoActivity,
            message: l.historyNoActivityHint,
            icon: Icons.event_note_outlined,
          ),
      ],
    );
  }

  HistoryAccessState _accessState(Attendance record) =>
      switch (record.decision) {
        AttendanceDecision.granted => HistoryAccessState.granted,
        AttendanceDecision.denied => HistoryAccessState.denied,
        AttendanceDecision.unknown => HistoryAccessState.unknown,
      };

  String _formatDay(DateTime day) => DateFormat.yMd(
    Localizations.localeOf(context).toLanguageTag(),
  ).format(day);

  String _deviceLabel(String? name) => name != null && name.trim().isNotEmpty
      ? name
      : AppLocalizations.of(context).historyUnknownDevice;

  Future<void> _showRecordDetails(Attendance record) async {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final timestamp = AttendanceDate.businessTime(record.timestamp);
    final direction = switch (record.movement) {
      AttendanceDirection.entry => l10n.historyEntryShort,
      AttendanceDirection.exit => l10n.historyExitShort,
      AttendanceDirection.unknown => l10n.historyUnknownDirection,
    };
    final title = switch (record.decision) {
      AttendanceDecision.denied => '${l10n.accessDenied} · $direction',
      AttendanceDecision.unknown => '${l10n.historyUnknownAccess} · $direction',
      AttendanceDecision.granted => direction,
    };
    final location = record.deviceInfo?['location'];
    await showAppSheet<void>(
      context: context,
      builder: (dialogContext) => AppSheet(
        title: l10n.historyRecordDetailTitle,
        body: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppStatusBadge(
              label: title,
              tone: record.denied
                  ? AppStatusTone.danger
                  : record.granted
                  ? AppStatusTone.success
                  : AppStatusTone.info,
            ),
            const SizedBox(height: 16),
            AppListRow(
              title: DateFormat.yMMMMEEEEd(locale).format(timestamp),
              subtitle: l10n.historyDetailDate,
            ),
            AppListRow(
              title: DateFormat.Hms(locale).format(timestamp),
              subtitle: l10n.historyDetailTime,
            ),
            Text(l10n.historyTimeZone),
            AppListRow(title: direction, subtitle: l10n.requestsType),
            AppListRow(
              title: _deviceLabel(record.doorName),
              subtitle: l10n.historyFilterDevice,
            ),
            AppListRow(
              title: location is String && location.trim().isNotEmpty
                  ? location
                  : '—',
              subtitle: l10n.historyDetailLocation,
            ),
            const SizedBox(height: 16),
            Text(l10n.historyRawEvents),
          ],
        ),
      ),
    );
  }

  Future<void> _showInfo() => showAppSheet<void>(
    context: context,
    builder: (context) => AppSheet(
      title: AppLocalizations.of(context).historyInfoTitle,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(AppLocalizations.of(context).historyRawEvents),
          const SizedBox(height: 12),
          Text(AppLocalizations.of(context).historyTimeZone),
        ],
      ),
    ),
  );

  Future<void> _showFilterDialog() async {
    final businessNow = AttendanceDate.businessTime(
      widget.now?.call() ?? DateTime.now(),
    );
    final provider = context.read<AttendanceProvider>();
    final selected = await showAppSheet<HistoryFilters>(
      context: context,
      builder: (context) => ChangeNotifierProvider<AttendanceProvider>.value(
        value: provider,
        child: HistoryFilterSheet(
          initial: (date: _selectedDate, deviceId: _selectedDeviceId),
          today: DateTime(businessNow.year, businessNow.month, businessNow.day),
        ),
      ),
    );
    if (!mounted || selected == null) return;
    _applyFilter(date: selected.date, deviceId: selected.deviceId);
    _tabs.animateTo(0);
  }
}

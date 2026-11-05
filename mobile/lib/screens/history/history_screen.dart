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
import '../../widgets/history/history_day_sheet.dart';
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
    _tabs = TabController(length: 2, vsync: this)..addListener(_tabChanged);
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
    await Future.wait([
      provider.loadSummary(startDate: month.startDate, endDate: month.endDate),
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
                  ],
                  selected: _tabs.index,
                  onChanged: _tabs.animateTo,
                ),
              ),
              Expanded(
                child: Consumer<AttendanceProvider>(
                  builder: (context, provider, child) => TabBarView(
                    controller: _tabs,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [_buildRecords(provider), _buildMonth(provider)],
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

  Future<void> _showDay(DateTime day) async {
    setState(() => _calendarSelection = day);
    final provider = context.read<AttendanceProvider>();
    final range = _calendarRange(day);
    final viewRecords = await showAppSheet<bool>(
      context: context,
      builder: (sheetContext) =>
          ChangeNotifierProvider<AttendanceProvider>.value(
            value: provider,
            child: Consumer<AttendanceProvider>(
              builder: (context, provider, child) => HistoryDaySheet(
                day: day,
                summary: provider.summaryFor(
                  startDate: range.startDate,
                  endDate: range.endDate,
                ),
                isLoading: provider.isSummaryLoadingFor(
                  startDate: range.startDate,
                  endDate: range.endDate,
                ),
                hasError:
                    provider.summaryErrorFor(
                      startDate: range.startDate,
                      endDate: range.endDate,
                    ) !=
                    null,
                onRetry: () => unawaited(
                  provider.loadSummary(
                    startDate: range.startDate,
                    endDate: range.endDate,
                  ),
                ),
                now: _periodInstant,
                onViewRecords: () => Navigator.of(sheetContext).pop(true),
              ),
            ),
          ),
    );
    if (!mounted || viewRecords != true) return;
    _applyFilter(date: day, deviceId: null);
    _tabs.animateTo(0);
  }

  void _backToToday() {
    setState(() => _calendarMonth = null);
    unawaited(_loadSummaries(context.read<AttendanceProvider>()));
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
    final isCurrentMonth =
        displayed.year == now.year && displayed.month == now.month;
    final isLoading = provider.isSummaryLoadingFor(
      startDate: month.startDate,
      endDate: month.endDate,
    );
    final error = provider.summaryErrorFor(
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
          onPressed: isCurrentMonth ? null : () => _changeMonth(1),
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
        if (!isCurrentMonth)
          Align(
            alignment: Alignment.center,
            child: TextButton(
              onPressed: _backToToday,
              child: Text(l.historyBackToToday),
            ),
          ),
        if (isLoading)
          LinearProgressIndicator(
            minHeight: 2,
            semanticsLabel: l.historyLoading,
          ),
        Expanded(
          child: _refreshablePage([
            if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Wrap(
                  spacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      summary == null
                          ? l.historySummaryUnavailable
                          : l.historyStaleData,
                    ),
                    TextButton(
                      onPressed: isLoading
                          ? null
                          : () => unawaited(
                              provider.loadSummary(
                                startDate: month.startDate,
                                endDate: month.endDate,
                              ),
                            ),
                      child: Text(l.commonRetry),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 8),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onHorizontalDragEnd: (details) {
                final velocity = details.primaryVelocity ?? 0;
                if (velocity > 300) _changeMonth(-1);
                if (velocity < -300 && !isCurrentMonth) _changeMonth(1);
              },
              child: HistoryCalendar(
                month: displayed,
                today: now,
                selectedDay: selected,
                days: summary == null
                    ? null
                    : {for (final day in summary.days) day.date: day},
                onDaySelected: (day) => unawaited(_showDay(day)),
              ),
            ),
            _summaryPanel(provider, month, l.historyMonthSummary),
          ]),
        ),
      ],
    );
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton(
              tooltip: l10n.historyInfoTitle,
              icon: const Icon(Icons.info_outline_rounded),
              onPressed: _showInfo,
            ),
          ],
        ),
        if (isLoading && summary == null) ...[
          const SizedBox(height: 12),
          AppSkeleton(
            semanticLabel: l10n.historyLoading,
            kind: AppSkeletonKind.metrics,
            itemCount: 1,
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
        if (totals.deniedCount > 0 || totals.unknownCount > 0) ...[
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              if (totals.deniedCount > 0)
                AppStatusBadge(
                  label: '${l.historyDeniedCount}: ${totals.deniedCount}',
                  tone: AppStatusTone.danger,
                  icon: Icons.block_rounded,
                ),
              if (totals.unknownCount > 0)
                AppStatusBadge(
                  label: '${l.historyUnknownCount}: ${totals.unknownCount}',
                  tone: AppStatusTone.info,
                  icon: Icons.help_outline_rounded,
                ),
            ],
          ),
        ],
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

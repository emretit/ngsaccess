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
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.historyTitle),
        actions: [
          IconButton(
            tooltip: l10n.historyInfoTitle,
            icon: const Icon(Icons.info_outline_rounded),
            onPressed: _showInfo,
          ),
          IconButton(
            tooltip: l10n.qrRefresh,
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refresh,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(64),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(14),
              ),
              child: TabBar(
                controller: _tabs,
                padding: const EdgeInsets.all(4),
                isScrollable: MediaQuery.textScalerOf(context).scale(14) > 19,
                dividerColor: Colors.transparent,
                indicatorSize: TabBarIndicatorSize.tab,
                indicator: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(10),
                ),
                labelColor: Theme.of(context).colorScheme.primary,
                unselectedLabelColor: Theme.of(
                  context,
                ).colorScheme.onSurfaceVariant,
                labelStyle: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                tabs: [
                  Tab(text: l10n.historyTabAll),
                  Tab(text: l10n.historyTabThisMonth),
                  Tab(text: l10n.historyTabStats),
                ],
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 840),
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
    return HistoryRecordsList(
      controller: _scroll,
      recordCount: records.length,
      itemBuilder: (context, index) {
        final record = records[index];
        final day = AttendanceDate.instantKey(record.timestamp);
        final startsDay =
            index == 0 ||
            AttendanceDate.instantKey(records[index - 1].timestamp) != day;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (startsDay)
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 16, 4, 10),
                child: Semantics(
                  header: true,
                  child: Text(
                    DateFormat.yMMMEd(
                      Localizations.localeOf(context).toLanguageTag(),
                    ).format(AttendanceDate.businessTime(record.timestamp)),
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
            HistoryRecordTile(
              key: ValueKey(record.id),
              record: record,
              accessState: _accessState(record),
              onTap: () => _showRecordDetails(record),
            ),
          ],
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
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Tooltip(
                message: l10n.historyFilterTitle,
                child: OutlinedButton.icon(
                  onPressed: _showFilterDialog,
                  icon: const Icon(Icons.tune_rounded, size: 18),
                  label: Text(l10n.historyFilterTitle),
                ),
              ),
              if (date != null || deviceId != null)
                TextButton(
                  onPressed: () => _applyFilter(date: null, deviceId: null),
                  child: Text(l10n.historyFilterClear),
                ),
            ],
          ),
          if (date != null || deviceId != null) ...[
            const SizedBox(height: 6),
            Text(
              [
                if (date != null) _formatDay(date),
                if (deviceId != null)
                  _deviceLabel(provider.deviceFacets[deviceId]),
              ].join(' · '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMonth(AttendanceProvider provider) {
    final month = AttendanceDate.month(_periodInstant);
    final summary = provider.summaryFor(
      startDate: month.startDate,
      endDate: month.endDate,
    );
    final businessNow = AttendanceDate.businessTime(_periodInstant);
    final locale = Localizations.localeOf(context).toLanguageTag();
    return _refreshablePage([
      Text(
        DateFormat.yMMMM(locale).format(businessNow),
        style: Theme.of(context).textTheme.headlineSmall,
      ),
      const SizedBox(height: 8),
      Text(
        AppLocalizations.of(context).historyTimeZone,
        style: Theme.of(context).textTheme.bodySmall,
      ),
      const SizedBox(height: 16),
      if (summary != null)
        HistoryCalendar(
          month: businessNow,
          today: businessNow,
          selectedDay: _calendarSelection,
          dayCounts: {
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
        AppLocalizations.of(context).historyCalendarLegend,
        style: Theme.of(context).textTheme.bodySmall,
      ),
      const SizedBox(height: 8),
      Text(
        AppLocalizations.of(context).historySelectDayHint,
        style: Theme.of(context).textTheme.bodySmall,
      ),
      if (summary == null ||
          provider.isSummaryLoadingFor(
            startDate: month.startDate,
            endDate: month.endDate,
          ) ||
          provider.summaryErrorFor(
                startDate: month.startDate,
                endDate: month.endDate,
              ) !=
              null)
        _summaryPanel(
          provider,
          month,
          AppLocalizations.of(context).historyMonthSummary,
        ),
    ]);
  }

  Widget _buildStats(AttendanceProvider provider) {
    final l10n = AppLocalizations.of(context);
    return _refreshablePage([
      SegmentedButton<bool>(
        segments: [
          ButtonSegment(
            value: false,
            label: Text(l10n.historyTabThisMonthPeriod),
          ),
          ButtonSegment(value: true, label: Text(l10n.historyThisWeek)),
        ],
        selected: {_weeklyOverview},
        showSelectedIcon: false,
        onSelectionChanged: (value) =>
            setState(() => _weeklyOverview = value.single),
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
      padding: const EdgeInsets.all(16),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(
              '${_formatDay(AttendanceDate.parseDay(range.startDate))} – '
              '${_formatDay(AttendanceDate.parseDay(range.endDate))}',
            ),
            if (isLoading) ...[
              const SizedBox(height: 12),
              LinearProgressIndicator(semanticsLabel: l10n.historyLoading),
            ],
            if (error != null || (summary == null && !isLoading)) ...[
              const SizedBox(height: 12),
              Semantics(
                liveRegion: true,
                child: Text(
                  summary == null
                      ? l10n.historySummaryUnavailable
                      : l10n.historyStaleData,
                ),
              ),
              if (error != null) Text(localizeAppError(context, error)),
              TextButton.icon(
                onPressed: isLoading
                    ? null
                    : () => unawaited(
                        provider.loadSummary(
                          startDate: range.startDate,
                          endDate: range.endDate,
                        ),
                      ),
                icon: const Icon(Icons.refresh),
                label: Text(l10n.commonRetry),
              ),
            ],
            if (summary != null) ...[
              const SizedBox(height: 16),
              _summaryNumbers(summary.totals),
              const SizedBox(height: 8),
              Text(
                l10n.homeUpdatedAt(
                  DateFormat.yMd(
                    Localizations.localeOf(context).toLanguageTag(),
                  ).add_Hm().format(
                    AttendanceDate.businessTime(summary.generatedAt),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _summaryNumbers(AttendanceTotals totals) {
    final l10n = AppLocalizations.of(context);
    final metrics = [
      (l10n.historyEntryShort, totals.entryCount),
      (l10n.historyExitShort, totals.exitCount),
      (l10n.historyActiveDays, totals.presentDays),
    ];
    final scale = MediaQuery.textScalerOf(context).scale(14) / 14;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = scale > 1.3 || constraints.maxWidth < 280 ? 1 : 3;
            final cards = [
              for (final (label, count) in metrics)
                Semantics(
                  label: '$label: $count',
                  excludeSemantics: true,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      vertical: 16,
                      horizontal: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '$count',
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(
                                color: Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.w700,
                                fontFeatures: const [
                                  FontFeature.tabularFigures(),
                                ],
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          label,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
            ];
            if (columns == 1) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final card in cards)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: card,
                    ),
                ],
              );
            }
            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (index, card) in cards.indexed) ...[
                    if (index > 0) const SizedBox(width: 8),
                    Expanded(child: card),
                  ],
                ],
              ),
            );
          },
        ),
        if (totals.deniedCount > 0 || totals.unknownCount > 0) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              Text('${l10n.historyDeniedCount}: ${totals.deniedCount}'),
              Text('${l10n.historyUnknownCount}: ${totals.unknownCount}'),
            ],
          ),
        ],
        if (totals.entryCount +
                totals.exitCount +
                totals.deniedCount +
                totals.unknownCount ==
            0) ...[
          const SizedBox(height: 20),
          Text(
            l10n.historyNoActivity,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 6),
          Text(
            l10n.historyNoActivityHint,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
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
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        scrollable: true,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${l10n.historyDetailDate}: ${DateFormat.yMMMMEEEEd(locale).format(timestamp)}',
            ),
            const SizedBox(height: 12),
            Text(
              '${l10n.historyDetailTime}: ${DateFormat.Hms(locale).format(timestamp)}',
            ),
            const Text(AttendanceDate.timeZone),
            const SizedBox(height: 12),
            Text(
              '${l10n.historyDetailLocation}: ${_deviceLabel(record.doorName)}',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.commonClose),
          ),
        ],
      ),
    );
  }

  Future<void> _showInfo() => showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              AppLocalizations.of(context).historyInfoTitle,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            Text(AppLocalizations.of(context).historyRawEvents),
            const SizedBox(height: 8),
            Text(AppLocalizations.of(context).historyTimeZone),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(AppLocalizations.of(context).commonClose),
            ),
          ],
        ),
      ),
    ),
  );

  Future<void> _showFilterDialog() async {
    final businessNow = AttendanceDate.businessTime(
      widget.now?.call() ?? DateTime.now(),
    );
    final provider = context.read<AttendanceProvider>();
    final selected = await showModalBottomSheet<HistoryFilters>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * .9,
      ),
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

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/attendance_date.dart';
import '../../core/error_localizer.dart';
import '../../l10n/app_localizations.dart';
import '../../models/attendance.dart';
import '../../models/attendance_summary.dart';
import '../../providers/attendance_provider.dart';
import '../../widgets/history/history_calendar.dart';
import '../../widgets/history/history_record_tile.dart';
import '../../widgets/history/history_records_list.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, this.now});

  /// Allows period boundaries to be exercised without changing the device clock.
  final DateTime Function()? now;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

enum _FilterAction { date, device, clear }

class _HistoryScreenState extends State<HistoryScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  final _scroll = ScrollController();
  DateTime? _selectedDate;
  String? _selectedDeviceId;
  late DateTime _periodInstant;

  @override
  void initState() {
    super.initState();
    _periodInstant = widget.now?.call() ?? DateTime.now();
    _tabs = TabController(length: 3, vsync: this);
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<AttendanceProvider>();
      unawaited(provider.setFilters());
      unawaited(_loadSummaries(provider));
    });
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _tabs.dispose();
    super.dispose();
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
            tooltip: l10n.qrRefresh,
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refresh,
          ),
          IconButton(
            tooltip: l10n.historyFilterTitle,
            icon: const Icon(Icons.filter_list_rounded),
            onPressed: _showFilterDialog,
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: [
            Tab(text: l10n.historyTabAll, icon: const Icon(Icons.list_rounded)),
            Tab(
              text: l10n.historyTabThisMonth,
              icon: const Icon(Icons.calendar_month_rounded),
            ),
            Tab(
              text: l10n.historyTabStats,
              icon: const Icon(Icons.analytics_rounded),
            ),
          ],
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
      itemBuilder: (context, index) => HistoryRecordTile(
        key: ValueKey(records[index].id),
        record: records[index],
        accessState: _accessState(records[index]),
        onTap: () => _showRecordDetails(records[index]),
      ),
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
    );
  }

  Widget _filterHeader(AttendanceProvider provider) {
    final l10n = AppLocalizations.of(context);
    final date = _selectedDate;
    final deviceId = _selectedDeviceId;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.historyRawEvents),
          const SizedBox(height: 4),
          const Text(AttendanceDate.timeZone),
          if (date != null || deviceId != null) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (date != null)
                  InputChip(
                    label: Text(_formatDay(date)),
                    onDeleted: () =>
                        _applyFilter(date: null, deviceId: deviceId),
                    deleteButtonTooltipMessage: l10n.historyFilterClear,
                  ),
                if (deviceId != null)
                  InputChip(
                    label: Text(_deviceLabel(provider.deviceFacets[deviceId])),
                    onDeleted: () => _applyFilter(date: date, deviceId: null),
                    deleteButtonTooltipMessage: l10n.historyFilterClear,
                  ),
              ],
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
      const Text(AttendanceDate.timeZone),
      const SizedBox(height: 16),
      if (summary != null)
        HistoryCalendar(
          month: businessNow,
          dayCounts: {
            for (final day in summary.days)
              day.date: day.entryCount + day.exitCount,
          },
          onDaySelected: (day) {
            _applyFilter(date: day, deviceId: null);
            _tabs.animateTo(0);
          },
        ),
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
      Text(l10n.historyRawEvents),
      const SizedBox(height: 4),
      const Text(AttendanceDate.timeZone),
      const SizedBox(height: 16),
      _summaryPanel(
        provider,
        AttendanceDate.month(_periodInstant),
        l10n.historyMonthSummary,
      ),
      const SizedBox(height: 16),
      _summaryPanel(
        provider,
        AttendanceDate.week(_periodInstant),
        l10n.historyWeeklySummary,
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
    // Counts come from the independent server range, never the loaded page.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _number(l10n.historyTotalCheckIns, totals.entryCount),
        _number(l10n.historyTotalCheckOuts, totals.exitCount),
        _number(l10n.historyActiveDays, totals.presentDays),
      ],
    );
  }

  Widget _number(String label, int count) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Text('$label: $count'),
  );

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

  Future<void> _showFilterDialog() async {
    final l10n = AppLocalizations.of(context);
    final date = _selectedDate;
    final provider = context.read<AttendanceProvider>();
    final action = await showDialog<_FilterAction>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.historyFilterTitle),
        scrollable: true,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.calendar_today),
              title: Text(l10n.historyFilterDate),
              subtitle: Text(
                date == null ? l10n.historyFilterDateNone : _formatDay(date),
              ),
              onTap: () => Navigator.of(dialogContext).pop(_FilterAction.date),
            ),
            ListTile(
              leading: const Icon(Icons.devices),
              title: Text(l10n.historyFilterDevice),
              subtitle: Text(
                _selectedDeviceId == null
                    ? l10n.historyFilterDeviceNone
                    : _deviceLabel(provider.deviceFacets[_selectedDeviceId]),
              ),
              onTap: () =>
                  Navigator.of(dialogContext).pop(_FilterAction.device),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(_FilterAction.clear),
            child: Text(l10n.historyFilterClear),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.commonClose),
          ),
        ],
      ),
    );
    if (!mounted) return;
    switch (action) {
      case _FilterAction.date:
        await _selectDate();
      case _FilterAction.device:
        await _selectDevice();
      case _FilterAction.clear:
        _applyFilter(date: null, deviceId: null);
      case null:
        return;
    }
  }

  Future<void> _selectDate() async {
    final businessNow = AttendanceDate.businessTime(
      widget.now?.call() ?? DateTime.now(),
    );
    final today = DateTime(
      businessNow.year,
      businessNow.month,
      businessNow.day,
    );
    final selected = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? today,
      firstDate: DateTime(2020),
      lastDate: today,
    );
    if (!mounted || selected == null) return;
    _applyFilter(date: selected, deviceId: _selectedDeviceId);
    _tabs.animateTo(0);
  }

  Future<void> _selectDevice() async {
    final l10n = AppLocalizations.of(context);
    final selected = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.historyFilterDeviceSelectTitle),
        content: SizedBox(
          width: double.maxFinite,
          height: MediaQuery.sizeOf(dialogContext).height * 0.5,
          child: Consumer<AttendanceProvider>(
            builder: (context, provider, child) {
              final devices = provider.deviceFacets.entries.toList()
                ..sort((a, b) {
                  final name = a.value.compareTo(b.value);
                  return name == 0 ? a.key.compareTo(b.key) : name;
                });
              return devices.isEmpty
                  ? Text(l10n.historyEmpty)
                  : ListView.builder(
                      shrinkWrap: true,
                      itemCount: devices.length,
                      itemBuilder: (context, index) {
                        final device = devices[index];
                        final label = _deviceLabel(device.value);
                        final duplicateName =
                            devices
                                .where(
                                  (other) => _deviceLabel(other.value) == label,
                                )
                                .length >
                            1;
                        return ListTile(
                          key: ValueKey('history-device-${device.key}'),
                          title: Text(label),
                          subtitle: duplicateName ? Text(device.key) : null,
                          selected: device.key == _selectedDeviceId,
                          onTap: () =>
                              Navigator.of(dialogContext).pop(device.key),
                        );
                      },
                    );
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.commonCancel),
          ),
        ],
      ),
    );
    if (!mounted || selected == null) return;
    _applyFilter(date: _selectedDate, deviceId: selected);
    _tabs.animateTo(0);
  }
}

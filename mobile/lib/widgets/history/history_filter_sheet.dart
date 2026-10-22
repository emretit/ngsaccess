import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../l10n/app_localizations.dart';
import '../../providers/attendance_provider.dart';

typedef HistoryFilters = ({DateTime? date, String? deviceId});

/// Draft filters stay local until Apply. Dismissing the sheet changes nothing.
class HistoryFilterSheet extends StatefulWidget {
  const HistoryFilterSheet({
    super.key,
    required this.initial,
    required this.today,
  });
  final HistoryFilters initial;
  final DateTime today;

  @override
  State<HistoryFilterSheet> createState() => _HistoryFilterSheetState();
}

class _HistoryFilterSheetState extends State<HistoryFilterSheet> {
  DateTime? _date;
  String? _device;

  @override
  void initState() {
    super.initState();
    _date = widget.initial.date;
    _device = widget.initial.deviceId;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final date = _date;
    final facets =
        context.watch<AttendanceProvider>().deviceFacets.entries.toList()
          ..sort((a, b) {
            final name = a.value.compareTo(b.value);
            return name == 0 ? a.key.compareTo(b.key) : name;
          });
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          0,
          20,
          16 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.historyFilterTitle,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  tooltip: l10n.commonClose,
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      leading: const Icon(Icons.calendar_today_rounded),
                      title: Text(l10n.historyFilterDate),
                      subtitle: Text(
                        date == null
                            ? l10n.historyAllDates
                            : DateFormat.yMMMd(
                                Localizations.localeOf(context).toLanguageTag(),
                              ).format(date),
                      ),
                      children: [
                        CalendarDatePicker(
                          key: ValueKey(_date),
                          initialDate: _date ?? widget.today,
                          firstDate: DateTime(2020),
                          lastDate: widget.today,
                          currentDate: widget.today,
                          onDateChanged: (date) => setState(() => _date = date),
                        ),
                        TextButton(
                          onPressed: () => setState(() => _date = null),
                          child: Text(l10n.historyAllDates),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l10n.historyFilterDevice,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.historyLoadedDevices,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _choice(
                      label: l10n.historyAllDevices,
                      selected: _device == null,
                      onTap: () => setState(() => _device = null),
                    ),
                    if (facets.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(l10n.historyNoDeviceOptions),
                      ),
                    for (final device in facets)
                      _choice(
                        key: ValueKey('history-device-${device.key}'),
                        label: device.value.trim().isEmpty
                            ? l10n.historyUnknownDevice
                            : device.value,
                        // Same-name targets must remain distinguishable.
                        subtitle:
                            facets
                                    .where(
                                      (other) => other.value == device.value,
                                    )
                                    .length >
                                1
                            ? device.key
                            : null,
                        selected: _device == device.key,
                        onTap: () => setState(() => _device = device.key),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => setState(() {
                _date = null;
                _device = null;
              }),
              child: Text(l10n.historyFilterClear),
            ),
            FilledButton(
              key: const Key('history-apply-filters'),
              onPressed: () => Navigator.of(
                context,
              ).pop<HistoryFilters>((date: _date, deviceId: _device)),
              child: Text(l10n.historyApplyFilters),
            ),
          ],
        ),
      ),
    );
  }

  Widget _choice({
    Key? key,
    required String label,
    String? subtitle,
    required bool selected,
    required VoidCallback onTap,
  }) => Semantics(
    selected: selected,
    child: ListTile(
      key: key,
      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      selected: selected,
      title: Text(label),
      subtitle: subtitle == null ? null : Text(subtitle),
      trailing: Icon(
        selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
      ),
      onTap: onTap,
    ),
  );
}

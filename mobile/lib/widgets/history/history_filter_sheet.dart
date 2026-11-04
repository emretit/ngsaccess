import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/attendance_provider.dart';
import '../ui/ui.dart';

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
  final _search = TextEditingController();
  @override
  void initState() {
    super.initState();
    _date = widget.initial.date;
    _device = widget.initial.deviceId;
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final provider = context.watch<AttendanceProvider>();
    final facets = provider.deviceFacets.entries.toList()
      ..sort((a, b) {
        final name = a.value.compareTo(b.value);
        return name == 0 ? a.key.compareTo(b.key) : name;
      });
    final matches = facets
        .where(
          (d) => d.value.toLowerCase().contains(_search.text.toLowerCase()),
        )
        .toList();
    return AppSheet(
      title: l.historyFilterTitle,
      bodyOwnsScroll: true,
      body: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: matches.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppDateField(
                  label: l.historyFilterDate,
                  value: _date,
                  firstDate: DateTime(2020),
                  lastDate: widget.today,
                  allowClear: true,
                  helperText: _date == null ? l.historyAllDates : null,
                  onChanged: (value) => setState(
                    () => _date = value == null
                        ? null
                        : DateTime(value.year, value.month, value.day),
                  ),
                ),
                const SizedBox(height: 16),
                AppTextField(
                  label: l.selectDeviceSearch,
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                Text(
                  l.historyLoadedDevices,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
                _choice(
                  label: l.historyAllDevices,
                  selected: _device == null,
                  onTap: () => setState(() => _device = null),
                ),
                if (_device != null &&
                    !provider.deviceFacets.containsKey(_device))
                  _choice(
                    key: ValueKey('history-device-$_device'),
                    label: l.historyUnknownDevice,
                    subtitle: _device,
                    selected: true,
                    onTap: () {},
                  ),
                if (provider.isLoading)
                  AppSkeleton(semanticLabel: l.historyLoading)
                else if (matches.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(l.historyNoDeviceOptions),
                  ),
              ],
            );
          }
          final device = matches[index - 1];
          return _choice(
            key: ValueKey('history-device-${device.key}'),
            label: device.value.trim().isEmpty
                ? l.historyUnknownDevice
                : device.value,
            subtitle:
                facets.where((other) => other.value == device.value).length > 1
                ? device.key
                : null,
            selected: _device == device.key,
            onTap: () => setState(() => _device = device.key),
          );
        },
      ),
      actionBar: AppFormActionBar(
        primaryAction: AppPrimaryButton(
          key: const Key('history-apply-filters'),
          label: l.historyApplyFilters,
          onPressed: () => Navigator.of(
            context,
          ).pop<HistoryFilters>((date: _date, deviceId: _device)),
        ),
        secondaryAction: AppSecondaryButton(
          label: l.historyFilterClear,
          expanded: true,
          onPressed: () => setState(() {
            _date = null;
            _device = null;
          }),
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
  }) => AppListRow(
    key: key,
    title: label,
    subtitle: subtitle,
    selected: selected,
    radio: true,
    leadingIcon: selected
        ? Icons.radio_button_checked
        : Icons.radio_button_unchecked,
    onTap: onTap,
  );
}

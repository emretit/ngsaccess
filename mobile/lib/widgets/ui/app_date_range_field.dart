import 'package:flutter/material.dart';
import '../../core/app_date_format.dart';
import '../../l10n/app_localizations.dart';
import 'app_date_field.dart';

class AppDateRangeField extends StatelessWidget {
  const AppDateRangeField({
    super.key,
    required this.label,
    required this.value,
    required this.firstDate,
    required this.lastDate,
    required this.onChanged,
    this.helperText,
    this.errorText,
    this.enabled = true,
    this.allowClear = false,
    this.focusNode,
    this.now,
  });
  final String label;
  final DateTimeRange? value;
  final DateTime firstDate;
  final DateTime lastDate;
  final ValueChanged<DateTimeRange?>? onChanged;
  final String? helperText;
  final String? errorText;
  final bool enabled;
  final bool allowClear;
  final FocusNode? focusNode;
  final DateTime Function()? now;
  @override
  Widget build(BuildContext context) => AppPickerField(
    label: label,
    value: value == null
        ? null
        : AppDateFormat(
            locale: Localizations.localeOf(context),
            now: (now ?? DateTime.now)(),
          ).tryDateRange(startDay: value!.start, endDay: value!.end),
    placeholder: AppLocalizations.of(context).fieldSelectDate,
    icon: Icons.date_range_outlined,
    helperText: helperText,
    errorText: errorText,
    enabled: enabled && onChanged != null,
    focusNode: focusNode,
    onClear: allowClear && value != null ? () => onChanged?.call(null) : null,
    onTap: () async {
      final selected = await showDateRangePicker(
        context: context,
        initialDateRange: _validPickerRange,
        currentDate: AppDateFormat.calendarDayFromInstant(
          (now ?? DateTime.now)(),
        ),
        firstDate: firstDate,
        lastDate: lastDate,
      );
      if (selected != null && context.mounted) {
        onChanged?.call(
          DateTimeRange(
            start: DateTime.utc(
              selected.start.year,
              selected.start.month,
              selected.start.day,
            ),
            end: DateTime.utc(
              selected.end.year,
              selected.end.month,
              selected.end.day,
            ),
          ),
        );
      }
    },
  );
  DateTimeRange? get _validPickerRange {
    final range = value;
    if (range == null) return null;
    return DateUtils.dateOnly(
          range.end,
        ).isBefore(DateUtils.dateOnly(range.start))
        ? null
        : range;
  }
}

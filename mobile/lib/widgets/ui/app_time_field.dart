import 'package:flutter/material.dart';
import '../../core/app_date_format.dart';
import '../../l10n/app_localizations.dart';
import 'app_date_field.dart';

class AppTimeField extends StatelessWidget {
  const AppTimeField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.helperText,
    this.errorText,
    this.enabled = true,
    this.allowClear = false,
    this.focusNode,
    this.now,
  });
  final String label;
  final TimeOfDay? value;
  final ValueChanged<TimeOfDay?>? onChanged;
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
          ).timeOfDay(value!),
    placeholder: AppLocalizations.of(context).fieldSelectTime,
    icon: Icons.schedule,
    helperText: helperText,
    errorText: errorText,
    enabled: enabled && onChanged != null,
    focusNode: focusNode,
    onClear: allowClear && value != null ? () => onChanged?.call(null) : null,
    onTap: () async {
      final selected = await showTimePicker(
        context: context,
        initialTime: value ?? const TimeOfDay(hour: 9, minute: 0),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
          child: child ?? const SizedBox.shrink(),
        ),
      );
      if (selected != null && context.mounted) onChanged?.call(selected);
    },
  );
}

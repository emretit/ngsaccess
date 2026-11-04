import 'package:flutter/material.dart';
import '../../l10n/app_localizations.dart';
import 'app_date_field.dart';
import 'app_list_row.dart';
import 'app_sheet.dart';
import 'show_app_sheet.dart';

class AppSelectOption<T extends Object> {
  const AppSelectOption({
    required this.value,
    required this.label,
    this.subtitle,
    this.enabled = true,
    this.key,
  });
  final T value;
  final String label;
  final String? subtitle;
  final bool enabled;
  final Key? key;
}

class AppSelectField<T extends Object> extends StatelessWidget {
  const AppSelectField({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.helperText,
    this.errorText,
    this.enabled = true,
    this.allowClear = false,
    this.focusNode,
  });
  final String label;
  final T? value;
  final List<AppSelectOption<T>> options;
  final ValueChanged<T?>? onChanged;
  final String? helperText;
  final String? errorText;
  final bool enabled;
  final bool allowClear;
  final FocusNode? focusNode;
  @override
  Widget build(BuildContext context) {
    String? selectedLabel;
    for (final option in options) {
      if (option.value == value) selectedLabel = option.label;
    }
    return AppPickerField(
      label: label,
      value: selectedLabel,
      placeholder: AppLocalizations.of(context).fieldSelectOption,
      icon: Icons.expand_more,
      helperText: helperText,
      errorText: errorText,
      enabled: enabled && onChanged != null,
      focusNode: focusNode,
      onClear: allowClear && value != null ? () => onChanged?.call(null) : null,
      onTap: () async {
        final result = await showAppSheet<T>(
          context: context,
          builder: (sheetContext) => AppSheet(
            title: label,
            body: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (options.isEmpty)
                  Text(AppLocalizations.of(context).fieldNoOptions),
                for (final option in options)
                  AppListRow(
                    key: option.key,
                    title: option.label,
                    subtitle: option.subtitle,
                    enabled: option.enabled,
                    selected: option.value == value,
                    leadingIcon: option.value == value
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    onTap: () => Navigator.pop(sheetContext, option.value),
                  ),
              ],
            ),
          ),
        );
        if (result != null && context.mounted) onChanged?.call(result);
      },
    );
  }
}

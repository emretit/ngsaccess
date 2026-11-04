import 'package:flutter/material.dart';
import '../../core/app_date_format.dart';
import '../../l10n/app_localizations.dart';
import 'app_ui_tokens.dart';

class AppDateField extends StatelessWidget {
  const AppDateField({
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
  final DateTime? value;
  final DateTime firstDate;
  final DateTime lastDate;
  final ValueChanged<DateTime?>? onChanged;
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
          ).dayLabel(value!, includeYear: true),
    placeholder: AppLocalizations.of(context).fieldSelectDate,
    icon: Icons.calendar_today_outlined,
    helperText: helperText,
    errorText: errorText,
    enabled: enabled && onChanged != null,
    focusNode: focusNode,
    onClear: allowClear && value != null ? () => onChanged?.call(null) : null,
    onTap: () async {
      final instant = (now ?? DateTime.now)();
      final selected = await showDatePicker(
        context: context,
        initialDate: AppDateFormat.initialPickerDay(
          now: instant,
          value: value,
          firstDate: firstDate,
          lastDate: lastDate,
        ),
        currentDate: AppDateFormat.calendarDayFromInstant(instant),
        firstDate: firstDate,
        lastDate: lastDate,
      );
      if (selected != null && context.mounted) {
        onChanged?.call(
          DateTime.utc(selected.year, selected.month, selected.day),
        );
      }
    },
  );
}

/// One read-only button surface shared by calendar, time, and short selections.
class AppPickerField extends StatefulWidget {
  const AppPickerField({
    super.key,
    required this.label,
    required this.value,
    required this.placeholder,
    required this.icon,
    required this.onTap,
    this.helperText,
    this.errorText,
    this.enabled = true,
    this.onClear,
    this.focusNode,
  });
  final String label;
  final String? value;
  final String placeholder;
  final IconData icon;
  final Future<void> Function() onTap;
  final String? helperText;
  final String? errorText;
  final bool enabled;
  final VoidCallback? onClear;
  final FocusNode? focusNode;
  @override
  State<AppPickerField> createState() => _AppPickerFieldState();
}

class _AppPickerFieldState extends State<AppPickerField> {
  final _internalFocus = FocusNode();
  bool _focused = false;
  bool _open = false;
  FocusNode get _focus => widget.focusNode ?? _internalFocus;
  @override
  void dispose() {
    _internalFocus.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    if (_open || !widget.enabled) return;
    setState(() => _open = true);
    try {
      await widget.onTap();
    } finally {
      if (mounted) {
        setState(() => _open = false);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _focus.requestFocus();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppUiTokens.of(context);
    final c = Theme.of(context).colorScheme;
    final active = widget.enabled && !_open;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          enabled: active,
          label: [
            widget.label,
            widget.value ?? widget.placeholder,
            if (widget.errorText != null) widget.errorText,
            if (widget.helperText != null) widget.helperText,
          ].join(', '),
          onTap: active ? _pick : null,
          child: ExcludeSemantics(
            child: InkWell(
              focusNode: _focus,
              onFocusChange: (v) => setState(() => _focused = v),
              onTap: active ? _pick : null,
              borderRadius: BorderRadius.circular(12),
              child: InputDecorator(
                isFocused: _focused,
                isEmpty: false,
                decoration: InputDecoration(
                  labelText: widget.label,
                  fillColor: widget.enabled ? c.surface : t.disabledBackground,
                  enabled: widget.enabled,
                  errorText: widget.errorText,
                  helperText: widget.helperText,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 28),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.value ?? widget.placeholder,
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(
                                color: !widget.enabled
                                    ? t.disabledForeground
                                    : widget.value == null
                                    ? c.onSurfaceVariant
                                    : c.onSurface,
                              ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Icon(
                        widget.icon,
                        color: widget.enabled ? t.accent : t.disabledForeground,
                        size: 24,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        if (widget.onClear != null)
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton(
              onPressed: active ? widget.onClear : null,
              child: Text(
                AppLocalizations.of(context).fieldClear,
                semanticsLabel:
                    '${widget.label}, ${AppLocalizations.of(context).fieldClear}',
              ),
            ),
          ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    required this.controller,
    this.hintText,
    this.helperText,
    this.errorText,
    this.enabled = true,
    this.readOnly = false,
    this.obscureText = false,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.minLines = 1,
    this.maxLines = 1,
    this.maxLength,
    this.focusNode,
    this.autofillHints,
    this.validator,
    this.onChanged,
    this.onFieldSubmitted,
    this.suffix,
    this.autovalidateMode = AutovalidateMode.onUserInteraction,
    this.autocorrect = true,
    this.enableSuggestions = true,
    this.floatingLabelBehavior,
    this.errorMaxLines,
    this.showCounter = true,
  });
  final String label;
  final TextEditingController controller;
  final String? hintText;
  final String? helperText;
  final String? errorText;
  final bool enabled;
  final bool readOnly;
  final bool obscureText;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final int minLines;
  final int? maxLines;
  final int? maxLength;
  final FocusNode? focusNode;
  final Iterable<String>? autofillHints;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;
  final Widget? suffix;
  final AutovalidateMode autovalidateMode;
  final bool autocorrect;
  final bool enableSuggestions;
  final FloatingLabelBehavior? floatingLabelBehavior;
  final int? errorMaxLines;

  /// false hides the maxLength counter line; the length limit still applies.
  final bool showCounter;
  @override
  Widget build(BuildContext context) => TextFormField(
    controller: controller,
    focusNode: focusNode,
    enabled: enabled,
    readOnly: readOnly,
    obscureText: obscureText,
    keyboardType: keyboardType,
    textInputAction: textInputAction,
    minLines: obscureText ? 1 : minLines,
    maxLines: obscureText ? 1 : maxLines,
    maxLength: maxLength,
    buildCounter: showCounter
        ? null
        : (_, {required currentLength, required isFocused, maxLength}) => null,
    autofillHints: autofillHints,
    validator: validator,
    onChanged: onChanged,
    onFieldSubmitted: onFieldSubmitted,
    autovalidateMode: autovalidateMode,
    autocorrect: autocorrect,
    enableSuggestions: enableSuggestions,
    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
      color: enabled
          ? Theme.of(context).colorScheme.onSurface
          : AppUiTokens.of(context).disabledForeground,
    ),
    decoration: InputDecoration(
      labelText: label,
      fillColor: enabled
          ? Theme.of(context).colorScheme.surface
          : AppUiTokens.of(context).disabledBackground,
      hintText: hintText,
      helperText: helperText,
      errorText: errorText,
      errorMaxLines: errorMaxLines,
      floatingLabelBehavior: floatingLabelBehavior,
      suffixIcon: suffix,
      constraints: const BoxConstraints(minHeight: 56),
    ),
  );
}

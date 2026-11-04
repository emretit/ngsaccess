import 'package:flutter/material.dart';
import 'app_ui_tokens.dart';
import 'app_status_badge.dart';
import 'app_secondary_button.dart';

class AppDataNotice extends StatelessWidget {
  const AppDataNotice({
    super.key,
    required this.message,
    this.tone = AppStatusTone.info,
    this.title,
    this.actionLabel,
    this.onAction,
    this.busy = false,
    this.liveRegion = true,
  });
  final String message;
  final AppStatusTone tone;
  final String? title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool busy;
  final bool liveRegion;
  @override
  Widget build(BuildContext context) {
    final pair = AppUiTokens.of(context).status(tone);
    return Semantics(
      liveRegion: liveRegion,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: pair.background,
          borderRadius: BorderRadius.circular(12),
        ),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: pair.foreground),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(appStatusIcon(tone), color: pair.foreground, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (title != null)
                          Text(
                            title!,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(color: pair.foreground),
                          ),
                        Text(message),
                      ],
                    ),
                  ),
                ],
              ),
              if (actionLabel != null) ...[
                const SizedBox(height: 12),
                AppSecondaryButton(
                  label: actionLabel!,
                  onPressed: onAction,
                  busy: busy,
                ),
              ],
              if (busy && actionLabel == null)
                const ExcludeSemantics(
                  child: Padding(
                    padding: EdgeInsets.only(top: 12),
                    child: LinearProgressIndicator(),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

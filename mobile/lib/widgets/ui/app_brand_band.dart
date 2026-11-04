import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_ui_tokens.dart';

class AppBrandBand extends StatelessWidget {
  const AppBrandBand({
    super.key,
    required this.title,
    this.subtitle,
    this.dateLabel,
    this.brandLabel = 'NGS Plus',
    this.brandMark,
    this.trailing,
    this.overlapChild,
    this.consumeTopInset = true,
  });
  final String title;
  final String? subtitle;
  final String? dateLabel;
  final String brandLabel;
  final Widget? brandMark;
  final Widget? trailing;
  final Widget? overlapChild;
  final bool consumeTopInset;
  @override
  Widget build(BuildContext context) {
    final t = AppUiTokens.of(context);
    final text = Theme.of(context).textTheme;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ColoredBox(
            color: t.bandBackground,
            child: SafeArea(
              top: consumeTopInset,
              bottom: false,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(
                      t.pageInset,
                      0,
                      t.pageInset,
                      24,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 48),
                          child: Row(
                            children: [
                              if (brandMark != null) ...[
                                brandMark!,
                                const SizedBox(width: 12),
                              ],
                              Expanded(
                                child: Text(
                                  brandLabel,
                                  style: text.titleMedium?.copyWith(
                                    color: t.onBand,
                                  ),
                                ),
                              ),
                              if (trailing != null)
                                IconButtonTheme(
                                  data: IconButtonThemeData(
                                    style: Theme.of(context)
                                        .iconButtonTheme
                                        .style
                                        ?.copyWith(
                                          foregroundColor:
                                              WidgetStatePropertyAll(t.onBand),
                                          overlayColor:
                                              WidgetStateProperty.resolveWith(
                                                (states) => t.onBand.withValues(
                                                  alpha:
                                                      states.contains(
                                                        WidgetState.pressed,
                                                      )
                                                      ? 0.08
                                                      : 0.04,
                                                ),
                                              ),
                                          side: WidgetStateProperty.resolveWith(
                                            (states) =>
                                                states.contains(
                                                  WidgetState.focused,
                                                )
                                                ? BorderSide(
                                                    color: t.focusOnBand,
                                                    width: 2,
                                                  )
                                                : BorderSide.none,
                                          ),
                                        ),
                                  ),
                                  child: trailing!,
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Semantics(
                          header: true,
                          child: Text(
                            title,
                            style: text.headlineMedium?.copyWith(
                              color: t.onBand,
                            ),
                          ),
                        ),
                        if (subtitle?.isNotEmpty ?? false) ...[
                          const SizedBox(height: 8),
                          Text(
                            subtitle!,
                            style: text.bodySmall?.copyWith(
                              color: t.onBandMuted,
                            ),
                          ),
                        ],
                        if (dateLabel?.isNotEmpty ?? false) ...[
                          const SizedBox(height: 4),
                          Text(
                            dateLabel!,
                            style: text.bodySmall?.copyWith(
                              color: t.onBandMuted,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (overlapChild != null)
            Stack(
              children: [
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: t.brandOverlap,
                  child: ColoredBox(color: t.bandBackground),
                ),
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: t.pageInset),
                      child: overlapChild,
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

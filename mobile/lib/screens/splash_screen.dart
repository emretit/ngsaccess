import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../widgets/brand_mark.dart';
import '../widgets/ui/ui.dart';

/// Presentation only: the root owns startup, the router owns navigation.
class SplashScreen extends StatelessWidget {
  const SplashScreen({
    super.key,
    this.isFailure = false,
    this.onRetry,
    this.onUseLogin,
    this.message,
  });

  final bool isFailure;
  final VoidCallback? onRetry;
  final VoidCallback? onUseLogin;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AppScaffold(
      brandedSystemBar: true,
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppBrandBand(
              title: isFailure
                  ? l10n.startupFailureTitle
                  : l10n.startupBandTitle,
              brandLabel: l10n.appName,
              brandMark: const BrandMark.band(),
              consumeTopInset: false,
            ),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (!isFailure) ...[
                        Text(l10n.startupTitle),
                        const SizedBox(height: 24),
                        Center(
                          child: CircularProgressIndicator(
                            semanticsLabel: l10n.commonLoading,
                          ),
                        ),
                      ] else ...[
                        AppDataNotice(
                          message: message ?? l10n.startupUnavailable,
                          tone: AppStatusTone.danger,
                        ),
                        const SizedBox(height: 16),
                        Text(l10n.startupContactAdministrator),
                        const SizedBox(height: 24),
                        if (onRetry != null)
                          AppPrimaryButton(
                            label: l10n.startupRetry,
                            onPressed: onRetry,
                          ),
                        const SizedBox(height: 12),
                        if (onUseLogin != null)
                          AppSecondaryButton(
                            expanded: true,
                            label: l10n.startupUseLogin,
                            onPressed: onUseLogin,
                          ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

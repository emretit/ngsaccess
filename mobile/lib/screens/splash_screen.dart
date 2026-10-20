import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../widgets/brand_mark.dart';

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
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const BrandMark(size: 112),
                  const SizedBox(height: 24),
                  Semantics(
                    header: true,
                    child: Text(
                      l10n.startupTitle,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (!isFailure)
                    CircularProgressIndicator(semanticsLabel: l10n.startupTitle)
                  else ...[
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        message ?? l10n.startupUnavailable,
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      l10n.startupContactAdministrator,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    if (onRetry != null)
                      FilledButton(
                        onPressed: onRetry,
                        child: Text(l10n.startupRetry),
                      ),
                    if (onUseLogin != null)
                      TextButton(
                        onPressed: onUseLogin,
                        child: Text(l10n.startupUseLogin),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

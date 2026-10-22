import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../models/visitor.dart';

String visitorStatusLabel(AppLocalizations l10n, VisitorAccessStatus status) =>
    switch (status) {
      VisitorAccessStatus.preRegistered => l10n.visitorPreRegistered,
      VisitorAccessStatus.active => l10n.visitorAccessActive,
      VisitorAccessStatus.checkedOut => l10n.visitorAccessEnded,
      VisitorAccessStatus.expired => l10n.visitorExpired,
    };

String visitorPresenceLabel(AppLocalizations l10n, VisitorPresence presence) =>
    switch (presence) {
      VisitorPresence.unknown => l10n.visitorPresenceUnknown,
      VisitorPresence.inside => l10n.visitorPresenceInside,
      VisitorPresence.outside => l10n.visitorPresenceOutside,
    };

String visitorDate(BuildContext context, DateTime date) {
  final local = date.toLocal();
  final material = MaterialLocalizations.of(context);
  return '${material.formatMediumDate(local)} ${material.formatTimeOfDay(TimeOfDay.fromDateTime(local), alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context))}';
}

String visitorPeriod(BuildContext context, DateTime start, DateTime end) {
  final first = start.toLocal();
  final last = end.toLocal();
  if (first.year == last.year &&
      first.month == last.month &&
      first.day == last.day) {
    final endTime = MaterialLocalizations.of(context).formatTimeOfDay(
      TimeOfDay.fromDateTime(last),
      alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context),
    );
    return '${visitorDate(context, start)} – $endTime';
  }
  return '${visitorDate(context, start)} – ${visitorDate(context, end)}';
}

String visitorSyncLabel(AppLocalizations l10n, VisitorSyncStatus status) =>
    switch (status) {
      VisitorSyncStatus.pending => l10n.visitorSyncPending,
      VisitorSyncStatus.applied => l10n.visitorSyncApplied,
      VisitorSyncStatus.failed => l10n.visitorSyncFailed,
      VisitorSyncStatus.unknown => l10n.visitorSyncUnknown,
    };

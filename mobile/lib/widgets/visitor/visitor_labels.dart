import 'package:flutter/material.dart';

import '../../core/attendance_date.dart';
import '../../l10n/app_localizations.dart';
import '../ui/ui.dart';
import '../../models/visitor.dart';

String visitorStatusLabel(AppLocalizations l10n, VisitorAccessStatus status) =>
    switch (status) {
      VisitorAccessStatus.preRegistered => l10n.visitorPendingShort,
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

/// Picker adapters are the only boundary between Turkey wall parts and instants.
abstract final class VisitorTime {
  static DateTime day(DateTime instant) =>
      AppDateFormat.calendarDayFromInstant(instant);
  static TimeOfDay time(DateTime instant) =>
      TimeOfDay.fromDateTime(AttendanceDate.businessTime(instant));
  static DateTime instant(DateTime day, TimeOfDay time) =>
      AppDateFormat.instantFromTurkeyParts(calendarDay: day, time: time);
}

AppStatusTone visitorStatusTone(VisitorAccessStatus status) => switch (status) {
  VisitorAccessStatus.preRegistered => AppStatusTone.warning,
  VisitorAccessStatus.active => AppStatusTone.success,
  VisitorAccessStatus.checkedOut => AppStatusTone.info,
  VisitorAccessStatus.expired => AppStatusTone.danger,
};

AppDateFormat _format(BuildContext context) =>
    AppDateFormat(locale: Localizations.localeOf(context), now: DateTime.now());

String visitorDate(BuildContext context, DateTime date) =>
    _format(context).dateTime(date);

String visitorPeriod(BuildContext context, DateTime start, DateTime end) {
  final format = _format(context);
  if (VisitorTime.day(start) == VisitorTime.day(end)) {
    return '${format.dateTime(start)} – ${format.clock(end)}';
  }
  return '${format.dateTime(start)} – ${format.dateTime(end)}';
}

String visitorSyncLabel(AppLocalizations l10n, VisitorSyncStatus status) =>
    switch (status) {
      VisitorSyncStatus.pending => l10n.visitorSyncPending,
      VisitorSyncStatus.applied => l10n.visitorSyncApplied,
      VisitorSyncStatus.failed => l10n.visitorSyncFailed,
      VisitorSyncStatus.unknown => l10n.visitorSyncUnknown,
    };

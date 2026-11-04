import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/attendance_date.dart';
import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../models/employee_request.dart';
import '../../providers/request_provider.dart';
import '../../widgets/ui/ui.dart';

String leaveLabel(AppLocalizations l, String type) => switch (type) {
  'annual' => l.requestsLeaveAnnual,
  'sick' => l.requestsLeaveSick,
  'excuse' => l.requestsLeaveExcuse,
  'unpaid' => l.requestsLeaveUnpaid,
  'parental' => l.requestsLeaveParental,
  'marriage' => l.requestsLeaveMarriage,
  'bereavement' => l.requestsLeaveBereavement,
  'paternity' => l.requestsLeavePaternity,
  'lactation' => l.requestsLeaveLactation,
  'compensatory' => l.requestsLeaveCompensatory,
  _ => l.requestsOther,
};
String correctionLabel(AppLocalizations l, String type) => switch (type) {
  'checkIn' => l.requestsCheckIn,
  'checkOut' => l.requestsCheckOut,
  'both' => l.requestsBoth,
  _ => l.requestsOther,
};
String statusLabel(AppLocalizations l, String status) => switch (status) {
  'pending' => l.requestsPending,
  'approved' => l.requestsApproved,
  'rejected' => l.requestsRejected,
  'withdrawn' => l.requestsWithdrawn,
  _ => l.requestsUnknown,
};

class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key});
  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(context.read<RequestProvider>().refresh());
    });
  }

  bool _isLeave = true;

  Future<void> _withdraw(
    String description,
    Future<bool> Function() action,
  ) async {
    final l = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AppDialog(
        title: l.requestsWithdraw,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(description),
            const SizedBox(height: 12),
            Text(l.requestsWithdrawConfirm),
          ],
        ),
        cancelLabel: l.requestsCancel,
        onCancel: () => Navigator.pop(dialogContext, false),
        confirmLabel: l.requestsWithdraw,
        destructive: true,
        onConfirm: () => Navigator.pop(dialogContext, true),
      ),
    );
    if (confirmed != true || !mounted) return;
    final success = await action();
    if (!mounted) return;
    final provider = context.read<RequestProvider>();
    if (provider.busy) return;
    final commandError = provider.commandError;
    final message = success
        ? l.requestsWithdrawnToast
        : provider.uncertain
        ? l.requestsWithdrawUncertain
        : commandError != null
        ? localizeAppError(context, commandError)
        : null;
    if (message != null && ModalRoute.of(context)?.isCurrent == true) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Future<void> _newRequest() async {
    final result = await Navigator.of(context).push<_RequestFormResult>(
      MaterialPageRoute(builder: (_) => RequestFormScreen(isLeave: _isLeave)),
    );
    if (!mounted ||
        result == null ||
        ModalRoute.of(context)?.isCurrent != true) {
      return;
    }
    final l = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result == _RequestFormResult.uncertain
              ? l.requestsUncertain
              : result == _RequestFormResult.leave
              ? l.requestsLeaveSubmitted
              : l.requestsCorrectionSubmitted,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context),
        p = context.watch<RequestProvider>();
    final format = AppDateFormat(
      locale: Localizations.localeOf(context),
      now: DateTime.now(),
    );
    String dates(String start, String end) => format.dateRange(
      startDay: AttendanceDate.parseDay(start),
      endDay: AttendanceDate.parseDay(end),
    );
    final count = _isLeave ? p.leaves.length : p.corrections.length;
    return AppScaffold(
      consumeBottomInset: false,
      header: AppPageHeader(
        title: l.requestsTitle,
        showBack: Navigator.of(context).canPop(),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: AppSegmentControl<bool>(
                  segments: [
                    AppSegment(value: true, label: l.requestsLeave),
                    AppSegment(value: false, label: l.requestsCorrection),
                  ],
                  selected: _isLeave,
                  onChanged: (value) => setState(() => _isLeave = value),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: AppPrimaryButton(
                  label: l.requestsNew,
                  icon: Icons.add,
                  onPressed: p.busy ? null : _newRequest,
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: p.refresh,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: count + 1,
                    itemBuilder: (context, index) {
                      if (index == 0) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (p.loading)
                              count == 0
                                  ? AppSkeleton(semanticLabel: l.commonLoading)
                                  : LinearProgressIndicator(
                                      semanticsLabel: l.commonLoading,
                                    ),
                            if (p.error case final error?)
                              AppDataNotice(
                                message: localizeAppError(context, error),
                                tone: AppStatusTone.danger,
                                actionLabel: l.requestsRetry,
                                onAction: p.loading ? null : p.refresh,
                              ),
                            if (!p.loading && p.error == null && count == 0)
                              AppEmptyState(
                                icon: Icons.event_note_outlined,
                                title: l.requestsEmpty,
                                message: '',
                              ),
                          ],
                        );
                      }
                      if (_isLeave) {
                        final row = p.leaves[index - 1];
                        final range = dates(row.startDate, row.endDate);
                        return _card(
                          busy: p.busy,
                          title: leaveLabel(l, row.leaveType),
                          dates: range,
                          status: row.status,
                          details: row.notes,
                          decision: row.decisionNote,
                          admin: row.isAdmin,
                          withdraw: row.canWithdraw
                              ? () => _withdraw(
                                  '${leaveLabel(l, row.leaveType)} · $range',
                                  () => p.withdrawLeave(row),
                                )
                              : null,
                        );
                      }
                      final row = p.corrections[index - 1];
                      final range = dates(row.date, row.date);
                      return _card(
                        busy: p.busy,
                        title: correctionLabel(l, row.correctionType),
                        dates: range,
                        status: row.status,
                        details: [
                          row.requestedCheckIn,
                          row.requestedCheckOut,
                          row.reason,
                        ].whereType<String>().join(' · '),
                        decision: row.decisionNote,
                        withdraw: row.canWithdraw
                            ? () => _withdraw(
                                '${correctionLabel(l, row.correctionType)} · $range',
                                () => p.withdrawCorrection(row),
                              )
                            : null,
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _card({
    required bool busy,
    required String title,
    required String dates,
    required String status,
    String? details,
    String? decision,
    bool admin = false,
    VoidCallback? withdraw,
  }) {
    final l = AppLocalizations.of(context);
    final badge = AppStatusBadge(
      label: statusLabel(l, status),
      tone: switch (status) {
        'approved' => AppStatusTone.success,
        'rejected' => AppStatusTone.danger,
        'pending' => AppStatusTone.warning,
        _ => AppStatusTone.info,
      },
    );
    final theme = Theme.of(context);
    final heading = Text(title, style: theme.textTheme.titleSmall);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: AppSurface(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LayoutBuilder(
              builder: (context, constraints) =>
                  MediaQuery.textScalerOf(context).scale(14) > 18.2
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [heading, const SizedBox(height: 8), badge],
                    )
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: heading),
                        const SizedBox(width: 12),
                        badge,
                      ],
                    ),
            ),
            const SizedBox(height: 12),
            Text(dates, style: theme.textTheme.bodyMedium),
            if (details != null && details.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                details,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            if (admin) ...[
              const SizedBox(height: 8),
              Text(l.requestsAdmin, style: theme.textTheme.bodySmall),
            ],
            if (decision != null && decision.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                '${l.requestsDecision}: $decision',
                style: theme.textTheme.bodySmall,
              ),
            ],
            if (withdraw != null) ...[
              const SizedBox(height: 16),
              AppSecondaryButton(
                label: l.requestsWithdraw,
                expanded: true,
                onPressed: busy ? null : withdraw,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

enum _RequestFormResult { leave, correction, uncertain }

class RequestFormScreen extends StatefulWidget {
  const RequestFormScreen({super.key, required this.isLeave, this.now});
  final bool isLeave;
  final DateTime Function()? now;
  @override
  State<RequestFormScreen> createState() => _RequestFormScreenState();
}

class _RequestFormScreenState extends State<RequestFormScreen> {
  DateTime _now() => (widget.now ?? DateTime.now)();

  final _text = TextEditingController();
  late String _start = AttendanceDate.instantKey(_now()), _end = _start;
  String _type = 'annual', _correction = 'checkIn';
  String? _in, _out;
  AppError? _validation;
  bool _sending = false;
  @override
  void dispose() {
    _text.dispose();
    for (final node in [
      _textFocus,
      _dateFocus,
      _inFocus,
      _outFocus,
      _noticeFocus,
    ]) {
      node.dispose();
    }
    super.dispose();
  }

  final _textFocus = FocusNode();
  final _dateFocus = FocusNode();
  final _inFocus = FocusNode();
  final _outFocus = FocusNode();
  final _noticeFocus = FocusNode();
  final _noticeKey = GlobalKey();

  String? get _errorField {
    final error = _validation;
    if (error is! BusinessError) return error == null ? null : 'notice';
    return switch (error.safeCode) {
      'REQUEST_NOTE_TOO_LONG' || 'CORRECTION_REASON_LENGTH' => 'text',
      'REQUEST_DATE_INVALID' ||
      'REQUEST_RANGE_INVALID' ||
      'REQUEST_START_TOO_OLD' ||
      'REQUEST_RANGE_TOO_LONG' ||
      'REQUEST_OVERLAP_PENDING' ||
      'REQUEST_OVERLAP_APPROVED' ||
      'CORRECTION_DATE_OUT_OF_RANGE' ||
      'CORRECTION_PENDING_EXISTS' => 'date',
      'CORRECTION_TIMES_MISMATCH' || 'CORRECTION_TIME_INVALID' =>
        _correction != 'checkOut' && _in == null ? 'in' : 'out',
      _ => 'notice',
    };
  }

  void _focusError() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final node = switch (_errorField) {
        'text' => _textFocus,
        'date' => _dateFocus,
        'in' => _inFocus,
        'out' => _outFocus,
        _ => _noticeFocus,
      };
      node.requestFocus();
      final target = node.context ?? _noticeKey.currentContext;
      if (target != null) Scrollable.ensureVisible(target, alignment: .3);
    });
  }

  Future<void> _submit() async {
    if (_sending) return;
    final p = context.read<RequestProvider>();
    if (p.busy) return;
    final today = AttendanceDate.instantKey(_now());
    final notes = _text.text.trim();
    try {
      if (widget.isLeave) {
        RequestValidation.leave(
          startDate: _start,
          endDate: _end,
          today: today,
          notes: notes,
          existing: p.leaves,
        );
      } else {
        RequestValidation.correction(
          date: _start,
          today: today,
          correctionType: _correction,
          reason: _text.text,
          existing: p.corrections,
          requestedCheckIn: _correction == 'checkOut' ? null : _in,
          requestedCheckOut: _correction == 'checkIn' ? null : _out,
        );
      }
    } on AppError catch (e) {
      setState(() => _validation = e);
      _focusError();
      return;
    }
    setState(() {
      _sending = true;
      _validation = null;
    });
    final success = widget.isLeave
        ? await p.submitLeave(
            leaveType: _type,
            startDate: _start,
            endDate: _end,
            notes: notes,
          )
        : await p.submitCorrection(
            date: _start,
            correctionType: _correction,
            reason: _text.text.trim(),
            requestedCheckIn: _correction == 'checkOut' ? null : _in,
            requestedCheckOut: _correction == 'checkIn' ? null : _out,
          );
    if (!mounted) return;
    setState(() => _sending = false);
    if (success || p.uncertain) {
      final ownRoute = ModalRoute.of(context);
      if (ownRoute == null) return;
      final result = p.uncertain
          ? _RequestFormResult.uncertain
          : widget.isLeave
          ? _RequestFormResult.leave
          : _RequestFormResult.correction;
      final navigator = Navigator.of(context);
      if (ownRoute.isCurrent) {
        navigator.pop(result);
      } else {
        navigator.removeRoute(ownRoute, result);
      }
    } else {
      setState(() => _validation = p.commandError);
      _focusError();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final busy = _sending || context.watch<RequestProvider>().busy;
    final today = AttendanceDate.parseDay(AttendanceDate.instantKey(_now()));
    final first = today.subtract(const Duration(days: 30));
    final error = _validation;
    String? errorFor(String field) => error != null && _errorField == field
        ? localizeAppError(context, error)
        : null;
    TimeOfDay? time(String? value) => value == null
        ? null
        : TimeOfDay(
            hour: int.parse(value.substring(0, 2)),
            minute: int.parse(value.substring(3)),
          );
    void setTime(bool checkIn, TimeOfDay? value) => setState(() {
      final text = value == null
          ? null
          : '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
      if (checkIn) {
        _in = text;
      } else {
        _out = text;
      }
    });
    final typeField = AppSelectField<String>(
      label: l.requestsType,
      value: widget.isLeave ? _type : _correction,
      options: [
        for (final type
            in widget.isLeave ? leaveTypes : ['checkIn', 'checkOut', 'both'])
          AppSelectOption(
            value: type,
            label: widget.isLeave
                ? leaveLabel(l, type)
                : correctionLabel(l, type),
          ),
      ],
      enabled: !busy,
      onChanged: (value) {
        if (value != null) {
          setState(() {
            if (widget.isLeave) {
              _type = value;
            } else {
              _correction = value;
            }
          });
        }
      },
    );
    return PopScope(
      canPop: !busy,
      child: AppScaffold(
        consumeBottomInset: false,
        header: AppPageHeader(
          title: widget.isLeave
              ? l.requestsLeaveFormTitle
              : l.requestsCorrectionFormTitle,
          showBack: true,
          onBack: busy ? () {} : () => Navigator.maybePop(context),
        ),
        body: Column(
          children: [
            Expanded(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      if (widget.isLeave) ...[
                        typeField,
                        const SizedBox(height: 16),
                      ],
                      if (widget.isLeave)
                        AppDateRangeField(
                          now: _now,
                          label: '${l.requestsStart} / ${l.requestsEnd}',
                          value: DateTimeRange(
                            start: AttendanceDate.parseDay(_start),
                            end: AttendanceDate.parseDay(_end),
                          ),
                          firstDate: first,
                          lastDate: DateTime(today.year + 10, 12, 31),
                          enabled: !busy,
                          focusNode: _dateFocus,
                          errorText: errorFor('date'),
                          onChanged: (value) {
                            if (value != null) {
                              setState(() {
                                _start = AttendanceDate.calendarKey(
                                  value.start,
                                );
                                _end = AttendanceDate.calendarKey(value.end);
                              });
                            }
                          },
                        )
                      else
                        AppDateField(
                          now: _now,
                          label: l.requestsDate,
                          value: AttendanceDate.parseDay(_start),
                          firstDate: first,
                          lastDate: today,
                          enabled: !busy,
                          focusNode: _dateFocus,
                          errorText: errorFor('date'),
                          onChanged: (value) {
                            if (value != null) {
                              setState(
                                () =>
                                    _start = AttendanceDate.calendarKey(value),
                              );
                            }
                          },
                        ),
                      const SizedBox(height: 16),
                      if (!widget.isLeave) ...[
                        typeField,
                        const SizedBox(height: 16),
                      ],
                      if (!widget.isLeave && _correction != 'checkOut') ...[
                        AppTimeField(
                          now: _now,
                          key: const Key('request-check-in-time'),
                          label: l.requestsCheckIn,
                          value: time(_in),
                          enabled: !busy,
                          focusNode: _inFocus,
                          errorText: errorFor('in'),
                          onChanged: (value) => setTime(true, value),
                        ),
                        const SizedBox(height: 16),
                      ],
                      if (!widget.isLeave && _correction != 'checkIn') ...[
                        AppTimeField(
                          now: _now,
                          key: const Key('request-check-out-time'),
                          label: l.requestsCheckOut,
                          value: time(_out),
                          enabled: !busy,
                          focusNode: _outFocus,
                          errorText: errorFor('out'),
                          onChanged: (value) => setTime(false, value),
                        ),
                        const SizedBox(height: 16),
                      ],
                      if (!widget.isLeave) ...[
                        Text(
                          l.requestsTimeZoneHint,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 16),
                      ],
                      AppTextField(
                        key: Key(
                          widget.isLeave ? 'request-notes' : 'request-reason',
                        ),
                        label: widget.isLeave
                            ? l.requestsNotes
                            : l.requestsReason,
                        controller: _text,
                        focusNode: _textFocus,
                        enabled: !busy,
                        maxLength: widget.isLeave ? 500 : 300,
                        minLines: 3,
                        maxLines: 5,
                        textInputAction: TextInputAction.newline,
                        keyboardType: TextInputType.multiline,
                        errorText: errorFor('text'),
                        errorMaxLines: 6,
                      ),
                      if (errorFor('notice') case final message?)
                        Focus(
                          key: _noticeKey,
                          focusNode: _noticeFocus,
                          child: AppDataNotice(
                            message: message,
                            tone: AppStatusTone.danger,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            AppFormActionBar(
              primaryAction: AppPrimaryButton(
                key: const Key('request-submit'),
                label: widget.isLeave
                    ? l.requestsLeaveSubmit
                    : l.requestsCorrectionSubmit,
                busyLabel: widget.isLeave
                    ? l.requestsLeaveSubmitting
                    : l.requestsCorrectionSubmitting,
                busy: busy,
                onPressed: busy ? null : _submit,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

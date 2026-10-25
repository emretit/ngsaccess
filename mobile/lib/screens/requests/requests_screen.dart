import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/attendance_date.dart';
import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../models/employee_request.dart';
import '../../providers/request_provider.dart';

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

  Future<void> _withdraw(Future<bool> Function() action) async {
    final l = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.requestsWithdrawConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l.requestsCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l.requestsWithdraw),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final success = await action();
    if (!mounted || success) return;
    final provider = context.read<RequestProvider>();
    if (provider.busy) return;
    if (provider.uncertain) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l.requestsWithdrawUncertain)));
      return;
    }
    final error = provider.commandError;
    if (error != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(localizeAppError(context, error))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context),
        p = context.watch<RequestProvider>();
    return DefaultTabController(
      length: 2,
      child: Builder(
        builder: (context) => Scaffold(
          appBar: AppBar(
            title: Text(l.requestsTitle),
            bottom: TabBar(
              tabs: [
                Tab(text: l.requestsLeave),
                Tab(text: l.requestsCorrection),
              ],
            ),
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: p.busy
                ? null
                : () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => RequestFormScreen(
                        isLeave: DefaultTabController.of(context).index == 0,
                      ),
                    ),
                  ),
            icon: const Icon(Icons.add),
            label: Text(l.requestsNew),
          ),
          body: TabBarView(
            children: [
              _list(
                p,
                p.leaves
                    .map(
                      (row) => _card(
                        title: leaveLabel(l, row.leaveType),
                        dates: '${row.startDate} – ${row.endDate}',
                        status: row.status,
                        details: row.notes,
                        decision: row.decisionNote,
                        admin: row.isAdmin,
                        withdraw: row.canWithdraw
                            ? () => _withdraw(() => p.withdrawLeave(row))
                            : null,
                      ),
                    )
                    .toList(),
              ),
              _list(
                p,
                p.corrections
                    .map(
                      (row) => _card(
                        title: correctionLabel(l, row.correctionType),
                        dates: row.date,
                        status: row.status,
                        details: [
                          row.requestedCheckIn,
                          row.requestedCheckOut,
                          row.reason,
                        ].whereType<String>().join(' · '),
                        decision: row.decisionNote,
                        withdraw: row.canWithdraw
                            ? () => _withdraw(() => p.withdrawCorrection(row))
                            : null,
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _list(RequestProvider p, List<Widget> children) {
    final l = AppLocalizations.of(context);
    return RefreshIndicator(
      onRefresh: p.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (p.loading) const Center(child: CircularProgressIndicator()),
          if (p.error case final error?) ...[
            Text(localizeAppError(context, error)),
            TextButton(
              onPressed: p.loading ? null : p.refresh,
              child: Text(l.requestsRetry),
            ),
          ] else if (!p.loading && children.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Center(child: Text(l.requestsEmpty)),
            ),
          ...children,
        ],
      ),
    );
  }

  Widget _card({
    required String title,
    required String dates,
    required String status,
    String? details,
    String? decision,
    bool admin = false,
    VoidCallback? withdraw,
  }) {
    final l = AppLocalizations.of(context), theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: theme.textTheme.titleMedium),
            Text(dates),
            Chip(label: Text(statusLabel(l, status))),
            if (details != null && details.isNotEmpty) Text(details),
            if (admin)
              Text(l.requestsAdmin, style: theme.textTheme.labelMedium),
            if (decision != null && decision.isNotEmpty)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: status == 'rejected'
                      ? theme.colorScheme.errorContainer
                      : theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${l.requestsDecision}: $decision',
                  style: TextStyle(
                    color: status == 'rejected'
                        ? theme.colorScheme.onErrorContainer
                        : theme.colorScheme.onSurface,
                    fontWeight: status == 'rejected'
                        ? FontWeight.bold
                        : FontWeight.normal,
                  ),
                ),
              ),
            if (withdraw != null)
              TextButton(
                onPressed: context.watch<RequestProvider>().busy
                    ? null
                    : withdraw,
                child: Text(l.requestsWithdraw),
              ),
          ],
        ),
      ),
    );
  }
}

class RequestFormScreen extends StatefulWidget {
  const RequestFormScreen({super.key, required this.isLeave});
  final bool isLeave;
  @override
  State<RequestFormScreen> createState() => _RequestFormScreenState();
}

class _RequestFormScreenState extends State<RequestFormScreen> {
  final _text = TextEditingController();
  late String _start = AttendanceDate.instantKey(DateTime.now()), _end = _start;
  String _type = 'annual', _correction = 'checkIn';
  String? _in, _out;
  AppError? _validation;
  bool _sending = false;
  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _date(bool end) async {
    final today = AttendanceDate.parseDay(
      AttendanceDate.instantKey(DateTime.now()),
    );
    final lowerBound = today.subtract(const Duration(days: 30));
    final start = AttendanceDate.parseDay(_start);
    final firstDate = widget.isLeave && end && start.isAfter(lowerBound)
        ? start
        : lowerBound;
    final picked = await showDatePicker(
      context: context,
      initialDate: AttendanceDate.parseDay(end ? _end : _start),
      firstDate: firstDate,
      lastDate: widget.isLeave ? DateTime(today.year + 10, 12, 31) : today,
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (end) {
        _end = AttendanceDate.calendarKey(picked);
      } else {
        _start = AttendanceDate.calendarKey(picked);
        if (widget.isLeave && _end.compareTo(_start) < 0) _end = _start;
      }
    });
  }

  Future<void> _time(bool checkIn) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 9, minute: 0),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child ?? const SizedBox.shrink(),
      ),
    );
    if (picked == null || !mounted) return;
    final value =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    setState(() {
      if (checkIn) {
        _in = value;
      } else {
        _out = value;
      }
    });
  }

  Future<void> _submit() async {
    if (_sending) return;
    final p = context.read<RequestProvider>();
    if (p.busy) return;
    final today = AttendanceDate.instantKey(DateTime.now());
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
      if (p.uncertain) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).requestsUncertain),
          ),
        );
      }
      Navigator.pop(context);
    } else {
      setState(() => _validation = p.commandError);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context),
        busy = _sending || context.watch<RequestProvider>().busy;
    return PopScope(
      canPop: !busy,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.isLeave ? l.requestsLeave : l.requestsCorrection),
        ),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (widget.isLeave)
              DropdownButtonFormField<String>(
                initialValue: _type,
                decoration: InputDecoration(labelText: l.requestsType),
                items: leaveTypes
                    .map(
                      (type) => DropdownMenuItem(
                        value: type,
                        child: Text(leaveLabel(l, type)),
                      ),
                    )
                    .toList(),
                onChanged: busy
                    ? null
                    : (value) {
                        if (value != null) setState(() => _type = value);
                      },
              )
            else
              DropdownButtonFormField<String>(
                initialValue: _correction,
                decoration: InputDecoration(labelText: l.requestsType),
                items: ['checkIn', 'checkOut', 'both']
                    .map(
                      (type) => DropdownMenuItem(
                        value: type,
                        child: Text(correctionLabel(l, type)),
                      ),
                    )
                    .toList(),
                onChanged: busy
                    ? null
                    : (value) {
                        if (value != null) setState(() => _correction = value);
                      },
              ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: busy ? null : () => _date(false),
              child: Text(
                '${widget.isLeave ? l.requestsStart : l.requestsDate}: $_start',
              ),
            ),
            if (widget.isLeave)
              OutlinedButton(
                onPressed: busy ? null : () => _date(true),
                child: Text('${l.requestsEnd}: $_end'),
              ),
            if (!widget.isLeave && _correction != 'checkOut')
              OutlinedButton(
                onPressed: busy ? null : () => _time(true),
                child: Text('${l.requestsCheckIn}: ${_in ?? 'HH:mm'}'),
              ),
            if (!widget.isLeave && _correction != 'checkIn')
              OutlinedButton(
                onPressed: busy ? null : () => _time(false),
                child: Text('${l.requestsCheckOut}: ${_out ?? 'HH:mm'}'),
              ),
            TextField(
              controller: _text,
              enabled: !busy,
              maxLength: widget.isLeave ? 500 : 300,
              minLines: 3,
              maxLines: 5,
              decoration: InputDecoration(
                labelText: widget.isLeave ? l.requestsNotes : l.requestsReason,
              ),
            ),
            if (_validation case final error?)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  localizeAppError(context, error),
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            FilledButton(
              onPressed: busy ? null : _submit,
              child: busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(l.requestsSubmit),
            ),
          ],
        ),
      ),
    );
  }
}

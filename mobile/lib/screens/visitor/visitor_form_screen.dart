import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../models/visitor.dart';
import '../../providers/visitor_provider.dart';
import '../../widgets/visitor/visitor_labels.dart';

class VisitorFormScreen extends StatefulWidget {
  const VisitorFormScreen({super.key, this.visitor});
  final Visitor? visitor;
  @override
  State<VisitorFormScreen> createState() => _VisitorFormScreenState();
}

class _VisitorFormScreenState extends State<VisitorFormScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _first, _last, _phone, _purpose, _notes;
  late DateTime _start, _end;
  late final String _requestId;
  late final int _sessionEpoch;
  VisitorNotice? _notice;
  bool _noticeLoading = true, _reviewed = false, _uncertain = false;
  VisitorDraft? _pending;

  @override
  void initState() {
    super.initState();
    final visitor = widget.visitor;
    final pending = visitor == null
        ? context.read<VisitorProvider>().pendingCreate
        : null;
    _first = TextEditingController(
      text: pending?.draft.firstName ?? visitor?.firstName ?? '',
    );
    _last = TextEditingController(
      text: pending?.draft.lastName ?? visitor?.lastName ?? '',
    );
    _phone = TextEditingController(
      text: pending?.draft.phone ?? visitor?.phone ?? '',
    );
    _purpose = TextEditingController(
      text: pending?.draft.purpose ?? visitor?.purpose ?? '',
    );
    _notes = TextEditingController(
      text: pending?.draft.notes ?? visitor?.notes ?? '',
    );
    _start =
        pending?.draft.start.toLocal() ??
        visitor?.visitStart.toLocal() ??
        DateTime.now();
    _end =
        pending?.draft.end.toLocal() ??
        visitor?.visitEnd.toLocal() ??
        _start.add(const Duration(hours: 1));
    _requestId = pending?.requestId ?? visitorRequestId();
    _pending = pending?.draft;
    _uncertain = pending != null;
    _notice = pending?.notice;
    _reviewed = pending?.noticeReviewed ?? false;
    if (pending != null) _noticeLoading = false;
    _sessionEpoch = context.read<VisitorProvider>().sessionEpoch;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && pending == null) _loadNotice();
    });
  }

  Future<void> _loadNotice() async {
    if (widget.visitor != null) {
      setState(() {
        _notice = const VisitorNotice();
        _noticeLoading = false;
      });
      return;
    }
    final value = await context.read<VisitorProvider>().loadNotice();
    if (!mounted) return;
    setState(() {
      _notice = value;
      _noticeLoading = false;
      _reviewed = false;
    });
  }

  Future<void> _pickDate(bool start) async {
    final current = start ? _start : _end;
    final now = DateTime.now();
    final initial = current.isBefore(now.subtract(const Duration(days: 1)))
        ? now
        : current;
    final day = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: DateTime(
        initial.year > now.year + 2 ? initial.year + 1 : now.year + 2,
      ),
    );
    if (!mounted || day == null) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current),
    );
    if (!mounted || time == null) return;
    setState(() {
      final value = DateTime(
        day.year,
        day.month,
        day.day,
        time.hour,
        time.minute,
      );
      if (start) {
        _start = value;
      } else {
        _end = value;
      }
    });
  }

  Future<void> _save() async {
    final state = context.read<VisitorProvider>();
    final notice = _notice;
    if (state.busy || notice == null) return;
    if (!_uncertain &&
        (_form.currentState?.validate() != true ||
            !_end.isAfter(_start) ||
            !_end.isAfter(DateTime.now()) ||
            _end.difference(_start) > const Duration(days: 31) ||
            (notice.available && !_reviewed))) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).visitorInvalidForm),
        ),
      );
      return;
    }
    final draft =
        _pending ??
        VisitorDraft(
          firstName: _first.text,
          lastName: _last.text,
          phone: _phone.text,
          notes: _notes.text,
          purpose: _purpose.text,
          start: _start,
          end: _end,
        );
    final success = await state.save(
      draft,
      id: widget.visitor?.id,
      requestId: _requestId,
      notice: notice,
      noticeReviewed: _reviewed,
    );
    if (!mounted || state.sessionEpoch != _sessionEpoch) return;
    if (success) {
      final message = AppLocalizations.of(context).visitorSaved;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop();
      messenger.showSnackBar(SnackBar(content: Text(message)));
    } else {
      final error = state.mutationError;
      // A completed business rejection rolled back. Transport/protocol failures
      // may have committed, so preserve the exact intent and request identifier.
      final ambiguous =
          error is NetworkError ||
          error is TimeoutError ||
          error is ServerError ||
          error is ProtocolError ||
          error is UnknownError;
      setState(() {
        _uncertain = ambiguous;
        _pending = ambiguous ? draft : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Consumer<VisitorProvider>(
      builder: (context, state, _) {
        if (state.sessionEpoch != _sessionEpoch) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) Navigator.of(context).pop();
          });
          return const SizedBox.shrink();
        }
        final locked = state.busy || _uncertain;
        return Scaffold(
          appBar: AppBar(
            title: Text(
              widget.visitor == null ? l10n.visitorAddTitle : l10n.visitorEdit,
            ),
          ),
          body: Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(l10n.visitorPreRegistered),
                const SizedBox(height: 16),
                _field(_first, l10n.visitorFirstName, 80, locked),
                _field(_last, l10n.visitorLastName, 80, locked),
                _field(
                  _phone,
                  l10n.visitorPhone,
                  40,
                  locked,
                  keyboard: TextInputType.phone,
                  isRequired: false,
                ),
                _field(
                  _purpose,
                  l10n.visitorFieldPurpose,
                  500,
                  locked,
                  lines: 3,
                ),
                _field(
                  _notes,
                  l10n.visitorNotes,
                  1000,
                  locked,
                  lines: 3,
                  isRequired: false,
                ),
                OutlinedButton(
                  onPressed: locked ? null : () => _pickDate(true),
                  child: Text(
                    '${l10n.visitorStart}: ${visitorDate(context, _start)}',
                  ),
                ),
                OutlinedButton(
                  onPressed: locked ? null : () => _pickDate(false),
                  child: Text(
                    '${l10n.visitorEnd}: ${visitorDate(context, _end)}',
                  ),
                ),
                if (_noticeLoading) const LinearProgressIndicator(),
                if (!_noticeLoading && _notice == null)
                  TextButton(
                    onPressed: _loadNotice,
                    child: Text(l10n.commonRetry),
                  ),
                if (_notice?.available == true) ...[
                  const SizedBox(height: 12),
                  Text(l10n.visitorNotice),
                  SelectableText('${_notice?.url}\n${_notice?.version}'),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _reviewed,
                    title: Text(l10n.visitorNoticeReviewed),
                    controlAffinity: ListTileControlAffinity.leading,
                    onChanged: locked
                        ? null
                        : (value) => setState(() => _reviewed = value ?? false),
                  ),
                ],
                if (_uncertain)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(l10n.visitorOutcomeUnknown),
                  ),
                if (state.mutationError case final error?) ...[
                  Text(
                    localizeAppError(context, error),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                  if (!_uncertain && widget.visitor == null)
                    TextButton(
                      onPressed: _loadNotice,
                      child: Text(l10n.visitorRefresh),
                    ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: state.busy || _notice == null ? null : _save,
                  child: state.busy
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(),
                        )
                      : Text(l10n.visitorSave),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    int limit,
    bool locked, {
    TextInputType? keyboard,
    int lines = 1,
    bool isRequired = true,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: controller,
      enabled: !locked,
      maxLength: limit,
      maxLines: lines,
      keyboardType: keyboard,
      decoration: InputDecoration(
        labelText: label,
        helperText: isRequired
            ? null
            : AppLocalizations.of(context).visitorOptionalHint,
      ),
      validator: (value) =>
          isRequired && (value == null || value.trim().isEmpty)
          ? AppLocalizations.of(context).visitorInvalidForm
          : null,
    ),
  );

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _phone.dispose();
    _purpose.dispose();
    _notes.dispose();
    super.dispose();
  }
}

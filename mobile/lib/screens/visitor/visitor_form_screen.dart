import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../models/visitor.dart';
import '../../providers/visitor_provider.dart';
import '../../widgets/visitor/visitor_labels.dart';

class VisitorFormScreen extends StatefulWidget {
  const VisitorFormScreen({super.key, this.visitor, this.now});
  final Visitor? visitor;
  final DateTime Function()? now;
  @override
  State<VisitorFormScreen> createState() => _VisitorFormScreenState();
}

class _VisitorFormScreenState extends State<VisitorFormScreen>
    with WidgetsBindingObserver {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _first, _last, _phone, _purpose, _notes;
  late DateTime _start, _end;
  late final String _requestId;
  late final int _sessionEpoch;
  VisitorNotice? _notice;
  bool _noticeLoading = true, _reviewed = false, _uncertain = false;
  bool _recoveryPreparing = true;
  VisitorDraft? _pending;
  bool _timesTouched = false;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
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
        _now();
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
      if (mounted) _prepareCreate();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refreshDefaultTimes(_now());
  }

  void _refreshDefaultTimes(DateTime now) {
    if (widget.visitor != null ||
        _pending != null ||
        _uncertain ||
        _timesTouched ||
        !_start.isBefore(now)) {
      return;
    }
    final duration = _end.difference(_start);
    // Round up so the minute displayed in the form is never before now.
    final minute = DateTime(now.year, now.month, now.day, now.hour, now.minute);
    final start = minute.isBefore(now)
        ? minute.add(const Duration(minutes: 1))
        : minute;
    setState(() {
      _start = start;
      _end = start.add(duration);
    });
  }

  Future<void> _prepareCreate() async {
    final state = context.read<VisitorProvider>();
    setState(() => _recoveryPreparing = true);
    final receipt = widget.visitor == null
        ? await state.reconcileCreate()
        : null;
    if (!mounted || state.sessionEpoch != _sessionEpoch) return;
    if (receipt != null) {
      final messenger = ScaffoldMessenger.of(context);
      final message = AppLocalizations.of(context).visitorRecoveryFound;
      Navigator.of(context).pop();
      messenger.showSnackBar(SnackBar(content: Text(message)));
      return;
    }
    setState(() => _recoveryPreparing = false);
    if (_notice == null) await _loadNotice();
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
    final now = _now();
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
      _timesTouched = true;
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
    if (state.busy ||
        _recoveryPreparing ||
        notice == null ||
        (widget.visitor == null &&
            (state.createRecoveryLoading ||
                state.createRecoveryError != null))) {
      return;
    }
    final now = _now();
    _refreshDefaultTimes(now);
    if (!_uncertain &&
        (_form.currentState?.validate() != true ||
            !_end.isAfter(_start) ||
            !_end.isAfter(now) ||
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
        final recovering =
            _recoveryPreparing ||
            (widget.visitor == null && state.createRecoveryLoading);
        final locked = state.busy || _uncertain || recovering;
        return Scaffold(
          appBar: AppBar(
            title: Text(
              widget.visitor == null ? l10n.visitorAddTitle : l10n.visitorEdit,
            ),
          ),
          body: Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                if (widget.visitor == null && recovering) ...[
                  const LinearProgressIndicator(),
                  Text(l10n.visitorRecoveryChecking),
                ],
                if (widget.visitor == null &&
                    state.hasUnresolvedCreate &&
                    !_uncertain)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(l10n.visitorRecoveryUnresolved),
                  ),
                if (state.createRecoveryError case final recoveryError?
                    when widget.visitor == null) ...[
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      state.createRecoveryStorageFailed
                          ? l10n.visitorRecoveryStorageError
                          : localizeAppError(context, recoveryError),
                    ),
                  ),
                  TextButton(
                    onPressed: recovering || state.busy ? null : _prepareCreate,
                    child: Text(l10n.commonRetry),
                  ),
                ],
                if (widget.visitor == null) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Theme.of(
                        context,
                      ).colorScheme.primaryContainer.withValues(alpha: .5),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.info_outline_rounded,
                          size: 20,
                          color: Theme.of(
                            context,
                          ).colorScheme.onPrimaryContainer,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            l10n.visitorActivationHint,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onPrimaryContainer,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                _section(l10n.visitorPeopleSection, [
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final fields = [
                        _field(_first, l10n.visitorFirstName, 80, locked),
                        _field(_last, l10n.visitorLastName, 80, locked),
                      ];
                      if (constraints.maxWidth >= 320 &&
                          MediaQuery.textScalerOf(context).scale(14) < 19) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(child: fields[0]),
                            const SizedBox(width: 12),
                            Expanded(child: fields[1]),
                          ],
                        );
                      }
                      return Column(children: fields);
                    },
                  ),
                  _field(
                    _phone,
                    l10n.visitorPhone,
                    40,
                    locked,
                    keyboard: TextInputType.phone,
                    isRequired: false,
                  ),
                ]),
                const SizedBox(height: 16),
                _section(l10n.visitorVisitSection, [
                  _field(
                    _purpose,
                    l10n.visitorFieldPurpose,
                    500,
                    locked,
                    lines: 2,
                  ),
                  _dateButton(l10n.visitorStart, _start, locked, true),
                  const SizedBox(height: 10),
                  _dateButton(l10n.visitorEnd, _end, locked, false),
                  const SizedBox(height: 16),
                  _field(
                    _notes,
                    l10n.visitorNotes,
                    1000,
                    locked,
                    lines: 2,
                    isRequired: false,
                  ),
                ]),
                const SizedBox(height: 16),
                if (_noticeLoading) const LinearProgressIndicator(),
                if (!_noticeLoading && _notice == null) ...[
                  Semantics(
                    liveRegion: true,
                    child: Text(l10n.visitorNoticeUnavailable),
                  ),
                  TextButton(
                    onPressed: _loadNotice,
                    child: Text(l10n.commonRetry),
                  ),
                ],
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
                  onPressed:
                      state.busy ||
                          recovering ||
                          _notice == null ||
                          (widget.visitor == null &&
                              state.createRecoveryError != null)
                      ? null
                      : _save,
                  child: state.busy
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(),
                        )
                      : Text(
                          widget.visitor == null && state.hasUnresolvedCreate
                              ? l10n.visitorRecoveryRetry
                              : l10n.visitorSave,
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _section(String title, List<Widget> children) => Card(
    elevation: 0,
    margin: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(
        color: Theme.of(
          context,
        ).colorScheme.outlineVariant.withValues(alpha: .5),
      ),
    ),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    ),
  );

  Widget _dateButton(String label, DateTime value, bool locked, bool start) =>
      OutlinedButton(
        onPressed: locked ? null : () => _pickDate(start),
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.all(12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_rounded, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 3),
                  Text(
                    visitorDate(context, value),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right_rounded, size: 18),
          ],
        ),
      );

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
        labelText: isRequired ? '$label *' : label,
        counterText: '',
        filled: true,
        fillColor: Theme.of(context).colorScheme.surfaceContainerLow,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: Theme.of(
              context,
            ).colorScheme.outlineVariant.withValues(alpha: .6),
          ),
        ),
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
    WidgetsBinding.instance.removeObserver(this);
    _first.dispose();
    _last.dispose();
    _phone.dispose();
    _purpose.dispose();
    _notes.dispose();
    super.dispose();
  }
}

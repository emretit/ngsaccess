import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../core/errors.dart';
import '../../l10n/app_localizations.dart';
import '../../models/visitor.dart';
import '../../providers/visitor_provider.dart';
import '../../widgets/visitor/visitor_labels.dart';
import '../../widgets/ui/ui.dart';

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
  final _scroll = ScrollController();
  final _firstFocus = FocusNode(),
      _lastFocus = FocusNode(),
      _purposeFocus = FocusNode();
  final _endDateFocus = FocusNode(),
      _endTimeFocus = FocusNode(),
      _noticeFocus = FocusNode();
  final _noticeAnchor = GlobalKey();
  bool _showErrors = false;
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
        pending?.draft.start.toUtc() ??
        visitor?.visitStart.toUtc() ??
        _now().toUtc();
    _end =
        pending?.draft.end.toUtc() ??
        visitor?.visitEnd.toUtc() ??
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
    final utc = now.toUtc();
    final minute = DateTime.utc(
      utc.year,
      utc.month,
      utc.day,
      utc.hour,
      utc.minute,
    );
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

  void _changeTime(bool start, {DateTime? day, TimeOfDay? time}) {
    final current = start ? _start : _end;
    final value = VisitorTime.instant(
      day ?? VisitorTime.day(current),
      time ?? VisitorTime.time(current),
    );
    setState(() {
      _timesTouched = true;
      if (start) {
        _start = value;
      } else {
        _end = value;
      }
    });
  }

  String? _rangeError(DateTime now) {
    final l10n = AppLocalizations.of(context);
    if (!_end.isAfter(_start)) return l10n.visitorErrorEndBeforeStart;
    if (!_end.isAfter(now)) return l10n.visitorErrorEndInPast;
    if (_end.difference(_start) > const Duration(days: 31)) {
      return l10n.visitorErrorMaxDuration;
    }
    return null;
  }

  bool _rangeErrorOnTime(DateTime now) {
    if (!_end.isAfter(_start)) {
      return VisitorTime.day(_end) == VisitorTime.day(_start);
    }
    return !_end.isAfter(now) && VisitorTime.day(_end) == VisitorTime.day(now);
  }

  Future<void> _revealInvalid(FocusNode node) async {
    node.requestFocus();
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return;
    final target = identical(node, _noticeFocus)
        ? _noticeAnchor.currentContext
        : node.context;
    if (target != null && target.mounted) {
      await Scrollable.ensureVisible(target, alignment: .15);
    }
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
    if (!_uncertain) {
      setState(() => _showErrors = true);
      final fieldsValid = _form.currentState?.validate() == true;
      FocusNode? invalid;
      for (final (controller, focus) in [
        (_first, _firstFocus),
        (_last, _lastFocus),
        (_purpose, _purposeFocus),
      ]) {
        if (controller.text.trim().isEmpty) {
          invalid = focus;
          break;
        }
      }
      final rangeError = _rangeError(now);
      if (rangeError != null) {
        invalid ??= _rangeErrorOnTime(now) ? _endTimeFocus : _endDateFocus;
      }
      final noticeInvalid = notice.available && !_reviewed;
      if (noticeInvalid) invalid ??= _noticeFocus;
      if (!fieldsValid || rangeError != null || noticeInvalid) {
        // Errors are shown inline; focus the first one instead of a snackbar
        // that would cover the save bar.
        if (invalid != null) await _revealInvalid(invalid);
        return;
      }
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
      if (_scroll.hasClients) _scroll.jumpTo(0);
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
        return AppScaffold(
          consumeBottomInset: false,
          header: AppPageHeader(
            title: widget.visitor == null
                ? l10n.visitorAddTitle
                : l10n.visitorEditTitle,
            showBack: true,
          ),
          body: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Form(
                key: _form,
                child: Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (widget.visitor == null && recovering)
                              AppDataNotice(
                                message: l10n.visitorRecoveryChecking,
                                busy: true,
                              ),
                            if (widget.visitor == null &&
                                state.hasUnresolvedCreate &&
                                !_uncertain)
                              AppDataNotice(
                                message: l10n.visitorRecoveryUnresolved,
                                tone: AppStatusTone.warning,
                              ),
                            if (state.createRecoveryError
                                case final recoveryError?
                                when widget.visitor == null)
                              AppDataNotice(
                                message: state.createRecoveryStorageFailed
                                    ? l10n.visitorRecoveryStorageError
                                    : localizeAppError(context, recoveryError),
                                tone: AppStatusTone.warning,
                                actionLabel: l10n.commonRetry,
                                onAction: recovering || state.busy
                                    ? null
                                    : _prepareCreate,
                              ),
                            if (_uncertain)
                              AppDataNotice(
                                message: l10n.visitorOutcomeUnknown,
                                tone: AppStatusTone.warning,
                              ),
                            if (state.mutationError case final error?) ...[
                              AppDataNotice(
                                message: localizeAppError(context, error),
                                tone: AppStatusTone.danger,
                                actionLabel:
                                    !_uncertain && widget.visitor == null
                                    ? l10n.visitorRefresh
                                    : null,
                                onAction: !locked ? _loadNotice : null,
                              ),
                              const SizedBox(height: 16),
                            ],
                            _section(l10n.visitorPeopleSection, [
                              _field(
                                _first,
                                l10n.visitorFirstName,
                                80,
                                locked,
                                focusNode: _firstFocus,
                              ),
                              _field(
                                _last,
                                l10n.visitorLastName,
                                80,
                                locked,
                                focusNode: _lastFocus,
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
                            const SizedBox(height: 24),
                            _section(l10n.visitorVisitSection, [
                              _field(
                                _purpose,
                                l10n.visitorFieldPurpose,
                                500,
                                locked,
                                focusNode: _purposeFocus,
                              ),
                              _field(
                                _notes,
                                l10n.visitorNotes,
                                1000,
                                locked,
                                lines: 2,
                                isRequired: false,
                              ),
                              _dateFields(
                                l10n.visitorStartDate,
                                _start,
                                locked,
                                true,
                              ),
                              const SizedBox(height: 16),
                              _dateFields(
                                l10n.visitorEndDate,
                                _end,
                                locked,
                                false,
                              ),
                            ]),
                            const SizedBox(height: 24),
                            if (_noticeLoading)
                              AppSkeleton(
                                semanticLabel: l10n.homeDataLoading,
                                kind: AppSkeletonKind.form,
                                itemCount: 1,
                              ),
                            if (!_noticeLoading && _notice == null)
                              AppDataNotice(
                                message: l10n.visitorNoticeUnavailable,
                                tone: AppStatusTone.warning,
                                actionLabel: l10n.commonRetry,
                                onAction: locked ? null : _loadNotice,
                              ),
                            if (_notice?.available == true) ...[
                              Text(
                                l10n.visitorNotice,
                                style: Theme.of(context).textTheme.titleSmall,
                              ),
                              SelectableText(
                                '${_notice?.url}\n${_notice?.version}',
                              ),
                              AppCheckboxRow(
                                key: _noticeAnchor,
                                focusNode: _noticeFocus,
                                label: l10n.visitorNoticeReviewed,
                                value: _reviewed,
                                errorText: _showErrors && !_reviewed
                                    ? l10n.visitorErrorNoticeRequired
                                    : null,
                                onChanged: locked
                                    ? null
                                    : (value) => setState(
                                        () => _reviewed = value ?? false,
                                      ),
                              ),
                            ],
                            if (widget.visitor == null)
                              Text(
                                l10n.visitorActivationHint,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                          ],
                        ),
                      ),
                    ),
                    AppFormActionBar(
                      primaryAction: AppPrimaryButton(
                        label:
                            widget.visitor == null && state.hasUnresolvedCreate
                            ? l10n.visitorRecoveryRetry
                            : l10n.visitorSave,
                        busy: state.busy,
                        busyLabel: l10n.visitorSaving,
                        onPressed:
                            recovering ||
                                _notice == null ||
                                (widget.visitor == null &&
                                    state.createRecoveryError != null)
                            ? null
                            : _save,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _section(String title, List<Widget> children) => AppListGroup(
    title: title,
    showDividers: false,
    children: [
      Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      ),
    ],
  );

  Widget _dateFields(String label, DateTime value, bool locked, bool start) {
    final now = VisitorTime.day(_now());
    final currentDay = VisitorTime.day(value);
    final minimum = now.subtract(const Duration(days: 1));
    final fields = [
      AppDateField(
        now: _now,
        key: Key(start ? 'visitor-start-date' : 'visitor-end-date'),
        label: label,
        value: currentDay,
        focusNode: start ? null : _endDateFocus,
        errorText: !start && _showErrors && !_rangeErrorOnTime(_now())
            ? _rangeError(_now())
            : null,
        firstDate: currentDay.isBefore(minimum) ? currentDay : minimum,
        lastDate: DateTime.utc(
          currentDay.year > now.year + 2 ? currentDay.year + 1 : now.year + 2,
        ),
        enabled: !locked,
        onChanged: (day) {
          if (day != null) _changeTime(start, day: day);
        },
      ),
      AppTimeField(
        now: _now,
        key: Key(start ? 'visitor-start-time' : 'visitor-end-time'),
        label: start
            ? AppLocalizations.of(context).visitorStartTime
            : AppLocalizations.of(context).visitorEndTime,
        focusNode: start ? null : _endTimeFocus,
        errorText: !start && _showErrors && _rangeErrorOnTime(_now())
            ? _rangeError(_now())
            : null,
        value: VisitorTime.time(value),
        enabled: !locked,
        onChanged: (time) {
          if (time != null) _changeTime(start, time: time);
        },
      ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        if (isLargeText(context) || constraints.maxWidth < 300) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [fields[0], const SizedBox(height: 16), fields[1]],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(flex: 3, child: fields[0]),
            const SizedBox(width: 12),
            Expanded(flex: 2, child: fields[1]),
          ],
        );
      },
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    int limit,
    bool locked, {
    FocusNode? focusNode,
    TextInputType? keyboard,
    int lines = 1,
    bool isRequired = true,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: AppTextField(
      controller: controller,
      focusNode: focusNode,
      label: isRequired ? '$label *' : label,
      enabled: !locked,
      maxLength: limit,
      showCounter: false,
      minLines: lines,
      maxLines: lines,
      keyboardType: keyboard ?? TextInputType.text,
      helperText: isRequired
          ? null
          : AppLocalizations.of(context).visitorOptionalHint,
      validator: (value) =>
          isRequired && (value == null || value.trim().isEmpty)
          ? AppLocalizations.of(context).fieldRequired
          : null,
    ),
  );

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _scroll.dispose();
    for (final node in [
      _firstFocus,
      _lastFocus,
      _purposeFocus,
      _endDateFocus,
      _endTimeFocus,
      _noticeFocus,
    ]) {
      node.dispose();
    }
    _first.dispose();
    _last.dispose();
    _phone.dispose();
    _purpose.dispose();
    _notes.dispose();
    super.dispose();
  }
}

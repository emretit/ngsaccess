import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/error_localizer.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/visitor_provider.dart';
import '../../models/visitor.dart';
import '../../widgets/ui/ui.dart';
import '../../widgets/visitor/visitor_cards.dart';
import '../../widgets/visitor/visitor_detail.dart';
import '../../widgets/visitor/visitor_labels.dart';
import 'visitor_form_screen.dart';

class VisitorScreen extends StatefulWidget {
  const VisitorScreen({super.key});
  @override
  State<VisitorScreen> createState() => _VisitorScreenState();
}

// A non-null value represents the unfiltered selection in AppSelectField.
typedef _StatusFilter = ({VisitorAccessStatus? status});

class _VisitorScreenState extends State<VisitorScreen> {
  Timer? _searchDebounce;
  final _search = TextEditingController();
  int? _searchEpoch;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _addVisitor() {
    final state = context.read<VisitorProvider>();
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChangeNotifierProvider<VisitorProvider>.value(
          value: state,
          child: const VisitorFormScreen(),
        ),
      ),
    );
  }

  void _clearFilters(VisitorProvider state) {
    _searchDebounce?.cancel();
    _search.clear();
    state.setFilters(search: '', resetStatus: true);
  }

  Future<void> _openDetail(VisitorProvider state, Visitor visitor) async {
    unawaited(state.openDetail(visitor.id));
    await showAppSheet<void>(
      context: context,
      builder: (_) => ChangeNotifierProvider<VisitorProvider>.value(
        value: state,
        child: VisitorDetail(visitorId: visitor.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AppScaffold(
      consumeBottomInset: false,
      header: AppPageHeader(title: l10n.visitorTitle),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Tooltip(
                  message: l10n.visitorAddButton,
                  child: AppPrimaryButton(
                    key: const Key('visitor-add'),
                    label: l10n.visitorAddButton,
                    icon: Icons.add,
                    onPressed: _addVisitor,
                  ),
                ),
              ),
              Expanded(
                child: Consumer<VisitorProvider>(
                  builder: (context, state, _) {
                    if (_searchEpoch != state.sessionEpoch) {
                      _searchDebounce?.cancel();
                      _searchEpoch = state.sessionEpoch;
                      final epoch = state.sessionEpoch;
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted &&
                            state.sessionEpoch == epoch &&
                            _searchEpoch == epoch) {
                          _search.text = state.search;
                        }
                      });
                    }
                    final filterEpoch = state.sessionEpoch;
                    final filtered =
                        state.search.trim().isNotEmpty || state.status != null;
                    final summary = state.summary;
                    final header = Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (summary != null &&
                            (summary.total > 0 || summary.overflow)) ...[
                          VisitorSummaryCard(summary: summary),
                          const SizedBox(height: 24),
                        ] else if (state.summaryLoading) ...[
                          AppSkeleton(
                            semanticLabel: l10n.homeDataLoading,
                            kind: AppSkeletonKind.metrics,
                            itemCount: 1,
                          ),
                          const SizedBox(height: 24),
                        ],
                        if (state.summaryError != null) ...[
                          AppDataNotice(
                            message: l10n.visitorSummaryError,
                            tone: AppStatusTone.warning,
                          ),
                          const SizedBox(height: 16),
                        ],
                        AppTextField(
                          key: ValueKey(('visitor-search', state.sessionEpoch)),
                          label: l10n.visitorSearch,
                          controller: _search,
                          maxLength: 80,
                          showCounter: false,
                          textInputAction: TextInputAction.search,
                          suffix: const Icon(Icons.search),
                          onChanged: (value) {
                            _searchDebounce?.cancel();
                            final epoch = state.sessionEpoch;
                            _searchDebounce = Timer(
                              const Duration(milliseconds: 300),
                              () {
                                if (mounted && state.sessionEpoch == epoch) {
                                  state.setFilters(search: value);
                                }
                              },
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                        AppSelectField<_StatusFilter>(
                          label: l10n.visitorFilterTitle,
                          value: (status: state.status),
                          options: [
                            AppSelectOption(
                              value: (status: null),
                              label: l10n.visitorAllStatuses,
                            ),
                            for (final status in VisitorAccessStatus.values)
                              AppSelectOption(
                                value: (status: status),
                                label: visitorStatusLabel(l10n, status),
                              ),
                          ],
                          onChanged: (value) {
                            if (value == null ||
                                state.sessionEpoch != filterEpoch) {
                              return;
                            }
                            state.setFilters(
                              status: value.status,
                              resetStatus: value.status == null,
                            );
                          },
                        ),
                        if (filtered)
                          Align(
                            alignment: AlignmentDirectional.centerStart,
                            child: TextButton(
                              onPressed: () => _clearFilters(state),
                              child: Text(l10n.visitorClearFilters),
                            ),
                          ),
                        const SizedBox(height: 24),
                        if (state.error case final error?) ...[
                          AppDataNotice(
                            title: state.loaded
                                ? l10n.visitorStale
                                : l10n.visitorLoadFailed,
                            message: localizeAppError(context, error),
                            tone: state.loaded
                                ? AppStatusTone.warning
                                : AppStatusTone.danger,
                            actionLabel: l10n.commonRetry,
                            onAction: state.loading ? null : state.refresh,
                            busy: state.loading,
                          ),
                          const SizedBox(height: 16),
                        ],
                        if (state.loading && state.visitors.isEmpty)
                          AppSkeleton(
                            semanticLabel: l10n.homeDataLoading,
                            itemCount: 3,
                          ),
                        if (state.loaded &&
                            !state.loading &&
                            state.visitors.isEmpty &&
                            !state.hasMore &&
                            state.error == null)
                          AppEmptyState(
                            title: filtered
                                ? l10n.visitorNoMatchTitle
                                : l10n.visitorEmpty,
                            message: filtered
                                ? l10n.visitorFilteredEmptyHint
                                : l10n.visitorEmptyHint,
                            icon: Icons.people_outline,
                            actionLabel: filtered
                                ? l10n.visitorClearFilters
                                : null,
                            onAction: filtered
                                ? () => _clearFilters(state)
                                : null,
                          ),
                        if (state.visitors.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Semantics(
                              header: true,
                              child: Text(
                                l10n.visitorInvitationsTitle,
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                            ),
                          ),
                      ],
                    );
                    return RefreshIndicator(
                      onRefresh: state.refresh,
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: state.visitors.length + 2,
                        itemBuilder: (context, index) {
                          if (index == 0) return header;
                          if (index > state.visitors.length) {
                            if (state.loading && state.visitors.isNotEmpty) {
                              return Padding(
                                padding: const EdgeInsets.only(top: 16),
                                child: LinearProgressIndicator(
                                  semanticsLabel: l10n.homeDataLoading,
                                ),
                              );
                            }
                            return state.hasMore
                                ? Padding(
                                    padding: const EdgeInsets.only(top: 16),
                                    child: AppSecondaryButton(
                                      label: l10n.visitorLoadMore,
                                      busy: state.loading,
                                      onPressed: () =>
                                          state.refresh(more: true),
                                    ),
                                  )
                                : const SizedBox.shrink();
                          }
                          final first = index == 1;
                          final last = index == state.visitors.length;
                          final visitor = state.visitors[index - 1];
                          // Individual lazy rows share one continuous neutral group.
                          final side = BorderSide(
                            color: Theme.of(context).colorScheme.outlineVariant,
                          );
                          return Container(
                            clipBehavior: Clip.antiAlias,
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.vertical(
                                top: first
                                    ? const Radius.circular(16)
                                    : Radius.zero,
                                bottom: last
                                    ? const Radius.circular(16)
                                    : Radius.zero,
                              ),
                              border: Border(
                                left: side,
                                right: side,
                                bottom: side,
                                top: first
                                    ? side
                                    : BorderSide(
                                        color: side.color,
                                        style: BorderStyle.none,
                                      ),
                              ),
                            ),
                            child: VisitorRecordCard(
                              visitor: visitor,
                              onTap: () => _openDetail(state, visitor),
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

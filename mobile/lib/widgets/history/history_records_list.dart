import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../ui/ui.dart';

/// Keeps retry, refresh and pagination reachable even for an empty server page.
class HistoryRecordsList extends StatelessWidget {
  const HistoryRecordsList({
    super.key,
    required this.controller,
    required this.recordCount,
    required this.itemBuilder,
    required this.hasMore,
    required this.isLoading,
    required this.isLoadingMore,
    required this.onRefresh,
    required this.onLoadMore,
    this.errorMessage,
    this.loadMoreErrorMessage,
    this.hasPreviousData = false,
    this.header,
    this.emptyHint,
    this.onClearFilters,
  });

  final ScrollController controller;
  final int recordCount;
  final IndexedWidgetBuilder itemBuilder;
  final bool hasMore;
  final bool isLoading;
  final bool isLoadingMore;
  final Future<void> Function() onRefresh;
  final VoidCallback onLoadMore;
  final String? errorMessage;
  final String? loadMoreErrorMessage;
  final bool hasPreviousData;
  final Widget? header;
  final String? emptyHint;
  final VoidCallback? onClearFilters;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final error = errorMessage;
    final pageError = loadMoreErrorMessage;
    final headerWidget = header;
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: CustomScrollView(
        key: const PageStorageKey('history-records-scroll'),
        controller: controller,
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          if (headerWidget != null) SliverToBoxAdapter(child: headerWidget),
          if (error != null)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: AppDataNotice(
                  title: hasPreviousData
                      ? l10n.historyStaleData
                      : l10n.historyErrorTitle,
                  message: error,
                  tone: AppStatusTone.danger,
                  actionLabel: l10n.commonRetry,
                  onAction: isLoading ? null : onRefresh,
                ),
              ),
            ),
          if (isLoading)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: recordCount == 0
                    ? AppSkeleton(semanticLabel: l10n.historyLoading)
                    : LinearProgressIndicator(
                        semanticsLabel: l10n.historyLoading,
                      ),
              ),
            ),
          if (!isLoading && error == null && recordCount == 0 && !hasMore)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: AppEmptyState(
                  title: l10n.historyEmpty,
                  message: emptyHint ?? l10n.historyEmptyHint,
                  icon: Icons.event_note_rounded,
                  actionLabel: onClearFilters == null
                      ? null
                      : l10n.historyShowAllRecords,
                  onAction: onClearFilters,
                ),
              ),
            ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                itemBuilder,
                childCount: recordCount,
              ),
            ),
          ),
          if (hasMore)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    if (pageError != null)
                      Semantics(liveRegion: true, child: Text(pageError)),
                    if (isLoadingMore)
                      Center(
                        child: CircularProgressIndicator(
                          semanticsLabel: l10n.historyLoading,
                        ),
                      )
                    else
                      AppSecondaryButton(
                        key: const ValueKey('history-load-more'),
                        onPressed: isLoading ? null : onLoadMore,
                        icon: Icons.expand_more,
                        label: l10n.historyLoadMore,
                      ),
                  ],
                ),
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

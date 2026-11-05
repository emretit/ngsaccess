import 'package:ngsplusapp/config/convex_config.dart';
import 'package:ngsplusapp/models/visitor.dart';
import 'package:ngsplusapp/repositories/visitor_repository.dart';

Visitor visitorFixture(String id, {bool active = false, String? notes}) =>
    Visitor(
      id: id,
      firstName: 'Synthetic',
      lastName: id,
      visitStart: DateTime.utc(2030, 1, 1, 10),
      visitEnd: DateTime.utc(2030, 1, 1, 11),
      status: active
          ? VisitorAccessStatus.active
          : VisitorAccessStatus.preRegistered,
      canEdit: !active,
      phone: '+900000000000',
      purpose: 'Synthetic visit',
      notes: notes,
    );

VisitorPage visitorPage(List<Visitor> rows) =>
    VisitorPage(visitors: rows, cursor: 'done', isDone: true);

class FakeVisitorRepository extends VisitorRepository {
  FakeVisitorRepository()
    : super(HttpConvexClient(deploymentUrl: 'https://synthetic.convex.cloud'));
  String? session = 'A';
  int listCalls = 0, cancelCalls = 0, createCalls = 0, summaryCalls = 0;
  final requests = <String>[];
  VisitorDraft? updatedDraft;
  Future<VisitorPage> Function()? listResult;
  Future<Visitor> Function(String)? detailResult;
  Future<VisitorSummary> Function()? summaryResult;
  final filters =
      <({String? cursor, String search, VisitorAccessStatus? status})>[];
  Future<bool> Function(String)? cancelResult;
  Future<String> Function()? createResult;
  @override
  String? get sessionKey => session;
  @override
  Future<VisitorPage> list({
    String? cursor,
    String search = '',
    VisitorAccessStatus? status,
  }) {
    listCalls++;
    filters.add((cursor: cursor, search: search, status: status));
    return listResult?.call() ?? Future.value(visitorPage([]));
  }

  @override
  Future<VisitorSummary> summary() {
    summaryCalls++;
    return summaryResult?.call() ??
        Future.value(
          const VisitorSummary(total: 0, counts: {}, overflow: false),
        );
  }

  @override
  Future<Visitor> detail(String id) =>
      detailResult?.call(id) ?? Future.value(visitorFixture(id));
  @override
  Future<VisitorNotice> notice() async => const VisitorNotice();
  @override
  Future<bool> cancel(String id) {
    cancelCalls++;
    return cancelResult?.call(id) ?? Future.value(true);
  }

  @override
  Future<String> create(
    VisitorDraft draft, {
    required String requestId,
    required VisitorNotice notice,
    required bool noticeReviewed,
  }) {
    createCalls++;
    requests.add(requestId);
    return createResult?.call() ?? Future.value('created');
  }

  @override
  Future<void> update(String id, VisitorDraft draft) async {
    updatedDraft = draft;
  }
}

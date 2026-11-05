import 'package:ngsplusapp/models/visitor.dart';
import 'visitor_fakes.dart';

class RecordingVisitors extends FakeVisitorRepository {
  final drafts = <VisitorDraft>[];

  @override
  Future<String> create(
    VisitorDraft draft, {
    required String requestId,
    required VisitorNotice notice,
    required bool noticeReviewed,
  }) {
    drafts.add(draft);
    return super.create(
      draft,
      requestId: requestId,
      notice: notice,
      noticeReviewed: noticeReviewed,
    );
  }
}

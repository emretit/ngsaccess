import 'dart:async';
import 'package:ngsplusapp/models/employee_request.dart';
import 'package:ngsplusapp/models/request_attachment.dart';
import 'package:ngsplusapp/repositories/request_repository.dart';
import 'mocks.dart';

class RequestFakeRepository extends RequestRepository {
  RequestFakeRepository() : super(MockHttpConvexClient());
  int reads = 0, submits = 0, withdrawals = 0;
  Object? failure, readFailure, withdrawFailure;
  Completer<void>? withdrawGate;
  Completer<String>? gate;
  Completer<List<LeaveRequest>>? listGate;
  Object? uploadFailure;
  Completer<String>? uploadGate;
  final uploaded = <String>[], discarded = <String>[];
  List<String> submittedAttachments = [];
  @override
  Future<String> uploadAttachment(RequestAttachmentFile file) async {
    uploaded.add(file.name);
    if (uploadFailure case final e?) throw e;
    return uploadGate?.future ?? 'attachment-${uploaded.length}';
  }

  @override
  Future<void> discardAttachment(String id) async {
    discarded.add(id);
  }

  List<LeaveRequest> leaves = [];
  List<AttendanceCorrectionRequest> corrections = [];
  @override
  Future<List<LeaveRequest>> listLeaves() async {
    reads++;
    if (readFailure case final e?) throw e;
    return listGate == null ? leaves : listGate?.future ?? leaves;
  }

  @override
  Future<List<AttendanceCorrectionRequest>> listCorrections() async =>
      corrections;
  @override
  Future<String> submitLeave({
    required String leaveType,
    required String startDate,
    required String endDate,
    String? notes,
    List<String> attachmentIds = const [],
  }) async {
    submits++;
    submittedAttachments = attachmentIds;
    if (failure case final e?) throw e;
    return gate == null ? 'id' : gate?.future ?? 'id';
  }

  @override
  Future<String> submitCorrection({
    required String date,
    required String correctionType,
    required String reason,
    String? requestedCheckIn,
    String? requestedCheckOut,
    List<String> attachmentIds = const [],
  }) async {
    submits++;
    submittedAttachments = attachmentIds;
    if (failure case final e?) throw e;
    return gate == null ? 'id' : gate?.future ?? 'id';
  }

  @override
  Future<void> withdrawLeave(String id) async {
    withdrawals++;
    if (withdrawFailure case final e?) throw e;
    await withdrawGate?.future;
    leaves = [];
  }

  @override
  Future<void> withdrawCorrection(String id) async {
    withdrawals++;
    if (withdrawFailure case final e?) throw e;
    await withdrawGate?.future;
    corrections = [];
  }
}

LeaveRequest testLeave({
  String id = 'id',
  String status = 'pending',
  String? source = 'employee',
  String type = 'annual',
  String? decision,
}) => LeaveRequest(
  id: id,
  leaveType: type,
  startDate: '2026-10-19',
  endDate: '2026-10-20',
  status: status,
  source: source,
  createdAt: DateTime.utc(2026, 10, 19),
  decisionNote: decision,
);
AttendanceCorrectionRequest testCorrection({String status = 'pending'}) =>
    AttendanceCorrectionRequest(
      id: 'c1',
      date: '2026-10-19',
      correctionType: 'checkIn',
      reason: 'Gerekçe',
      status: status,
      createdAt: DateTime.utc(2026, 10, 19),
    );

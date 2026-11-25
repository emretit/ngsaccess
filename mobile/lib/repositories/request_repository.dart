import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/convex_config.dart';
import '../core/errors.dart';
import '../models/employee_request.dart';
import '../models/request_attachment.dart';

class RequestRepository {
  RequestRepository(this._client, {http.Client? uploadClient})
    : _uploadClient = uploadClient;
  final HttpConvexClient _client;
  final http.Client? _uploadClient;
  String? get sessionKey => _client.sessionToken;

  Future<String> uploadAttachment(RequestAttachmentFile file) async {
    if (file.bytes.isEmpty ||
        file.bytes.length > RequestAttachmentFile.maxBytes ||
        RequestAttachmentFile.contentTypeFor(file.name) != file.contentType) {
      throw const ProtocolError();
    }
    final token = sessionKey;
    if (token == null) throw const AuthExpiredError();
    final slot = _decode(
      await _client.employeeMutation(
        name: 'requestAttachments:beginUpload',
        args: {
          'name': file.name,
          'contentType': file.contentType,
          'size': file.bytes.length,
        },
        retry: false,
      ),
      (value) {
        if (value is! Map<String, dynamic> ||
            value['attachmentId'] is! String ||
            value['uploadUrl'] is! String) {
          throw const ProtocolError();
        }
        return (
          id: value['attachmentId'] as String,
          url: value['uploadUrl'] as String,
        );
      },
    );
    if (sessionKey != token) throw const AuthExpiredError();
    final uri = Uri.tryParse(slot.url);
    final deployment = Uri.parse(_client.deploymentUrl);
    final expectedHost = deployment.host.endsWith('.convex.cloud')
        ? deployment.host.replaceFirst(
            RegExp(r'\.convex\.cloud$'),
            '.convex.site',
          )
        : deployment.host;
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host != expectedHost ||
        uri.userInfo.isNotEmpty ||
        uri.path != '/request-attachments' ||
        !uri.queryParameters.containsKey('ticket')) {
      throw const ProtocolError();
    }
    final client = _uploadClient ?? http.Client();
    try {
      final request = http.Request('POST', uri)
        ..followRedirects = false
        ..headers['Content-Type'] = file.contentType
        ..bodyBytes = file.bytes;
      final response = await client
          .send(request)
          .timeout(const Duration(seconds: 60));
      final body = await response.stream.bytesToString().timeout(
        const Duration(seconds: 15),
      );
      if (sessionKey != token) throw const AuthExpiredError();
      if (response.statusCode != 200) throw const ProtocolError();
      final id = _decode(body, (value) {
        if (value is! Map<String, dynamic> ||
            value['attachmentId'] != slot.id) {
          throw const ProtocolError();
        }
        return slot.id;
      });
      return id;
    } catch (_) {
      if (sessionKey == token) {
        try {
          await discardAttachment(slot.id);
        } catch (_) {
          // A daily server job removes slots left by failed or interrupted uploads.
        }
      }
      rethrow;
    } finally {
      if (_uploadClient == null) client.close();
    }
  }

  Future<void> discardAttachment(String id) =>
      _withdraw('requestAttachments:discard', {'attachmentId': id});
  T _decode<T>(String raw, T Function(Object?) parse) {
    try {
      return parse(jsonDecode(raw));
    } on FormatException {
      throw const ProtocolError();
    }
  }

  List<T> _list<T>(String raw, T Function(Object?) parse) =>
      _decode(raw, (value) {
        if (value is! List || value.length > 100) throw const ProtocolError();
        return value.map(parse).toList();
      });
  Future<List<LeaveRequest>> listLeaves() async {
    final rows = _list(
      await _client.employeeQuery('leaveRequests:listMine', {}),
      LeaveRequest.fromJson,
    );
    rows.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return rows;
  }

  Future<List<AttendanceCorrectionRequest>> listCorrections() async {
    final rows = _list(
      await _client.employeeQuery('attendanceCorrections:listMine', {}),
      AttendanceCorrectionRequest.fromJson,
    );
    rows.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return rows;
  }

  Future<String> _submit(String name, Map<String, dynamic> args) async =>
      _decode(
        await _client.employeeMutation(name: name, args: args, retry: false),
        (value) {
          if (value is! String || value.isEmpty) throw const ProtocolError();
          return value;
        },
      );
  Future<String> submitLeave({
    required String leaveType,
    required String startDate,
    required String endDate,
    String? notes,
    List<String> attachmentIds = const [],
  }) => _submit('leaveRequests:submit', {
    'leaveType': leaveType,
    'startDate': startDate,
    'endDate': endDate,
    if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    if (attachmentIds.isNotEmpty) 'attachmentIds': attachmentIds,
  });
  Future<String> submitCorrection({
    required String date,
    required String correctionType,
    required String reason,
    String? requestedCheckIn,
    String? requestedCheckOut,
    List<String> attachmentIds = const [],
  }) => _submit('attendanceCorrections:submit', {
    'date': date,
    'correctionType': correctionType,
    'reason': reason.trim(),
    'requestedCheckIn': ?requestedCheckIn,
    'requestedCheckOut': ?requestedCheckOut,
    if (attachmentIds.isNotEmpty) 'attachmentIds': attachmentIds,
  });
  Future<void> _withdraw(String name, Map<String, dynamic> args) async {
    _decode(
      await _client.employeeMutation(name: name, args: args, retry: false),
      (value) {
        if (value != null) throw const ProtocolError();
        return null;
      },
    );
  }

  Future<void> withdrawLeave(String id) =>
      _withdraw('leaveRequests:withdraw', {'leaveId': id});
  Future<void> withdrawCorrection(String id) =>
      _withdraw('attendanceCorrections:withdraw', {'id': id});
}

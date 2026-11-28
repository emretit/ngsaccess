import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mocktail/mocktail.dart';
import 'package:ngsplusapp/core/errors.dart';
import 'package:ngsplusapp/models/employee_request.dart';
import 'package:ngsplusapp/models/request_attachment.dart';
import 'package:ngsplusapp/repositories/request_repository.dart';
import '../helpers/mocks.dart';

void main() {
  setUpAll(registerCommonFallbacks);
  late MockHttpConvexClient client;
  String? token;
  final file = RequestAttachmentFile(
    name: 'rapor.pdf',
    contentType: 'application/pdf',
    bytes: Uint8List.fromList(utf8.encode('%PDF-test')),
  );
  void slot({
    String url = 'https://test.convex.site/request-attachments?ticket=secret',
  }) {
    when(
      () => client.employeeMutation(
        name: 'requestAttachments:beginUpload',
        args: any(named: 'args'),
        retry: false,
      ),
    ).thenAnswer(
      (_) async =>
          jsonEncode({'attachmentId': 'attachment-1', 'uploadUrl': url}),
    );
  }

  setUp(() {
    client = MockHttpConvexClient();
    token = 'session-1';
    when(() => client.sessionToken).thenAnswer((_) => token);
    when(() => client.deploymentUrl).thenReturn('https://test.convex.cloud');
    slot();
  });
  test('self-host accepts only configured upload hosts', () async {
    dotenv.loadFromString(envString: 'CONVEX_UPLOAD_ALLOWED_HOSTS=site.example.com');
    addTearDown(() => dotenv.clean());
    when(() => client.deploymentUrl).thenReturn('https://api.example.com');
    slot(url: 'https://site.example.com/request-attachments?ticket=secret');
    final repo = RequestRepository(
      client,
      uploadClient: MockClient((request) async {
        expect(request.url.host, 'site.example.com');
        return http.Response(jsonEncode({'attachmentId': 'attachment-1'}), 200);
      }),
    );
    expect(await repo.uploadAttachment(file), 'attachment-1');
    slot(url: 'https://evil.example.com/request-attachments?ticket=secret');
    await expectLater(
      repo.uploadAttachment(file),
      throwsA(isA<ProtocolError>()),
    );
  });
  test(
    'uploads bytes to the authenticated proxy without forwarding the employee session',
    () async {
      final httpClient = MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.host, 'test.convex.site');
        expect(request.followRedirects, false);
        expect(request.headers['Content-Type'], 'application/pdf');
        expect(request.headers.containsKey('Authorization'), false);
        expect(request.bodyBytes, file.bytes);
        return http.Response(jsonEncode({'attachmentId': 'attachment-1'}), 200);
      });
      final repo = RequestRepository(client, uploadClient: httpClient);
      expect(await repo.uploadAttachment(file), 'attachment-1');
      verify(
        () => client.employeeMutation(
          name: 'requestAttachments:beginUpload',
          args: {
            'name': 'rapor.pdf',
            'contentType': 'application/pdf',
            'size': file.bytes.length,
          },
          retry: false,
        ),
      ).called(1);
    },
  );
  test('rejects an oversized file before any network request', () async {
    final repo = RequestRepository(client);
    await expectLater(
      repo.uploadAttachment(
        RequestAttachmentFile(
          name: 'big.pdf',
          contentType: 'application/pdf',
          bytes: Uint8List(RequestAttachmentFile.maxBytes + 1),
        ),
      ),
      throwsA(isA<ProtocolError>()),
    );
    verifyNever(
      () => client.employeeMutation(
        name: any(named: 'name'),
        args: any(named: 'args'),
        retry: false,
      ),
    );
  });
  test('rejects off-origin URLs and upload failures', () async {
    var sent = 0;
    final repo = RequestRepository(
      client,
      uploadClient: MockClient((_) async {
        sent++;
        return http.Response('', 415);
      }),
    );
    slot(url: 'https://attacker.test/request-attachments?ticket=secret');
    await expectLater(
      repo.uploadAttachment(file),
      throwsA(isA<ProtocolError>()),
    );
    expect(sent, 0);
    slot();
    await expectLater(
      repo.uploadAttachment(file),
      throwsA(isA<ProtocolError>()),
    );
    expect(sent, 1);
  });
  test('discards an upload result after the session changes', () async {
    final response = Completer<http.Response>();
    final started = Completer<void>();
    final repo = RequestRepository(
      client,
      uploadClient: MockClient((_) {
        started.complete();
        return response.future;
      }),
    );
    final upload = repo.uploadAttachment(file);
    final assertion = expectLater(upload, throwsA(isA<AuthExpiredError>()));
    await started.future;
    token = 'session-2';
    response.complete(http.Response('{"attachmentId":"attachment-1"}', 200));
    await assertion;
  });
  test('submits server attachment IDs for both request types', () async {
    when(
      () => client.employeeMutation(
        name: any(named: 'name'),
        args: any(named: 'args'),
        retry: false,
      ),
    ).thenAnswer((_) async => '"request-1"');
    final repo = RequestRepository(client);
    await repo.submitLeave(
      leaveType: 'sick',
      startDate: '2026-11-25',
      endDate: '2026-11-25',
      attachmentIds: ['attachment-1'],
    );
    await repo.submitCorrection(
      date: '2026-11-25',
      correctionType: 'checkIn',
      reason: 'Giriş eksik',
      requestedCheckIn: '09:00',
      attachmentIds: ['attachment-1'],
    );
    for (final name in [
      'leaveRequests:submit',
      'attendanceCorrections:submit',
    ]) {
      final args =
          verify(
                () => client.employeeMutation(
                  name: name,
                  args: captureAny(named: 'args'),
                  retry: false,
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(args['attachmentIds'], ['attachment-1']);
    }
  });
  test('parses only bounded attachment metadata in employee request lists', () {
    final json = {
      '_id': 'l1',
      'leaveType': 'sick',
      'startDate': '2026-11-25',
      'endDate': '2026-11-25',
      'status': 'pending',
      'createdAt': '2026-11-25T09:00:00Z',
      'attachments': [
        {
          '_id': 'a1',
          'name': 'rapor.pdf',
          'size': 12,
          'contentType': 'application/pdf',
        },
      ],
    };
    expect(LeaveRequest.fromJson(json).attachments.single.name, 'rapor.pdf');
    expect(
      () => RequestAttachment.parseList(List.filled(4, {})),
      throwsA(isA<ProtocolError>()),
    );
    expect(
      () => RequestAttachment.parseList([
        {
          '_id': 'a1',
          'name': 'rapor.pdf',
          'size': RequestAttachmentFile.maxBytes + 1,
        },
      ]),
      throwsA(isA<ProtocolError>()),
    );
  });
}

import 'dart:convert';

import '../config/convex_config.dart';
import '../core/errors.dart';
import '../core/response_decoder.dart';
import '../models/visitor.dart';

class VisitorRepository {
  VisitorRepository(this._client);
  final HttpConvexClient _client;
  String? get sessionKey => _client.sessionToken;
  String get deploymentUrl => _client.deploymentUrl;

  /// An authenticated, host/project-scoped receipt; null is still unresolved.
  Future<String?> getCreateReceipt(String requestId) async {
    final raw = await _client.employeeQuery('mobileVisitors:getCreateReceipt', {
      'requestId': requestId,
    });
    final Object? json;
    try {
      json = jsonDecode(raw);
    } on FormatException {
      throw const ProtocolError();
    }
    if (json == null) return null;
    if (json is! Map<String, Object?>) throw const ProtocolError();
    final id = json['id'];
    final status = json['status'];
    if (id is! String ||
        id.isEmpty ||
        status is! String ||
        !VisitorAccessStatus.values.any((value) => value.name == status)) {
      throw const ProtocolError();
    }
    return id;
  }

  Future<VisitorPage> list({
    String? cursor,
    String search = '',
    VisitorAccessStatus? status,
  }) async {
    final json = decodeResponseObject(
      await _client.employeeQuery('mobileVisitors:listPage', {
        'paginationOpts': {'numItems': 20, 'cursor': cursor},
        'search': search,
        if (status != null) 'status': status.name,
      }),
    );
    final page = json['page'];
    final done = json['isDone'];
    final next = json['continueCursor'];
    if (page is! List<Object?> ||
        done is! bool ||
        next is! String ||
        json['scanLimited'] is! bool) {
      throw const ProtocolError();
    }
    final visitors = page
        .map((value) {
          if (value is! Map<String, Object?>) throw const ProtocolError();
          return Visitor.fromJson(value);
        })
        .toList(growable: false);
    return VisitorPage(
      visitors: visitors,
      cursor: next,
      isDone: done,
      scanLimited: json['scanLimited'] as bool,
    );
  }

  Future<VisitorSummary> summary() async => VisitorSummary.fromJson(
    decodeResponseObject(
      await _client.employeeQuery('mobileVisitors:summary', {}),
    ),
  );

  Future<Visitor> detail(String id) async => Visitor.fromJson(
    decodeResponseObject(
      await _client.employeeQuery('mobileVisitors:detail', {'visitorId': id}),
    ),
    detail: true,
  );

  Future<VisitorNotice> notice() async {
    final json = decodeResponseObject(
      await _client.employeeQuery('mobileVisitors:notice', {}),
    );
    final url = json['url'];
    final version = json['version'];
    if (url == null && version == null) return const VisitorNotice();
    if (url is! String || version is! String || version.isEmpty) {
      throw const ProtocolError();
    }
    final uri = Uri.tryParse(url);
    if (uri == null ||
        !['http', 'https'].contains(uri.scheme) ||
        !uri.hasAuthority) {
      throw const ProtocolError();
    }
    return VisitorNotice(url: url, version: version);
  }

  Future<String> create(
    VisitorDraft draft, {
    required String requestId,
    required VisitorNotice notice,
    required bool noticeReviewed,
  }) async {
    final args = <String, dynamic>{
      ...draft.toJson(),
      'requestId': requestId,
      'noticeReviewed': noticeReviewed,
    };
    if (notice.version != null) args['noticeVersion'] = notice.version;
    final json = decodeResponseObject(
      await _client.employeeMutation(
        name: 'mobileVisitors:create',
        args: args,
        retry: false,
      ),
    );
    final id = json['id'];
    if (id is! String || id.isEmpty) throw const ProtocolError();
    return id;
  }

  Future<void> update(String id, VisitorDraft draft) async {
    final json = decodeResponseObject(
      await _client.employeeMutation(
        name: 'mobileVisitors:update',
        args: {...draft.toJson(), 'visitorId': id},
        retry: false,
      ),
    );
    if (json['id'] != id) throw const ProtocolError();
  }

  Future<bool> cancel(String id) async {
    final json = decodeResponseObject(
      await _client.employeeMutation(
        name: 'mobileVisitors:cancel',
        args: {'visitorId': id},
        retry: false,
      ),
    );
    return switch (json['status']) {
      'cancelled' => true,
      'operatorRequired' => false,
      _ => throw const ProtocolError(),
    };
  }
}

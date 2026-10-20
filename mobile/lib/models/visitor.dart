import 'dart:math';

import '../core/errors.dart';

enum VisitorAccessStatus { preRegistered, active, checkedOut, expired }

enum VisitorPresence { unknown, inside, outside }

enum VisitorSyncStatus { pending, applied, failed, unknown }

String visitorRequestId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

String _string(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) throw const ProtocolError();
  return value;
}

DateTime _date(Map<String, Object?> json, String key) {
  final value = _string(json, key);
  final date = DateTime.tryParse(value);
  if (date == null || !RegExp(r'(Z|[+-]\d{2}:\d{2})$').hasMatch(value)) {
    throw const ProtocolError();
  }
  return date;
}

class Visitor {
  const Visitor({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.visitStart,
    required this.visitEnd,
    required this.status,
    required this.canEdit,
    this.phone,
    this.purpose,
    this.presence = VisitorPresence.unknown,
    this.noticeUrl,
    this.noticeVersion,
    this.notes,
    this.syncStatus = VisitorSyncStatus.unknown,
  });

  factory Visitor.fromJson(Map<String, Object?> json, {bool detail = false}) {
    final status = switch (json['status']) {
      'preRegistered' => VisitorAccessStatus.preRegistered,
      'active' => VisitorAccessStatus.active,
      'checkedOut' => VisitorAccessStatus.checkedOut,
      'expired' => VisitorAccessStatus.expired,
      _ => throw const ProtocolError(),
    };
    final canEdit = json['canEdit'];
    if (canEdit is! bool) throw const ProtocolError();
    final presence = switch (json['presence']) {
      null when !detail => VisitorPresence.unknown,
      'unknown' => VisitorPresence.unknown,
      'inside' => VisitorPresence.inside,
      'outside' => VisitorPresence.outside,
      _ => throw const ProtocolError(),
    };
    if (detail &&
        ((json['visitorPhone'] != null && json['visitorPhone'] is! String) ||
            (json['notes'] != null && json['notes'] is! String) ||
            json['visitPurpose'] is! String)) {
      throw const ProtocolError();
    }
    for (final key in ['noticeUrl', 'noticeVersion']) {
      if (json[key] != null && json[key] is! String) {
        throw const ProtocolError();
      }
    }
    var syncStatus = VisitorSyncStatus.unknown;
    if (detail) {
      final sync = json['sync'];
      if (sync is! Map<String, Object?> ||
          sync['bounded'] is! bool ||
          sync['observedAt'] is! num) {
        throw const ProtocolError();
      }
      syncStatus = switch (sync['status']) {
        'pending' => VisitorSyncStatus.pending,
        'applied' => VisitorSyncStatus.applied,
        'failed' => VisitorSyncStatus.failed,
        'unknown' => VisitorSyncStatus.unknown,
        _ => throw const ProtocolError(),
      };
    }
    return Visitor(
      id: _string(json, 'id'),
      firstName: _string(json, 'firstName'),
      lastName: _string(json, 'lastName'),
      visitStart: _date(json, 'visitStart'),
      visitEnd: _date(json, 'visitEnd'),
      status: status,
      canEdit: canEdit,
      phone: detail ? json['visitorPhone'] as String? : null,
      notes: detail ? json['notes'] as String? : null,
      purpose: detail ? json['visitPurpose'] as String : null,
      presence: presence,
      noticeUrl: json['noticeUrl'] as String?,
      noticeVersion: json['noticeVersion'] as String?,
      syncStatus: syncStatus,
    );
  }

  final String id, firstName, lastName;
  final DateTime visitStart, visitEnd;
  final VisitorAccessStatus status;
  final VisitorPresence presence;
  final VisitorSyncStatus syncStatus;
  final bool canEdit;
  final String? phone, purpose, noticeUrl, noticeVersion, notes;
  String get fullName => '$firstName $lastName';
}

class VisitorPage {
  const VisitorPage({
    required this.visitors,
    required this.cursor,
    required this.isDone,
    this.scanLimited = false,
  });
  final List<Visitor> visitors;
  final String cursor;
  final bool isDone, scanLimited;
}

class VisitorNotice {
  const VisitorNotice({this.url, this.version});
  final String? url, version;
  bool get available => url != null && version != null;
}

String? _optional(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}

class VisitorDraft {
  const VisitorDraft({
    required this.firstName,
    required this.lastName,
    this.phone,
    this.notes,
    required this.purpose,
    required this.start,
    required this.end,
  });
  final String firstName, lastName, purpose;
  final String? phone, notes;
  final DateTime start, end;
  Map<String, Object?> toJson() => {
    'firstName': firstName.trim(),
    'lastName': lastName.trim(),
    'visitorPhone': _optional(phone),
    'notes': _optional(notes),
    'visitPurpose': purpose.trim(),
    'visitStart': start.toUtc().toIso8601String(),
    'visitEnd': end.toUtc().toIso8601String(),
  };
}

class PendingVisitorCreate {
  const PendingVisitorCreate({
    required this.draft,
    required this.requestId,
    required this.notice,
    required this.noticeReviewed,
  });
  final VisitorDraft draft;
  final String requestId;
  final VisitorNotice notice;
  final bool noticeReviewed;
}

class VisitorSummary {
  const VisitorSummary({
    required this.total,
    required this.counts,
    required this.overflow,
  });
  final int total;
  final Map<VisitorAccessStatus, int> counts;
  final bool overflow;
  factory VisitorSummary.fromJson(Map<String, Object?> json) {
    final total = json['total'];
    final counts = json['counts'];
    final overflow = json['overflow'];
    if (total is! int ||
        total < 0 ||
        counts is! Map<String, Object?> ||
        overflow is! bool) {
      throw const ProtocolError();
    }
    final mapped = <VisitorAccessStatus, int>{};
    for (final status in VisitorAccessStatus.values) {
      final value = counts[status.name];
      if (value is! int || value < 0) throw const ProtocolError();
      mapped[status] = value;
    }
    if (mapped.values.fold<int>(0, (sum, count) => sum + count) != total) {
      throw const ProtocolError();
    }
    return VisitorSummary(total: total, counts: mapped, overflow: overflow);
  }
}

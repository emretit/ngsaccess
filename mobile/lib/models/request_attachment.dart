import 'dart:typed_data';
import '../core/errors.dart';

class RequestAttachment {
  const RequestAttachment({
    required this.id,
    required this.name,
    required this.size,
  });
  final String id, name;
  final int size;
  static List<RequestAttachment> parseList(Object? value) {
    if (value == null) return const [];
    if (value is! List || value.length > 3) throw const ProtocolError();
    return value.map((row) {
      if (row is! Map<String, dynamic> ||
          row['_id'] is! String ||
          row['name'] is! String ||
          row['size'] is! num) {
        throw const ProtocolError();
      }
      final size = (row['size'] as num).toInt();
      if (size <= 0 || size > RequestAttachmentFile.maxBytes) {
        throw const ProtocolError();
      }
      return RequestAttachment(
        id: row['_id'] as String,
        name: row['name'] as String,
        size: size,
      );
    }).toList();
  }
}

/// Kept in memory only until the request is submitted or the form is closed.
class RequestAttachmentFile {
  const RequestAttachmentFile({
    required this.name,
    required this.contentType,
    required this.bytes,
  });
  final String name, contentType;
  final Uint8List bytes;

  static const maxBytes = 5 * 1024 * 1024;
  static String? contentTypeFor(String name) =>
      switch (name.split('.').last.toLowerCase()) {
        'pdf' => 'application/pdf',
        'jpg' || 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        _ => null,
      };
}

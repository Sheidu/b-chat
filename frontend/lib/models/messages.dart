class Message {
  const Message({
    this.id,
    required this.fromId,
    required this.toId,
    required this.text,
    required this.timestamp,
  });

  final int? id;
  final int fromId;
  final int toId;
  final String text;
  final DateTime timestamp;

  bool isSentBy(int userId) => fromId == userId;

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: _parseOptionalInt(json['id']),
      fromId: _parseInt(json['from_id'] ?? json['from']),
      toId: _parseInt(json['to_id'] ?? json['to']),
      text: (json['text'] ?? '').toString(),
      timestamp: _parseDateTime(json['timestamp']),
    );
  }

  factory Message.optimistic({
    required int fromId,
    required int toId,
    required String text,
  }) {
    return Message(
      fromId: fromId,
      toId: toId,
      text: text,
      timestamp: DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'from_id': fromId,
      'to_id': toId,
      'text': text,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  static int _parseInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) {
      final parsed = int.tryParse(value);
      if (parsed != null) return parsed;
    }
    throw FormatException('Invalid integer value: $value');
  }

  static int? _parseOptionalInt(dynamic value) {
    if (value == null) return null;
    return _parseInt(value);
  }

  static DateTime _parseDateTime(dynamic value) {
    if (value is DateTime) return value;
    if (value is String) {
      final parsed = DateTime.tryParse(value);
      if (parsed != null) return parsed;
    }
    return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
  }
}

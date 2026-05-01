enum LocalDeliveryState { pending, failed, sent }

class Message {
  const Message({
    this.id,
    this.clientToken,
    required this.fromId,
    required this.toId,
    required this.text,
    required this.timestamp,
    this.localState = LocalDeliveryState.sent,
  });

  final int? id;
  final String? clientToken;
  final int fromId;
  final int toId;
  final String text;
  final DateTime timestamp;
  final LocalDeliveryState localState;

  bool isSentBy(int userId) => fromId == userId;

  Message copyWith({
    int? id,
    String? clientToken,
    int? fromId,
    int? toId,
    String? text,
    DateTime? timestamp,
    LocalDeliveryState? localState,
  }) {
    return Message(
      id: id ?? this.id,
      clientToken: clientToken ?? this.clientToken,
      fromId: fromId ?? this.fromId,
      toId: toId ?? this.toId,
      text: text ?? this.text,
      timestamp: timestamp ?? this.timestamp,
      localState: localState ?? this.localState,
    );
  }

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: _parseOptionalInt(json['id']),
      clientToken: _parseOptionalString(json['client_token'] ?? json['clientToken']),
      fromId: _parseInt(json['from_id'] ?? json['from']),
      toId: _parseInt(json['to_id'] ?? json['to']),
      text: (json['text'] ?? '').toString(),
      timestamp: _parseDateTime(json['timestamp']),
      localState: LocalDeliveryState.sent,
    );
  }

  factory Message.optimistic({
    required int fromId,
    required int toId,
    required String text,
    required String clientToken,
  }) {
    return Message(
      clientToken: clientToken,
      fromId: fromId,
      toId: toId,
      text: text,
      timestamp: DateTime.now().toUtc(),
      localState: LocalDeliveryState.pending,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (clientToken != null) 'client_token': clientToken,
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

  static String? _parseOptionalString(dynamic value) {
    if (value == null) return null;
    final asString = value.toString().trim();
    if (asString.isEmpty) return null;
    return asString;
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

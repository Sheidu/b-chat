import '../models/messages.dart';

class ConversationMessageStore {
  final List<Message> _messages = [];
  int suppressedDuplicates = 0;

  List<Message> get items => List.unmodifiable(_messages);

  void addOrReplace(Message incoming) {
    final optimisticIndex = incoming.clientToken == null
        ? -1
        : _messages.lastIndexWhere(
            (existing) =>
                existing.id == null &&
                existing.clientToken != null &&
                existing.clientToken == incoming.clientToken,
          );

    if (optimisticIndex != -1) {
      _messages[optimisticIndex] = incoming;
      return;
    }

    final alreadyPresent = incoming.id != null && _messages.any((existing) => existing.id == incoming.id);
    if (alreadyPresent) {
      suppressedDuplicates += 1;
      return;
    }

    _messages.add(incoming);
    _messages.sort((a, b) => a.timestamp.compareTo(b.timestamp));
  }

  void markFailedByClientToken(String clientToken) {
    final index = _messages.lastIndexWhere((message) => message.clientToken == clientToken);
    if (index == -1) return;
    _messages[index] = _messages[index].copyWith(localState: LocalDeliveryState.failed);
  }

  Message? removeByClientToken(String clientToken) {
    final index = _messages.lastIndexWhere((message) => message.clientToken == clientToken);
    if (index == -1) return null;
    return _messages.removeAt(index);
  }
}

import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/models/messages.dart';
import 'package:frontend/services/conversation_message_store.dart';

void main() {
  test('replaces optimistic message with acknowledged server message', () {
    final store = ConversationMessageStore();

    store.addOrReplace(
      Message.optimistic(
        fromId: 1,
        toId: 2,
        text: 'hi',
        clientToken: 't-1',
      ),
    );

    store.addOrReplace(
      Message.fromJson({
        'id': 55,
        'from_id': 1,
        'to_id': 2,
        'text': 'hi',
        'client_token': 't-1',
        'timestamp': DateTime.now().toUtc().toIso8601String(),
      }),
    );

    expect(store.items.length, 1);
    expect(store.items.first.id, 55);
  });

  test('suppresses duplicate messages and tracks hidden count', () {
    final store = ConversationMessageStore();
    final ts = DateTime.now().toUtc().toIso8601String();

    store.addOrReplace(
      Message.fromJson({'id': 8, 'from_id': 1, 'to_id': 2, 'text': 'hello', 'timestamp': ts}),
    );
    store.addOrReplace(
      Message.fromJson({'id': 8, 'from_id': 1, 'to_id': 2, 'text': 'hello', 'timestamp': ts}),
    );

    expect(store.items.length, 1);
    expect(store.suppressedDuplicates, 1);
  });
}

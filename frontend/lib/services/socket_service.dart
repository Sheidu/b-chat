import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../config/app_config.dart';

class SocketService with ChangeNotifier {
  IO.Socket? _socket;
  bool get isConnected => _socket?.connected ?? false;

  static String get baseUrl => AppConfig.baseUrl;

  void connect(int userId) {
    if (_socket != null) {
      if (_socket!.connected) return;
      _socket!.connect();
      return;
    }

    _socket = IO.io(
      baseUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])          // force websocket (more reliable)
          .setExtraHeaders({'Connection': 'upgrade'})
          .enableForceNew()                      // avoid session reuse issues
          .setTimeout(10000)                     // connection timeout
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('Socket connected → user $userId');
      _socket!.emit('join', userId);
      notifyListeners();
    });

    _socket!.onDisconnect((reason) {
      debugPrint('Socket disconnected: $reason');
      notifyListeners();
    });

    _socket!.onConnectError((err) {
      debugPrint('Connection error: $err');
    });

    _socket!.onError((err) {
      debugPrint('Socket error: $err');
    });

    _socket!.connect();
  }

  void sendMessage({
    required int fromId,
    required int toId,
    required String text,
  }) {
    if (!isConnected || _socket == null) {
      debugPrint('Cannot send: not connected');
      return;
    }

    _socket!.emit('sendMessage', {
      'from': fromId,
      'to': toId,
      'text': text,
    });
  }

  void listenNewMessages(void Function(dynamic data) callback) {
    _socket?.on('newMessage', (data) {
      debugPrint('Received newMessage: $data');
      callback(data);
    });
  }

  @override
  void dispose() {
    _socket?.off('newMessage');
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    notifyListeners();
    super.dispose();
  }
}
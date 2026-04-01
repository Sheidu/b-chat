import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/app_config.dart';
import '../l10n/app_localizations.dart';
import '../models/messages.dart';

/// Connection state enum for UI localization
enum SocketConnectionState {
  disconnected,
  connecting,
  connected,
  error,
}

class SocketService with ChangeNotifier {
  io.Socket? _socket;
  SocketConnectionState _connectionState = SocketConnectionState.disconnected;

  bool get isConnected => _socket?.connected ?? false;
  SocketConnectionState get connectionState => _connectionState;

  static String get baseUrl => AppConfig.baseUrl;

  void connect(int userId) {
    if (_socket != null) {
      if (_socket!.connected) {
        _connectionState = SocketConnectionState.connected;
        notifyListeners();
        return;
      }
      _socket!.connect();
      _connectionState = SocketConnectionState.connecting;
      notifyListeners();
      return;
    }

    _connectionState = SocketConnectionState.connecting;
    notifyListeners();

    // ✅ socket_io_client v3.x API - pass options directly as Map
    _socket = io.io(
      baseUrl,
      <String, dynamic>{
        'transports': ['websocket'],
        'extraHeaders': {'Connection': 'upgrade'},
        'forceNew': true, 
        'autoConnect': false,
        'reconnection': true,
        'reconnectionAttempts': 5,
        'reconnectionDelay': 1000,
        'reconnectionDelayMax': 5000,
        'timeout': 10000
      },
    );

    _socket!.onConnect((_) {
      if (kDebugMode) debugPrint('✓ Socket connected → user $userId');
      _connectionState = SocketConnectionState.connected;
      notifyListeners();
      _socket!.emit('join', userId);
    });

    _socket!.onDisconnect((reason) {
      if (kDebugMode) debugPrint('✗ Socket disconnected: $reason');
      _connectionState = SocketConnectionState.disconnected;
      notifyListeners();
    });

    _socket!.onConnectError((err) {
      if (kDebugMode) debugPrint('⚠ Connection error: $err');
      _connectionState = SocketConnectionState.error;
      notifyListeners();
    });

    _socket!.onError((err) {
      if (kDebugMode) debugPrint('⚠ Socket error: $err');
      _connectionState = SocketConnectionState.error;
      notifyListeners();
    });

    _socket!.connect();
  }

  bool sendMessage({
    required int fromId,
    required int toId,
    required String text,
    required String clientToken,
  }) {
    if (!isConnected || _socket == null) {
      if (kDebugMode) debugPrint('✗ Cannot send: socket not connected');
      return false;
    }
    _socket!.emit('sendMessage', {
      'from': fromId,
      'to': toId,
      'text': text,
      'clientToken': clientToken,
    });
    if (kDebugMode) debugPrint('→ Sent message (token: $clientToken)');
    return true;
  }

  void listenNewMessages(void Function(Message message) callback) {
    _socket?.on('newMessage', (data) {
      if (kDebugMode) debugPrint('← Received newMessage payload');
      if (data is! Map) {
        if (kDebugMode) debugPrint('⚠ Ignoring malformed newMessage: ${data.runtimeType}');
        return;
      }
      try {
        callback(Message.fromJson(Map<String, dynamic>.from(data)));
      } on FormatException catch (err) {
        if (kDebugMode) debugPrint('⚠ Invalid newMessage payload: $err');
      }
    });
  }

  void listenUsersChanged(VoidCallback callback) {
    _socket?.off('usersChanged');
    _socket?.on('usersChanged', (_) {
      if (kDebugMode) debugPrint('← Received usersChanged event');
      callback();
    });
  }

  void listenConnectionState(void Function(SocketConnectionState state) callback) {
    callback(_connectionState);
  }

  String getConnectionStatusText(AppLocalizations l10n) {
    switch (_connectionState) {
      case SocketConnectionState.connected:
        return l10n.connectionStatusConnected;
      case SocketConnectionState.connecting:
        return l10n.connectionStatusConnecting;
      case SocketConnectionState.disconnected:
        return l10n.connectionStatusDisconnected;
      case SocketConnectionState.error:
        return l10n.connectionStatusError;
    }
  }

  @override
  void dispose() {
    if (kDebugMode) debugPrint('🔌 SocketService disposing...');
    _socket?.off('newMessage');
    _socket?.off('usersChanged');
    _socket?.off('connect');
    _socket?.off('disconnect');
    _socket?.off('connect_error');
    _socket?.off('error');
    if (_socket?.connected ?? false) _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _connectionState = SocketConnectionState.disconnected;
    notifyListeners();
    super.dispose();
  }
}
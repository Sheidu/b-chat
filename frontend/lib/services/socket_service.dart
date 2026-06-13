import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/app_config.dart';
import '../l10n/app_localizations.dart';
import '../models/messages.dart';

enum SocketConnectionState { disconnected, connecting, connected, error }

class _PendingOutgoingMessage {
  _PendingOutgoingMessage({
    required this.fromId,
    required this.toId,
    required this.text,
    required this.clientToken,
  });

  final int fromId;
  final int toId;
  final String text;
  final String clientToken;
  int attempts = 0;
}

class SocketService with ChangeNotifier {
  io.Socket? _socket;
  SocketConnectionState _connectionState = SocketConnectionState.disconnected;
  final Map<String, _PendingOutgoingMessage> _pendingQueue = {};
  final int _maxSendAttempts = 3;
  final Set<void Function(String)> _ackListeners = {};
  final Set<void Function(String)> _failureListeners = {};
  final Set<VoidCallback> _usersChangedListeners = {};
  bool _usersChangedListenerRegistered = false;
  int? _boundUserId;
  String? _boundToken;

  bool get isConnected => _socket?.connected ?? false;
  SocketConnectionState get connectionState => _connectionState;
  static String get baseUrl => AppConfig.baseUrl;

  void connect(int userId, {String? token}) {
    final shouldRebindIdentity = _boundUserId != null && (_boundUserId != userId || _boundToken != token);

    if (_socket != null) {
      if (_socket!.connected && !shouldRebindIdentity) {
        _connectionState = SocketConnectionState.connected;
        notifyListeners();
        return;
      }

      // Recreate socket on reconnect attempts or auth identity changes.
      _socket!.dispose();
      _socket = null;
    }

    _boundUserId = userId;
    _boundToken = token;

    _connectionState = SocketConnectionState.connecting;
    notifyListeners();

    _socket = io.io(baseUrl, <String, dynamic>{
      if (token != null) 'auth': {'token': token},
      'transports': ['websocket'],
      'forceNew': true,
      'autoConnect': false,
      'reconnection': true,
      'reconnectionAttempts': 5,
      'reconnectionDelay': 1000,
      'reconnectionDelayMax': 5000,
      'timeout': 10000,
    });

    _socket!.onConnect((_) {
      _connectionState = SocketConnectionState.connected;
      notifyListeners();
      _socket!.emit('join', userId);
      _flushPendingQueue();
    });

    _socket!.onDisconnect((_) {
      _connectionState = SocketConnectionState.disconnected;
      notifyListeners();
    });

    _socket!.onConnectError((_) {
      _connectionState = SocketConnectionState.error;
      notifyListeners();
    });

    _socket!.onError((_) {
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
    final pending = _PendingOutgoingMessage(
      fromId: fromId,
      toId: toId,
      text: text,
      clientToken: clientToken,
    );
    _pendingQueue[clientToken] = pending;

    if (!isConnected || _socket == null) {
      return false;
    }

    _dispatchPendingMessage(pending);
    return true;
  }

  bool hasPendingToken(String clientToken) => _pendingQueue.containsKey(clientToken);

  void listenDeliveryAcks(void Function(String clientToken) callback) {
    _ackListeners.add(callback);
  }

  void listenDeliveryFailures(void Function(String clientToken) callback) {
    _failureListeners.add(callback);
  }

  void _notifyAck(String clientToken) {
    for (final callback in _ackListeners.toList()) {
      callback(clientToken);
    }
  }

  void _notifyFailure(String clientToken) {
    for (final callback in _failureListeners.toList()) {
      callback(clientToken);
    }
  }

  void _flushPendingQueue() {
    for (final pending in _pendingQueue.values.toList()) {
      _dispatchPendingMessage(pending);
    }
  }

  void _dispatchPendingMessage(_PendingOutgoingMessage pending) {
    if (_socket == null || !isConnected) return;
    if (!_pendingQueue.containsKey(pending.clientToken)) return;
    if (pending.attempts >= _maxSendAttempts) {
      _pendingQueue.remove(pending.clientToken);
      _notifyFailure(pending.clientToken);
      return;
    }

    pending.attempts += 1;

    _socket!.emitWithAck(
      'sendMessage',
      {
        'from': pending.fromId,
        'to': pending.toId,
        'text': pending.text,
        'clientToken': pending.clientToken,
      },
      ack: (dynamic rawAck) {
        if (!_pendingQueue.containsKey(pending.clientToken)) {
          return;
        }

        if (rawAck is Map && rawAck['ok'] == true) {
          _pendingQueue.remove(pending.clientToken);
          _notifyAck(pending.clientToken);
          return;
        }

        if (isConnected) {
          Future<void>.delayed(const Duration(milliseconds: 800), () {
            _dispatchPendingMessage(pending);
          });
        }
      },
    );

    unawaited(
      Future<void>.delayed(const Duration(seconds: 4), () {
        if (_pendingQueue.containsKey(pending.clientToken) && isConnected) {
          _dispatchPendingMessage(pending);
        }
      }),
    );
  }

  void listenNewMessages(void Function(Message message) callback) {
    _socket?.on('newMessage', (data) {
      if (data is! Map) return;
      try {
        callback(Message.fromJson(Map<String, dynamic>.from(data)));
      } on FormatException {
        return;
      }
    });
  }

  void listenUsersChanged(VoidCallback callback) {
    _usersChangedListeners.add(callback);
    if (!_usersChangedListenerRegistered && _socket != null) {
      _usersChangedListenerRegistered = true;
      _socket!.on('usersChanged', (_) {
        for (final cb in _usersChangedListeners.toList()) {
          cb();
        }
      });
    }
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
    _socket?.off('newMessage');
    _socket?.off('usersChanged');
    _socket?.off('connect');
    _socket?.off('disconnect');
    _socket?.off('connect_error');
    _socket?.off('error');
    if (_socket?.connected ?? false) _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _boundUserId = null;
    _boundToken = null;
    _pendingQueue.clear();
    _ackListeners.clear();
    _failureListeners.clear();
    _usersChangedListeners.clear();
    _usersChangedListenerRegistered = false;
    _connectionState = SocketConnectionState.disconnected;
    notifyListeners();
    super.dispose();
  }
}

import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/messages.dart';
import '../providers/auth_provider.dart';
import '../services/socket_service.dart';
import '../services/conversation_message_store.dart';

class ChatScreen extends StatefulWidget {
  final Map<String, dynamic> otherUser; // {id, name, email}

  const ChatScreen({super.key, required this.otherUser});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _messageController = TextEditingController();
  final ConversationMessageStore _messageStore = ConversationMessageStore();
  final Map<String, DateTime> _pendingExpiryByToken = {};
  bool _loadingHistory = true;
  late SocketService _socketService;
  int? _currentUserId;
  int _clientTokenCounter = 0;
  int get _otherUserId => _parseUserId(widget.otherUser['id']);

  @override
  void initState() {
    super.initState();

    _messageController.addListener(() {
      if (mounted) {
        setState(() {});
      }
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    _currentUserId = _parseOptionalUserId(auth.user?['id']);

    if (_currentUserId == null) {
      Navigator.pop(context);
      return;
    }

    _socketService = Provider.of<SocketService>(context, listen: false);
    if (!_socketService.isConnected) {
      _socketService.connect(_currentUserId!, token: auth.token);
    }

    _socketService.listenDeliveryAcks((clientToken) {
      if (!mounted) return;
      setState(() {
        _pendingExpiryByToken.remove(clientToken);
      });
    });

    _socketService.listenDeliveryFailures((clientToken) {
      if (!mounted) return;
      setState(() {
        _pendingExpiryByToken.remove(clientToken);
        _messageStore.markFailedByClientToken(clientToken);
      });
    });

    _socketService.listenNewMessages((message) {
      if (!mounted) return;

      if (!_isForCurrentConversation(message)) {
        return;
      }

      setState(() {
        if (message.clientToken != null) {
          _pendingExpiryByToken.remove(message.clientToken);
        }
        _messageStore.addOrReplace(message);
      });
    });

    _loadMessageHistory();
  }

  Future<void> _loadMessageHistory() async {
    if (_currentUserId == null) return;

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final uri = Uri.parse(
        '${SocketService.baseUrl}/messages/$_currentUserId/$_otherUserId?limit=50',
      );
      final response = await http.get(uri, headers: auth.authJsonHeaders);

      if (response.statusCode == 401) {
        await auth.handleUnauthorized();
        setState(() => _loadingHistory = false);
        return;
      }

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        final parsed = data
            .whereType<Map>()
            .map((raw) => Message.fromJson(Map<String, dynamic>.from(raw)))
            .toList();

        setState(() {
          _mergeFetchedHistory(parsed);
          _loadingHistory = false;
        });
      } else {
        debugPrint('History load failed: ${response.body}');
        setState(() => _loadingHistory = false);
      }
    } catch (e) {
      debugPrint('History error: $e');
      setState(() => _loadingHistory = false);
    }
  }

  void _sendMessage({String? overrideText}) {
    final text = (overrideText ?? _messageController.text).trim();
    if (text.isEmpty || _currentUserId == null) return;

    final clientToken = _nextClientToken();

    final sent = _socketService.sendMessage(
      fromId: _currentUserId!,
      toId: _otherUserId,
      text: text,
      clientToken: clientToken,
    );

    if (!sent && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context)!.connectionLost),
          backgroundColor: Colors.orange,
        ),
      );
    }

    setState(() {
      _messageStore.addOrReplace(
        Message.optimistic(
          fromId: _currentUserId!,
          toId: _otherUserId,
          text: text,
          clientToken: clientToken,
        ),
      );
      _pendingExpiryByToken[clientToken] = DateTime.now().toUtc().add(const Duration(seconds: 10));
    });

    _startFailureDeadline(clientToken);
    _messageController.clear();
  }

  void _startFailureDeadline(String clientToken) {
    Future<void>.delayed(const Duration(seconds: 10), () {
      if (!mounted) return;
      final expiry = _pendingExpiryByToken[clientToken];
      if (expiry == null) return;
      if (DateTime.now().toUtc().isBefore(expiry)) return;
      if (!_socketService.hasPendingToken(clientToken)) {
        _pendingExpiryByToken.remove(clientToken);
        return;
      }

      setState(() {
        _pendingExpiryByToken.remove(clientToken);
        _messageStore.markFailedByClientToken(clientToken);
      });
    });
  }

  void _retryMessage(Message failedMessage) {
    final token = failedMessage.clientToken;
    if (token != null) {
      setState(() {
        _messageStore.removeByClientToken(token);
      });
    }
    _sendMessage(overrideText: failedMessage.text);
  }

  void _mergeFetchedHistory(List<Message> fetchedHistory) {
    for (final message in fetchedHistory) {
      _messageStore.addOrReplace(message);
    }
  }

  String _nextClientToken() {
    final nowMicros = DateTime.now().toUtc().microsecondsSinceEpoch;
    // Use a numeric literal instead of `1 << 32`: on Flutter Web that shift can
    // be evaluated through JavaScript's 32-bit shift semantics and become 0,
    // which makes Random.nextInt throw `RangeError: max ... was 0`.
    final randomPart = Random.secure().nextInt(0x100000000).toRadixString(16);
    final counterPart = (_clientTokenCounter++).toRadixString(16);
    return '${_currentUserId}_${nowMicros}_${counterPart}_$randomPart';
  }

  bool _isForCurrentConversation(Message message) {
    if (_currentUserId == null) return false;

    final sentByCurrentUser =
        message.fromId == _currentUserId && message.toId == _otherUserId;
    final receivedFromSelectedUser =
        message.fromId == _otherUserId && message.toId == _currentUserId;

    return sentByCurrentUser || receivedFromSelectedUser;
  }

  int _parseUserId(dynamic rawId) {
    final parsed = _parseOptionalUserId(rawId);
    if (parsed == null) {
      throw const FormatException('Invalid conversation user id');
    }
    return parsed;
  }

  int? _parseOptionalUserId(dynamic rawId) {
    if (rawId == null) return null;
    if (rawId is int) return rawId;
    if (rawId is num) return rawId.toInt();
    if (rawId is String) return int.tryParse(rawId);
    return null;
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Color _getStatusColor(SocketConnectionState state) {
    switch (state) {
      case SocketConnectionState.connected:
        return Colors.green;
      case SocketConnectionState.connecting:
        return Colors.orange;
      case SocketConnectionState.disconnected:
        return Colors.grey;
      case SocketConnectionState.error:
        return Colors.red;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final otherUserName = widget.otherUser['name'] ?? widget.otherUser['email'] ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.chatTitle(otherUserName)),
        actions: [
          Consumer<SocketService>(
            builder: (context, socketService, _) {
              return Text(
                socketService.getConnectionStatusText(l10n),
                style: TextStyle(
                  fontSize: 12,
                  color: _getStatusColor(socketService.connectionState),
                ),
              );
            },
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: Column(
        children: [
          Consumer<SocketService>(
            builder: (context, socketService, _) {
              if (socketService.connectionState == SocketConnectionState.disconnected ||
                  socketService.connectionState == SocketConnectionState.error) {
                return Container(
                  width: double.infinity,
                  color: Colors.orange[100],
                  padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning_amber_rounded, size: 16, color: Colors.orange[800]),
                      const SizedBox(width: 8),
                      Text(
                        l10n.connectionLost,
                        style: TextStyle(fontSize: 12, color: Colors.orange[800]),
                      ),
                    ],
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
          if (_loadingHistory)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: 16),
                    Text(l10n.loadingMessages, style: const TextStyle(color: Colors.grey)),
                  ],
                ),
              ),
            )
          else
            Expanded(
              child: _messageStore.items.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.chat_bubble_outline, size: 48, color: Colors.grey[400]),
                          const SizedBox(height: 12),
                          Text(
                            l10n.noMessages,
                            style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      reverse: true,
                      padding: const EdgeInsets.all(8),
                      itemCount: _messageStore.items.length,
                      itemBuilder: (context, index) {
                        final msg = _messageStore.items[_messageStore.items.length - 1 - index];
                        final isMe = msg.isSentBy(_currentUserId ?? -1);

                        return Align(
                          alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                          child: Container(
                            margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: isMe ? Colors.blue[100] : Colors.grey[300],
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  msg.text,
                                  style: TextStyle(
                                    color: isMe ? Colors.blue[900] : Colors.black87,
                                  ),
                                ),
                                if (isMe && msg.localState == LocalDeliveryState.failed)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: TextButton.icon(
                                      onPressed: () => _retryMessage(msg),
                                      icon: const Icon(Icons.refresh, size: 16),
                                      label: Text(l10n.retryButton),
                                      style: TextButton.styleFrom(
                                        foregroundColor: Colors.red[700],
                                        visualDensity: VisualDensity.compact,
                                        padding: EdgeInsets.zero,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: InputDecoration(
                      hintText: l10n.chatHint,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      isDense: true,
                    ),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: _sendMessage,
                  tooltip: l10n.sendMessage,
                  color: _messageController.text.trim().isEmpty ? Colors.grey : Colors.blue,
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
        color: Theme.of(context).canvasColor,
        child: Text(
          l10n.complianceFooter,
          style: const TextStyle(fontSize: 9, color: Colors.grey),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

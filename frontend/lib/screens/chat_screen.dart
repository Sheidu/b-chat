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
  bool _loadingHistory = true;
  late SocketService _socketService;
  int? _currentUserId;
  int _clientTokenCounter = 0;
  int get _otherUserId => _parseUserId(widget.otherUser['id']);

  @override
  void initState() {
    super.initState();

    // ✅ Add listener to rebuild UI when text changes (for send button color)
    _messageController.addListener(() {
      if (mounted) {
        setState(() {
          // Empty setState to trigger rebuild for button color update
        });
      }
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    _currentUserId = _parseOptionalUserId(auth.user?['id']);

    if (_currentUserId == null) {
      Navigator.pop(context);
      return;
    }

    _socketService = Provider.of<SocketService>(context, listen: false);
    // Connect if not already connected (idempotent).
    if (!_socketService.isConnected) {
      _socketService.connect(_currentUserId!);
    }
    
    // ✅ Connection state is now read via Consumer<SocketService> in build()    
    _socketService.listenNewMessages((message) {
      if (!mounted) return;

      if (!_isForCurrentConversation(message)) {
        return;
      }

      setState(() {
        _messageStore.addOrReplace(message);
      });
    });

    _loadMessageHistory();
  }

  Future<void> _loadMessageHistory() async {
    if (_currentUserId == null) return;

    try {
      final uri = Uri.parse(
        '${SocketService.baseUrl}/messages/$_currentUserId/$_otherUserId',
      );
      final response = await http.get(uri);

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

  void _sendMessage() {
    final text = _messageController.text.trim();
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

    // Optimistic UI update (queued during transient disconnect)
    setState(() {
      _messageStore.addOrReplace(
        Message.optimistic(
          fromId: _currentUserId!,
          toId: _otherUserId,
          text: text,
          clientToken: clientToken,
        ),
      );
    });

    _messageController.clear();
  }

  void _mergeFetchedHistory(List<Message> fetchedHistory) {
    for (final message in fetchedHistory) {
      _messageStore.addOrReplace(message);
    }
  }

  String _nextClientToken() {
    final nowMicros = DateTime.now().toUtc().microsecondsSinceEpoch;
    final randomPart = Random.secure().nextInt(1 << 32).toRadixString(16);
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
    // Do NOT dispose _socketService here — it is owned by the Provider
    // and shared with HomeScreen. Only clean up what this screen owns.
    _messageController.dispose();
    super.dispose();
  }

  // ✅ Helper for status color - with default return for null-safety
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
          // ✅ Connection status indicator - uses Consumer for real-time sync
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
          // ✅ Connection banner - ALSO uses Consumer for sync with AppBar
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
              return const SizedBox.shrink(); // Hide banner when connected
            },
          ),
          
          if (_messageStore.suppressedDuplicates > 0)
            Container(
              width: double.infinity,
              color: Colors.blueGrey[50],
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
              child: Text(
                'Hidden duplicate messages: ${_messageStore.suppressedDuplicates}',
                style: const TextStyle(fontSize: 11, color: Colors.blueGrey),
              ),
            ),

          // Loading state
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
                            child: Text(
                              msg.text,
                              style: TextStyle(
                                color: isMe ? Colors.blue[900] : Colors.black87,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          
          // Message input area
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
      // Compliance footer for RU users
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
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../models/messages.dart';
import '../providers/auth_provider.dart';
import '../services/socket_service.dart';

class ChatScreen extends StatefulWidget {
  final Map<String, dynamic> otherUser; // {id, name, email}

  const ChatScreen({super.key, required this.otherUser});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _messageController = TextEditingController();
  final List<Message> _messages = [];
  bool _loadingHistory = true;
  late SocketService _socketService;
  int? _currentUserId;

  int get _otherUserId => _parseUserId(widget.otherUser['id']);

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _currentUserId = _parseOptionalUserId(auth.user?['id']);

    if (_currentUserId == null) {
      Navigator.pop(context);
      return;
    }

    _socketService = SocketService();
    _socketService.connect(_currentUserId!);
    _socketService.listenNewMessages((message) {
      if (!mounted) return;

      if (!_isForCurrentConversation(message)) {
        return;
      }

      setState(() {
        _upsertIncomingMessage(message);
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
          _messages
            ..clear()
            ..addAll(parsed);
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

    _socketService.sendMessage(
      fromId: _currentUserId!,
      toId: _otherUserId,
      text: text,
    );

    // Optimistic UI update
    setState(() {
      _messages.add(
        Message.optimistic(
          fromId: _currentUserId!,
          toId: _otherUserId,
          text: text,
        ),
      );
    });

    _messageController.clear();
  }

  void _upsertIncomingMessage(Message incoming) {
    // Replace matching optimistic message from current user once server echoes it
    final optimisticIndex = _messages.lastIndexWhere((existing) {
      if (existing.id != null) return false;
      return existing.fromId == incoming.fromId &&
          existing.toId == incoming.toId &&
          existing.text == incoming.text;
    });

    if (optimisticIndex != -1) {
      _messages[optimisticIndex] = incoming;
      return;
    }

    final alreadyPresent = incoming.id != null &&
        _messages.any((existing) => existing.id == incoming.id);
    if (!alreadyPresent) {
      _messages.add(incoming);
    }
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
    _socketService.dispose();
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.otherUser['name'] ?? widget.otherUser['email']),
      ),
      body: Column(
        children: [
          if (_loadingHistory)
            const Padding(
              padding: EdgeInsets.all(16.0),
              child: Center(child: CircularProgressIndicator()),
            )
          else
            Expanded(
              child: ListView.builder(
                reverse: true, // newest at bottom
                padding: const EdgeInsets.all(8),
                itemCount: _messages.length,
                itemBuilder: (context, index) {
                  final msg = _messages[_messages.length - 1 - index];
                  final isMe = msg.isSentBy(_currentUserId ?? -1);

                  return Align(
                    alignment:
                        isMe ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.symmetric(
                        vertical: 4,
                        horizontal: 8,
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
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
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: InputDecoration(
                      hintText: 'Type a message...',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send, color: Colors.blue),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

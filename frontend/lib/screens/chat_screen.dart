import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';         // your auth provider
import '../services/socket_service.dart';

class ChatScreen extends StatefulWidget {
  final Map<String, dynamic> otherUser; // {id, name, email}

  const ChatScreen({super.key, required this.otherUser});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _messageController = TextEditingController();
  final List<Map<String, dynamic>> _messages = [];
  bool _loadingHistory = true;
  late SocketService _socketService;
  int? _currentUserId;

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _currentUserId = auth.user?['id'];

    if (_currentUserId == null) {
      Navigator.pop(context);
      return;
    }

    _socketService = SocketService();
    _socketService.connect(_currentUserId!);
    _socketService.listenNewMessages((data) {
      if (!mounted) return;
      setState(() {
        _messages.add({
          ...data,
          'isMe': data['from_id'] == _currentUserId,
        });
      });
    });

    _loadMessageHistory();
  }

  Future<void> _loadMessageHistory() async {
    if (_currentUserId == null) return;

    try {
      final uri = Uri.parse(
        '${SocketService.baseUrl}/messages/$_currentUserId/${widget.otherUser['id']}',
      );
      final response = await http.get(uri);

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        setState(() {
          _messages.addAll(
            data.map((m) => {
                  ...m,
                  'isMe': m['from_id'] == _currentUserId,
                }),
          );
          _loadingHistory = false;
        });
      } else {
        debugPrint('History load failed: ${response.body}');
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
      toId: widget.otherUser['id'],
      text: text,
    );

    // Optimistic UI update
    setState(() {
      _messages.add({
        'from_id': _currentUserId,
        'text': text,
        'timestamp': DateTime.now().toIso8601String(),
        'isMe': true,
      });
    });

    _messageController.clear();
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
                  final isMe = msg['isMe'] == true;

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
                        msg['text'] ?? '',
                        style: TextStyle(color: isMe ? Colors.blue[900] : Colors.black87),
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
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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
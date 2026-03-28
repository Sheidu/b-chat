import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../config/app_config.dart';
import '../providers/auth_provider.dart';
import 'chat_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<dynamic> _users = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    try {
      final response = await http.get(
        Uri.parse('${AppConfig.baseUrl}/users'),
      );

      if (response.statusCode == 200) {
        setState(() {
          _users = jsonDecode(response.body);
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load users';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Network error: $e';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final currentUserId = auth.user?['id'];

    return Scaffold(
      appBar: AppBar(
        title: Text('Family – ${auth.user?['name'] ?? 'You'}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              auth.logout();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : _users.isEmpty
                  ? const Center(child: Text('No family members yet...'))
                  : ListView.builder(
                      itemCount: _users.length,
                      itemBuilder: (context, index) {
                        final user = _users[index];
                        if (user['id'] == currentUserId) return const SizedBox.shrink();

                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Colors.blue[100],
                            child: Text(
                              (user['name'] ?? user['email'])[0].toUpperCase(),
                              style: const TextStyle(color: Colors.blue),
                            ),
                          ),
                          title: Text(user['name'] ?? user['email']),
                          subtitle: Text(user['email']),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ChatScreen(otherUser: user),
                              ),
                            );
                          },
                        );
                      },
                    ),
    );
  }
}
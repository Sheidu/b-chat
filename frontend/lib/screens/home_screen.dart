import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../config/app_config.dart';
import '../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../services/socket_service.dart';
import '../utils/error_formatter.dart';
import 'chat_screen.dart';
import 'discover_screen.dart';

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
    
    // ✅ Defer socket connection until after build phase completes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final socketService = Provider.of<SocketService>(context, listen: false);
      final userId = _parseOptionalUserId(auth.user?['id']);
      
      if (userId != null && !socketService.isConnected) {
        socketService.connect(userId);
      }
    });
    
    _fetchUsers();
    _subscribeToUsersUpdates();
  }

  void _subscribeToUsersUpdates() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final userId = _parseOptionalUserId(auth.user?['id']);
    if (userId == null) return;

    // ✅ Use the shared SocketService from Provider, don't create new instance
    final socketService = Provider.of<SocketService>(context, listen: false);
    socketService.listenUsersChanged(_fetchUsers);
  }

  Future<void> _fetchUsers() async {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final response = await http.get(
        Uri.parse('${AppConfig.baseUrl}/users'),
        headers: auth.authJsonHeaders,
      );

      if (response.statusCode == 200) {
        setState(() {
          _users = jsonDecode(response.body);
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'loadUsersError';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'networkError:${e.toString()}';
        _isLoading = false;
      });
    }
  }

  int? _parseOptionalUserId(dynamic rawId) {
    if (rawId == null) return null;
    if (rawId is int) return rawId;
    if (rawId is num) return rawId.toInt();
    if (rawId is String) return int.tryParse(rawId);
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final auth = Provider.of<AuthProvider>(context);
    final currentUserId = auth.user?['id'];
    final currentUserName = auth.user?['name'] ?? l10n.appName;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.homeTitle(currentUserName)),
        actions: [
          // Settings button
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.pushNamed(context, '/settings');
            },
            tooltip: l10n.settingsTitle,
          ),
          // Logout button
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
            tooltip: l10n.logoutButton,
          ),
        ],
      ),
      body: _isLoading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(l10n.loadingUsers, style: const TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 48, color: Colors.orange[300]),
                      const SizedBox(height: 16),
                      Text(
                        formatErrorMessage(_error, l10n, l10n.loadUsersError),
                        style: const TextStyle(color: Colors.red),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: _fetchUsers,
                        icon: const Icon(Icons.refresh),
                        label: Text(l10n.retryButton),
                      ),
                    ],
                  ),
                )
              : _users.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.group_off, size: 64, color: Colors.grey[400]),
                          const SizedBox(height: 16),
                          Text(
                            l10n.noUsersMessage,
                            style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchUsers,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: _users.length,
                        itemBuilder: (context, index) {
                          final user = _users[index];
                          if (user['id'] == currentUserId) return const SizedBox.shrink();

                          final displayName = user['nickname'] ?? user['name'] ?? user['email'] ?? '';
                          final initial = displayName.isNotEmpty
                              ? displayName[0].toUpperCase()
                              : '?';

                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: Colors.blue[100],
                              child: Text(
                                initial,
                                style: const TextStyle(
                                  color: Colors.blue,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            title: Text(displayName),
                            subtitle: Text(user['email'] ?? ''),
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
                    ),

      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final added = await Navigator.push<bool>(
            context,
            MaterialPageRoute(builder: (_) => const DiscoverScreen()),
          );
          if (added == true) {
            _fetchUsers();
          }
        },
        icon: const Icon(Icons.person_add),
        label: Text(l10n.addContactButton),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
        color: Theme.of(context).canvasColor,
        child: Text(
          l10n.complianceFooter,
          style: const TextStyle(fontSize: 10, color: Colors.grey),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
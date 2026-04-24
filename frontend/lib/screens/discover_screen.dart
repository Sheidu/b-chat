import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../config/app_config.dart';
import '../providers/auth_provider.dart';

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _isLoading = true;
  String? _error;
  List<dynamic> _users = [];

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() => setState(() {}));
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final response = await http.get(
        Uri.parse('${AppConfig.baseUrl}/users/discover'),
        headers: auth.authJsonHeaders,
      );

      if (response.statusCode != 200) {
        setState(() {
          _error = 'Failed to load users';
          _isLoading = false;
        });
        return;
      }

      setState(() {
        _users = jsonDecode(response.body);
        _isLoading = false;
      });
    } catch (err) {
      setState(() {
        _error = 'Network error: $err';
        _isLoading = false;
      });
    }
  }

  List<dynamic> get _filteredUsers {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) return _users;

    return _users.where((raw) {
      final user = raw as Map<String, dynamic>;
      final haystack = [
        user['name']?.toString() ?? '',
        user['email']?.toString() ?? '',
        user['phone_number']?.toString() ?? '',
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
  }

  Future<void> _addContact(Map<String, dynamic> user) async {
    final nicknameController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Add contact'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(user['name']?.toString() ?? user['email']?.toString() ?? ''),
              const SizedBox(height: 12),
              TextField(
                controller: nicknameController,
                decoration: const InputDecoration(
                  labelText: 'Nickname (optional)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Add')),
          ],
        );
      },
    );

    if (confirmed != true) return;

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final response = await http.post(
        Uri.parse('${AppConfig.baseUrl}/users/contacts'),
        headers: auth.authJsonHeaders,
        body: jsonEncode({
          'contactId': user['id'],
          'nickname': nicknameController.text.trim().isEmpty ? null : nicknameController.text.trim(),
        }),
      );

      if (response.statusCode >= 400) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to add contact: ${response.body}')),
        );
        return;
      }

      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Network error: $err')),
      );
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Discover users')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                hintText: 'Search by name, email, or phone',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!))
                    : _filteredUsers.isEmpty
                        ? const Center(child: Text('No users found'))
                        : ListView.builder(
                            itemCount: _filteredUsers.length,
                            itemBuilder: (context, index) {
                              final user = Map<String, dynamic>.from(_filteredUsers[index]);
                              return ListTile(
                                title: Text(user['name']?.toString() ?? user['email']?.toString() ?? ''),
                                subtitle: Text(
                                  [
                                    user['email']?.toString() ?? '',
                                    user['phone_number']?.toString() ?? '',
                                  ].where((value) => value.isNotEmpty).join(' · '),
                                ),
                                trailing: const Icon(Icons.person_add_alt_1),
                                onTap: () => _addContact(user),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

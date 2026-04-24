import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../config/app_config.dart';
import '../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../utils/error_formatter.dart';

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
          _error = 'loadUsersError';
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
        _error = 'networkError:$err';
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
        final l10n = AppLocalizations.of(context)!;
        return AlertDialog(
          title: Text(l10n.addContactDialogTitle),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(user['name']?.toString() ?? user['email']?.toString() ?? ''),
              const SizedBox(height: 12),
              TextField(
                controller: nicknameController,
                decoration: InputDecoration(
                  labelText: l10n.nicknameLabel,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l10n.cancelButton)),
            ElevatedButton(onPressed: () => Navigator.pop(context, true), child: Text(l10n.addButton)),
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
          SnackBar(content: Text(l10n.failedToAddContact(error: response.body))),
        );
        return;
      }

      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.failedToAddContact(error: err.toString()))),
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
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.discoverUsersTitle)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: l10n.searchHint,
                prefixIcon: const Icon(Icons.search),
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(formatErrorMessage(_error, l10n, l10n.loadUsersError)))
                    : _filteredUsers.isEmpty
                        ? Center(child: Text(l10n.noUsersFound))
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

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../providers/locale_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  bool _initialized = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _saveProfile(AuthProvider auth, AppLocalizations l10n) async {
    if (!_formKey.currentState!.validate()) return;

    final ok = await auth.updateProfile(
      email: _emailController.text.trim(),
      phoneNumber: _phoneController.text.trim(),
      name: _nameController.text.trim(),
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? l10n.profileUpdated : (auth.error ?? l10n.profileUpdateFailed))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final auth = Provider.of<AuthProvider>(context);
    final localeProvider = Provider.of<LocaleProvider>(context);

    if (!_initialized) {
      final user = auth.user ?? {};
      _nameController.text = (user['name'] ?? '').toString();
      _emailController.text = (user['email'] ?? '').toString();
      _phoneController.text = (user['phoneNumber'] ?? '').toString();
      _initialized = true;
    }

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Form(
            key: _formKey,
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.language),
                      title: Text(l10n.languageLabel),
                      subtitle: Text(l10n.languageSubtitle),
                    ),
                    RadioGroup<Locale>(
                      groupValue: localeProvider.locale,
                      onChanged: (Locale? value) {
                        if (value != null) localeProvider.setLocale(value);
                      },
                      child: Column(
                        children: [
                          RadioListTile<Locale>(title: Text(l10n.languageRussian), value: const Locale('ru')),
                          RadioListTile<Locale>(title: Text(l10n.languageEnglish), value: const Locale('en')),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _nameController,
                      decoration: InputDecoration(labelText: l10n.nameLabel),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _emailController,
                      decoration: InputDecoration(labelText: l10n.emailLabel),
                      validator: (value) {
                        final v = (value ?? '').trim();
                        if (v.isEmpty) return l10n.emailRequired;
                        if (!v.contains('@')) return l10n.emailInvalid;
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _phoneController,
                      decoration: InputDecoration(labelText: l10n.phoneRuLabel),
                      validator: (value) {
                        final v = (value ?? '').trim();
                        if (v.isEmpty) return l10n.phoneRuInvalid;
                        final digits = v.replaceAll(RegExp(r'\D'), '');
                        if (!(digits.length == 11 && (digits.startsWith('7') || digits.startsWith('8')))) {
                          return l10n.phoneRuInvalid;
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => _saveProfile(auth, l10n),
                        child: Text(l10n.saveButton),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: Text(l10n.logoutButton, style: const TextStyle(color: Colors.red)),
              onTap: () {
                auth.logout();
                Navigator.of(context).popUntil((route) => route.isFirst);
              },
            ),
          ),
        ],
      ),
    );
  }
}

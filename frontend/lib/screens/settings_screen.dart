import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../providers/locale_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final auth = Provider.of<AuthProvider>(context);
    final localeProvider = Provider.of<LocaleProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.settingsTitle),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Language Section
          Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ListTile(
                  leading: const Icon(Icons.language),
                  title: Text(l10n.languageLabel),
                  subtitle: Text(l10n.languageSubtitle),
                ),
                const Divider(height: 1),
                // ✅ CORRECT: RadioGroup with child (not children)
                RadioGroup<Locale>(
                  groupValue: localeProvider.locale,
                  onChanged: (Locale? value) {
                    if (value != null) {
                      localeProvider.setLocale(value);
                    }
                  },
                  child: Column(
                    children: [
                      RadioListTile<Locale>(
                        title: Text(l10n.languageRussian),
                        value: const Locale('ru'),
                      ),
                      RadioListTile<Locale>(
                        title: Text(l10n.languageEnglish),
                        value: const Locale('en'),
                      ),
                    ],
                  ),
                )
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Account Section
          Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ListTile(
                  leading: const Icon(Icons.person),
                  title: Text(l10n.accountLabel),
                  subtitle: Text(auth.user?['email'] ?? ''),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.logout, color: Colors.red),
                  title: Text(
                    l10n.logoutButton,
                    style: const TextStyle(color: Colors.red),
                  ),
                  onTap: () {
                    auth.logout();
                    Navigator.of(context).popUntil((route) => route.isFirst);
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Compliance Info
          Card(
            color: Colors.blue[50],
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.blue[700], size: 20),
                      const SizedBox(width: 8),
                      Text(
                        l10n.complianceInfoTitle,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.blue[900],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n.complianceFooter,
                    style: TextStyle(fontSize: 11, color: Colors.blue[800]),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // App Version
          Center(
            child: Text(
              l10n.appVersion('1.0.0'),
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ),
        ],
      ),
    );
  }
}
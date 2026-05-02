import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../config/app_config.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  bool _obscurePassword = true;
  bool _termsAccepted = false;

  Future<void> _openUserAgreement() async {
    final uri = Uri.parse(AppConfig.userAgreementUrl);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context)!.cannotOpenLink),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }


  Future<void> _submit(AuthProvider auth, AppLocalizations l10n) async {
    if (!_formKey.currentState!.validate()) return;

    if (!_termsAccepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.termsRequired),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 3),
        ),
      );
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final consentText = l10n.termsProcessingConsent(AppConfig.chatOwnerName);

    final success = await auth.register(
      _emailController.text.trim(),
      _phoneController.text.trim(),
      _passwordController.text,
      _nameController.text.trim(),
      termsAccepted: _termsAccepted,
      consentText: consentText,
      authChannel: 'email',
      locale: Localizations.localeOf(context).languageCode,
    );

    if (success) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(l10n.registrationSuccess),
          backgroundColor: Colors.green,
        ),
      );
      navigator.pop();
      return;
    }

    messenger.showSnackBar(
      SnackBar(
        content: Text(auth.error ?? l10n.registrationFailed),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.registerTitle),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32.0),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  const Icon(
                    Icons.person_add_rounded,
                    size: 80,
                    color: Colors.green,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    l10n.registerHeader,
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  // Name field
                  TextFormField(
                    controller: _nameController,
                    onFieldSubmitted: (_) => _submit(auth, l10n),
                    decoration: InputDecoration(
                      labelText: l10n.nameLabel,
                      prefixIcon: const Icon(Icons.person_outline),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Email field with RU compliance hint
                  TextFormField(
                    controller: _emailController,
                    decoration: InputDecoration(
                      labelText: l10n.emailLabel,
                      prefixIcon: const Icon(Icons.email_outlined),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      helperText: l10n.emailRuHint,
                      helperStyle: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    onFieldSubmitted: (_) => _submit(auth, l10n),
                    validator: (value) {
                      if (value == null || value.isEmpty) return l10n.emailRequired;
                      if (!value.contains('@')) return l10n.emailInvalid;
                      // Client-side hint for RU policy (server enforces strictly)
                      if (!value.endsWith('.ru') && !value.endsWith('.рф')) {
                        // Don't block, just hint - server will reject if policy=strict_ru_email
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  TextFormField(
                    controller: _phoneController,
                    decoration: InputDecoration(
                      labelText: l10n.phoneRuLabel,
                      prefixIcon: const Icon(Icons.phone_outlined),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    onFieldSubmitted: (_) => _submit(auth, l10n),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) return l10n.phoneRuInvalid;
                      final digits = value.replaceAll(RegExp(r'\D'), '');
                      if (!(digits.length == 11 && (digits.startsWith('7') || digits.startsWith('8')))) {
                        return l10n.phoneRuInvalid;
                      }
                      return null;
                    },
                  ),

                  const SizedBox(height: 16),

                  // Password field
                  TextFormField(
                    controller: _passwordController,
                    decoration: InputDecoration(
                      labelText: l10n.passwordLabel,
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _submit(auth, l10n),
                    validator: (value) {
                      if (value == null || value.isEmpty) return l10n.passwordRequired;
                      if (value.length < 4) return l10n.passwordTooShort;
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Terms acceptance checkbox with clickable agreement link
                  CheckboxListTile(
                    value: _termsAccepted,
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text(
                      '${l10n.termsProcessingConsent(AppConfig.chatOwnerName)} *',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 14),
                    ),
                    onChanged: (value) => setState(() => _termsAccepted = value == true),
                  ),
                  const SizedBox(height: 8),

                  // Clickable User Agreement link
                  GestureDetector(
                    onTap: _openUserAgreement,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Text(
                        l10n.termsViewLink,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.blue,
                          decoration: TextDecoration.underline,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      AppLocalizations.of(context)!.termsUrlDisplay(
                        AppConfig.userAgreementUrl,
                      ),
                      style: const TextStyle(fontSize: 12, color: Colors.blueGrey),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Register button with loading state
                  if (auth.isLoading)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(),
                    )
                  else
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton(
                        onPressed: () => _submit(auth, l10n),
                        style: ElevatedButton.styleFrom(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 2,
                        ),
                        child: Text(l10n.registerButton, style: const TextStyle(fontSize: 18)),
                      ),
                    ),

                  const SizedBox(height: 16),
                  
                  // Login navigation
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(l10n.hasAccountPrompt),
                  ),

                  // Compliance footer for RU users
                  Padding(
                    padding: const EdgeInsets.only(top: 24, bottom: 8),
                    child: Text(
                      l10n.complianceFooter,
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _nameController.dispose();
    super.dispose();
  }
}

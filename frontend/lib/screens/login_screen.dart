import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;


  Future<void> _submit(AuthProvider auth, AppLocalizations l10n) async {
    if (!_formKey.currentState!.validate()) return;

    final messenger = ScaffoldMessenger.of(context);

    final success = await auth.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (success) return;

    messenger.showSnackBar(
      SnackBar(
        content: Text(auth.error ?? l10n.loginFailed),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 4),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.chat_rounded,
                    size: 100,
                    color: Colors.blue,
                  ),
                  const SizedBox(height: 32),
                  Text(
                    l10n.appName,
                    style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n.loginTitle,
                    style: const TextStyle(fontSize: 16, color: Colors.grey),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 48),

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
                      // Client-side hint only - server enforces REGISTRATION_POLICY strictly
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
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off : Icons.visibility,
                        ),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _submit(auth, l10n),
                    validator: (value) {
                      if (value == null || value.isEmpty) return l10n.passwordRequired;
                      if (value.length < 4) return l10n.passwordMinLength;
                      return null;
                    },
                  ),
                  const SizedBox(height: 32),

                  // Login button with loading state
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
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 2,
                        ),
                        child: Text(l10n.loginButton, style: const TextStyle(fontSize: 18)),
                      ),
                    ),

                  const SizedBox(height: 16),
                  
                  // Register navigation
                  TextButton(
                    onPressed: () {
                      Navigator.pushNamed(context, '/register');
                    },
                    child: Text(l10n.noAccountPrompt),
                  ),

                  // Server error display (localized)
                  if (auth.error != null && !auth.isLoading)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Text(
                        // Prefer localized message if error matches known keys
                        _getLocalizedError(auth.error!, l10n),
                        style: const TextStyle(color: Colors.red, fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
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

  /// Maps common backend error messages to localized strings
  String _getLocalizedError(String serverError, AppLocalizations l10n) {
    // Map known backend error patterns to localized messages
    if (serverError.contains('Invalid email or password') ||
        serverError.contains('Неверный email или пароль')) {
      return l10n.loginFailed;
    }
    if (serverError.contains('Email domain not allowed') ||
        serverError.contains('Домен электронной почты не разрешён')) {
      return l10n.emailDomainNotAllowed;
    }
    if (serverError.contains('User not found') ||
        serverError.contains('Пользователь не найден')) {
      return l10n.loginFailed;
    }
    // Fallback: return original server message if no match
    return serverError;
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
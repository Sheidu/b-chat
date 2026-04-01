// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Family Chat';

  @override
  String get loginTitle => 'Sign in to continue';

  @override
  String get loginButton => 'Login';

  @override
  String get registerTitle => 'Create Account';

  @override
  String get registerHeader => 'Join the Family';

  @override
  String get registerButton => 'Create Account';

  @override
  String get emailLabel => 'Email';

  @override
  String get emailHint => 'Email';

  @override
  String get emailRequired => 'Please enter your email';

  @override
  String get emailInvalid => 'Please enter a valid email';

  @override
  String get emailRuHint => 'For RU users: .ru or .рф domains required';

  @override
  String get passwordLabel => 'Password';

  @override
  String get passwordHint => 'Password';

  @override
  String get passwordRequired => 'Please enter your password';

  @override
  String get passwordMinLength => 'Password must be at least 4 characters';

  @override
  String get passwordTooShort => 'Password too short (min 4 characters)';

  @override
  String get nameLabel => 'Name (optional)';

  @override
  String get termsCheckboxLabel => 'I accept the User Agreement';

  @override
  String get termsCheckboxSubtitle => 'Required to register an account';

  @override
  String get termsRequired => 'You must accept the User Agreement';

  @override
  String get termsViewLink => 'Read full User Agreement →';

  @override
  String termsUrlDisplay(String agreementUrl) {
    return '🔗 $agreementUrl';
  }

  @override
  String get loginFailed => 'Invalid email or password';

  @override
  String get registrationFailed => 'Registration failed';

  @override
  String get registrationSuccess => 'Account created! Please login';

  @override
  String get noAccountPrompt => 'Don\'t have an account? Register';

  @override
  String get hasAccountPrompt => 'Already have an account? Login';

  @override
  String homeTitle(String name) {
    return 'Family – $name';
  }

  @override
  String get logoutButton => 'Log out';

  @override
  String get loadingUsers => 'Loading contacts...';

  @override
  String get loadUsersError => 'Failed to load contacts';

  @override
  String networkError(String error) {
    return 'Connection error: $error';
  }

  @override
  String get noUsersMessage => 'No family members yet. Invite someone to start chatting!';

  @override
  String get retryButton => 'Retry';

  @override
  String chatTitle(String userName) {
    return 'Chat with $userName';
  }

  @override
  String get loadingMessages => 'Loading messages...';

  @override
  String get chatHint => 'Type a message...';

  @override
  String get sendMessage => 'Send message';

  @override
  String get messageSendFailed => 'Failed to send. Check your connection.';

  @override
  String get connectionLost => 'Connection lost. Reconnecting...';

  @override
  String get noMessages => 'No messages yet. Start the conversation!';

  @override
  String get connectionStatusConnected => 'Connected';

  @override
  String get connectionStatusConnecting => 'Connecting...';

  @override
  String get connectionStatusDisconnected => 'Disconnected';

  @override
  String get connectionStatusError => 'Connection error';

  @override
  String get genericError => 'An unexpected error occurred';

  @override
  String get complianceFooter => 'Registration complies with Federal Law No. 406-FZ';

  @override
  String get cannotOpenLink => 'Could not open link. Please copy the URL manually.';

  @override
  String get emailDomainNotAllowed => 'Email domain not allowed for registration';
}

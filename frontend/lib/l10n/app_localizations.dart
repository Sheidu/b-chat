import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ru.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ru')
  ];

  /// Application name displayed in app bar
  ///
  /// In en, this message translates to:
  /// **'Family Chat'**
  String get appName;

  /// No description provided for @loginTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to continue'**
  String get loginTitle;

  /// No description provided for @loginButton.
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get loginButton;

  /// No description provided for @registerTitle.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get registerTitle;

  /// No description provided for @registerHeader.
  ///
  /// In en, this message translates to:
  /// **'Join the Family'**
  String get registerHeader;

  /// No description provided for @registerButton.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get registerButton;

  /// No description provided for @emailLabel.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get emailLabel;

  /// No description provided for @emailHint.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get emailHint;

  /// No description provided for @emailRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your email'**
  String get emailRequired;

  /// No description provided for @emailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid email'**
  String get emailInvalid;

  /// No description provided for @emailRuHint.
  ///
  /// In en, this message translates to:
  /// **'For RU users: .ru or .рф domains required'**
  String get emailRuHint;

  /// No description provided for @passwordLabel.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get passwordLabel;

  /// No description provided for @passwordHint.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get passwordHint;

  /// No description provided for @passwordRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your password'**
  String get passwordRequired;

  /// No description provided for @passwordMinLength.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 4 characters'**
  String get passwordMinLength;

  /// No description provided for @passwordTooShort.
  ///
  /// In en, this message translates to:
  /// **'Password too short (min 4 characters)'**
  String get passwordTooShort;

  /// No description provided for @nameLabel.
  ///
  /// In en, this message translates to:
  /// **'Name (optional)'**
  String get nameLabel;

  /// No description provided for @termsCheckboxLabel.
  ///
  /// In en, this message translates to:
  /// **'I accept the User Agreement'**
  String get termsCheckboxLabel;

  /// No description provided for @termsCheckboxSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Required to register an account'**
  String get termsCheckboxSubtitle;

  /// No description provided for @termsProcessingConsent.
  ///
  /// In en, this message translates to:
  /// **'I understand that this is a family chat. My messages are stored on the server of {ownerName}. I agree to such processing for family purposes.'**
  String termsProcessingConsent(String ownerName);

  /// No description provided for @termsRequired.
  ///
  /// In en, this message translates to:
  /// **'You must accept the User Agreement'**
  String get termsRequired;

  /// No description provided for @termsViewLink.
  ///
  /// In en, this message translates to:
  /// **'Read full User Agreement →'**
  String get termsViewLink;

  /// Display truncated agreement URL
  ///
  /// In en, this message translates to:
  /// **'🔗 {agreementUrl}'**
  String termsUrlDisplay(String agreementUrl);

  /// No description provided for @loginFailed.
  ///
  /// In en, this message translates to:
  /// **'Invalid email or password'**
  String get loginFailed;

  /// No description provided for @registrationFailed.
  ///
  /// In en, this message translates to:
  /// **'Registration failed'**
  String get registrationFailed;

  /// No description provided for @registrationSuccess.
  ///
  /// In en, this message translates to:
  /// **'Account created! Please login'**
  String get registrationSuccess;

  /// No description provided for @noAccountPrompt.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account? Register'**
  String get noAccountPrompt;

  /// No description provided for @hasAccountPrompt.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? Login'**
  String get hasAccountPrompt;

  /// Home screen title with user name
  ///
  /// In en, this message translates to:
  /// **'Family – {name}'**
  String homeTitle(String name);

  /// No description provided for @logoutButton.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get logoutButton;

  /// No description provided for @loadingUsers.
  ///
  /// In en, this message translates to:
  /// **'Loading contacts...'**
  String get loadingUsers;

  /// No description provided for @loadUsersError.
  ///
  /// In en, this message translates to:
  /// **'Failed to load contacts'**
  String get loadUsersError;

  /// Network error message with details
  ///
  /// In en, this message translates to:
  /// **'Connection error: {error}'**
  String networkError(String error);

  /// No description provided for @noUsersMessage.
  ///
  /// In en, this message translates to:
  /// **'No family members yet. Invite someone to start chatting!'**
  String get noUsersMessage;

  /// No description provided for @retryButton.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retryButton;

  /// Chat screen title with recipient name
  ///
  /// In en, this message translates to:
  /// **'Chat with {userName}'**
  String chatTitle(String userName);

  /// No description provided for @loadingMessages.
  ///
  /// In en, this message translates to:
  /// **'Loading messages...'**
  String get loadingMessages;

  /// No description provided for @chatHint.
  ///
  /// In en, this message translates to:
  /// **'Type a message...'**
  String get chatHint;

  /// No description provided for @sendMessage.
  ///
  /// In en, this message translates to:
  /// **'Send message'**
  String get sendMessage;

  /// No description provided for @messageSendFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to send. Check your connection.'**
  String get messageSendFailed;

  /// No description provided for @connectionLost.
  ///
  /// In en, this message translates to:
  /// **'Connection lost. Reconnecting...'**
  String get connectionLost;

  /// No description provided for @noMessages.
  ///
  /// In en, this message translates to:
  /// **'No messages yet. Start the conversation!'**
  String get noMessages;

  /// No description provided for @connectionStatusConnected.
  ///
  /// In en, this message translates to:
  /// **'Connected'**
  String get connectionStatusConnected;

  /// No description provided for @connectionStatusConnecting.
  ///
  /// In en, this message translates to:
  /// **'Connecting...'**
  String get connectionStatusConnecting;

  /// No description provided for @connectionStatusDisconnected.
  ///
  /// In en, this message translates to:
  /// **'Disconnected'**
  String get connectionStatusDisconnected;

  /// No description provided for @connectionStatusError.
  ///
  /// In en, this message translates to:
  /// **'Connection error'**
  String get connectionStatusError;

  /// No description provided for @genericError.
  ///
  /// In en, this message translates to:
  /// **'An unexpected error occurred'**
  String get genericError;

  /// No description provided for @complianceFooter.
  ///
  /// In en, this message translates to:
  /// **'Registration complies with Federal Law No. 406-FZ'**
  String get complianceFooter;

  /// No description provided for @cannotOpenLink.
  ///
  /// In en, this message translates to:
  /// **'Could not open link. Please copy the URL manually.'**
  String get cannotOpenLink;

  /// No description provided for @emailDomainNotAllowed.
  ///
  /// In en, this message translates to:
  /// **'Email domain not allowed for registration'**
  String get emailDomainNotAllowed;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @languageLabel.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageLabel;

  /// No description provided for @languageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Select your preferred language'**
  String get languageSubtitle;

  /// No description provided for @languageDefaultHint.
  ///
  /// In en, this message translates to:
  /// **'(Default for compliance)'**
  String get languageDefaultHint;

  /// No description provided for @accountLabel.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get accountLabel;

  /// No description provided for @complianceInfoTitle.
  ///
  /// In en, this message translates to:
  /// **'Compliance Information'**
  String get complianceInfoTitle;

  /// App version display
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String appVersion(String version);

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageRussian.
  ///
  /// In en, this message translates to:
  /// **'Russian'**
  String get languageRussian;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['en', 'ru'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {


  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en': return AppLocalizationsEn();
    case 'ru': return AppLocalizationsRu();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.'
  );
}

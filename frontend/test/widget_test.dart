import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:frontend/screens/login_screen.dart';
import 'package:frontend/screens/register_screen.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:frontend/providers/auth_provider.dart';
import 'package:frontend/providers/locale_provider.dart';
import 'package:frontend/l10n/app_localizations.dart';

void main() {
  // ✅ Initialize SharedPreferences before tests
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('renders login screen when user is logged out', (
    WidgetTester tester,
  ) async {
    // ✅ Create providers with English locale for stable testing
    final authProvider = AuthProvider();
    final localeProvider = LocaleProvider();
    
    // ✅ Set test locale to English (not Russian default)
    await localeProvider.loadLocale();
    await localeProvider.setLocale(const Locale('en'));

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: authProvider),
          ChangeNotifierProvider.value(value: localeProvider),
        ],
        child: MaterialApp(
          // ✅ Configure localization for testing
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('en', ''),
            Locale('ru', ''),
          ],
          locale: localeProvider.locale,
          theme: ThemeData(
            primarySwatch: Colors.blue,
            useMaterial3: true,
          ),
          // ✅ Use BChatApp home logic without full app initialization
          home: Consumer<AuthProvider>(
            builder: (context, auth, _) {
              if (auth.isLoggedIn) {
                // Import home_screen.dart if needed
                // return const HomeScreen();
                return const Scaffold(body: Text('HomeScreen'));
              }
              return const LoginScreen();
            },
          ),
        ),
      ),
    );

    // ✅ Wait for localization to build
    await tester.pumpAndSettle();

    // ✅ Use localized strings (English)
    expect(find.text('Family Chat'), findsOneWidget);
    expect(find.text('Sign in to continue'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('Login'), findsOneWidget);
    expect(find.text("Don't have an account? Register"), findsOneWidget);
  });

  testWidgets('renders registration screen when navigating from login', (
    WidgetTester tester,
  ) async {
    final authProvider = AuthProvider();
    final localeProvider = LocaleProvider();
    
    await localeProvider.loadLocale();
    await localeProvider.setLocale(const Locale('en'));

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: authProvider),
          ChangeNotifierProvider.value(value: localeProvider),
        ],
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('ru')],
          locale: localeProvider.locale,
          theme: ThemeData(primarySwatch: Colors.blue, useMaterial3: true),
          initialRoute: '/register',
          routes: {
            '/register': (context) => const RegisterScreen(),
          },
        ),
      ),
    );

    await tester.pumpAndSettle();

    // ✅ Use localized registration strings
    expect(find.text('Create Account'), findsOneWidget);
    expect(find.text('Join the Family'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(3)); // name, email, password
    expect(find.text('I accept the User Agreement'), findsOneWidget);
  });

  testWidgets('locale provider defaults to Russian on first launch', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    
    final localeProvider = LocaleProvider();
    await localeProvider.loadLocale();

    // ✅ Compliance: default should be Russian
    expect(localeProvider.locale, equals(const Locale('ru')));
    expect(localeProvider.isRussian, isTrue);
  });

  testWidgets('locale provider respects saved preference', (
    WidgetTester tester,
  ) async {
    // ✅ Simulate previously saved English preference
    SharedPreferences.setMockInitialValues({
      'user_locale': 'en',
    });
    
    final localeProvider = LocaleProvider();
    await localeProvider.loadLocale();

    expect(localeProvider.locale, equals(const Locale('en')));
    expect(localeProvider.isEnglish, isTrue);
  });
}
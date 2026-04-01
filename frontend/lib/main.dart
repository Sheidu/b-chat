import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'l10n/app_localizations.dart';
import 'providers/auth_provider.dart';
import 'services/socket_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BChatApp());
}

class BChatApp extends StatelessWidget {
  const BChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => SocketService(), lazy: true),
      ],
      child: MaterialApp(
        title: AppLocalizations.of(context)?.appName ?? 'Family Chat',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          primarySwatch: Colors.blue,
          useMaterial3: true,
          textTheme: const TextTheme(bodySmall: TextStyle(fontSize: 10)),
        ),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en', ''), Locale('ru', '')],
        locale: const Locale('ru', ''),
        localeResolutionCallback: (locale, supportedLocales) {
          if (locale?.languageCode == 'ru') return const Locale('ru', '');
          return const Locale('en', '');
        },
        home: Consumer<AuthProvider>(
          builder: (context, auth, _) {
            if (auth.isLoggedIn) {
              return const HomeScreen();
            }
            return const LoginScreen();
          },
        ),
        routes: {'/register': (context) => const RegisterScreen()},
        onUnknownRoute: (settings) {
          return MaterialPageRoute(builder: (_) => const LoginScreen());
        },
        builder: (context, child) {
          _setErrorWidgetBuilder(context);
          return child ?? const SizedBox();
        },
      ),
    );
  }

  void _setErrorWidgetBuilder(BuildContext context) {
    ErrorWidget.builder = (FlutterErrorDetails errorDetails) {
      if (kDebugMode) {
        // ✅ In debug mode, show detailed error with exception message
        return ErrorWidget.withDetails(message: errorDetails.exception.toString());
      }
      // In production, show localized user-friendly error
      final l10n = AppLocalizations.of(context);
      return Material(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 16),
                Text(
                  l10n?.genericError ?? 'An unexpected error occurred',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text(
                  l10n?.complianceFooter ?? '',
                  style: const TextStyle(fontSize: 10, color: Colors.grey),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false),
                  child: Text(l10n?.retryButton ?? 'Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    };
  }
}
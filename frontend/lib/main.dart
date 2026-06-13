import 'package:flutter/material.dart';
import 'dart:io';
import 'package:window_manager/window_manager.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';

import 'l10n/app_localizations.dart';
import 'providers/auth_provider.dart';
import 'providers/locale_provider.dart';
import 'services/socket_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';
import 'screens/settings_screen.dart';

const int _singleInstancePort = 47123;
ServerSocket? _singleInstanceServer;

bool get _isDesktopPlatform => !kIsWeb && (Platform.isWindows || Platform.isLinux || Platform.isMacOS);

Future<bool> _ensureSingleInstance() async {
  if (!_isDesktopPlatform) return true;
  try {
    _singleInstanceServer = await ServerSocket.bind(InternetAddress.loopbackIPv4, _singleInstancePort);
    _singleInstanceServer!.listen((client) {
      client.listen((_) async {
        await windowManager.show();
        await windowManager.focus();
      });
    });
    return true;
  } catch (_) {
    try {
      final socket = await Socket.connect(InternetAddress.loopbackIPv4, _singleInstancePort, timeout: const Duration(milliseconds: 500));
      socket.add([1]);
      await socket.flush();
      await socket.close();
    } catch (_) {}
    return false;
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (_isDesktopPlatform) {
    await windowManager.ensureInitialized();
  }

  final shouldRun = await _ensureSingleInstance();
  if (!shouldRun) return;

  // Initialize locale provider before running app
  final localeProvider = LocaleProvider();
  await localeProvider.loadLocale();  // ← Load saved locale

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => SocketService(), lazy: true),
        ChangeNotifierProvider.value(value: localeProvider),
      ],
      child: const BChatApp(),
    ),
  );
}

class BChatApp extends StatelessWidget {
  const BChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<LocaleProvider>(
      builder: (context, localeProvider, _) {
        // Show loading screen while locale is loading
        if (localeProvider.isLoading) {
          return const MaterialApp(
            home: Scaffold(
              body: Center(child: CircularProgressIndicator()),
            ),
          );
        }

        return MaterialApp(
          onGenerateTitle: (context) => AppLocalizations.of(context)!.appName,
          debugShowCheckedModeBanner: false,

          // 🌍 Locale configuration
          locale: localeProvider.locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          localeResolutionCallback: (deviceLocale, supportedLocales) {
            final selected = localeProvider.locale;
            if (selected != null) {
              return selected;
            }

            if (deviceLocale != null) {
              final matched = supportedLocales.where(
                (locale) => locale.languageCode == deviceLocale.languageCode,
              );
              if (matched.isNotEmpty) {
                return matched.first;
              }
            }

            return const Locale('ru');
          },

          theme: ThemeData(
            primarySwatch: Colors.blue,
            useMaterial3: true,
            textTheme: const TextTheme(bodySmall: TextStyle(fontSize: 10)),
          ),

          home: Consumer<AuthProvider>(
            builder: (context, auth, _) {
              if (auth.isLoggedIn) {
                return const HomeScreen();
              }
              return const LoginScreen();
            },
          ),

          routes: {
            '/register': (context) => const RegisterScreen(),
            '/settings': (context) => const SettingsScreen(),
          },

          onUnknownRoute: (settings) {
            return MaterialPageRoute(builder: (_) => const LoginScreen());
          },

          builder: (context, child) {
            _setErrorWidgetBuilder(context);
            return child ?? const SizedBox();
          },
        );
      },
    );
  }

  void _setErrorWidgetBuilder(BuildContext context) {
    ErrorWidget.builder = (FlutterErrorDetails errorDetails) {
      if (kDebugMode) {
        return ErrorWidget.withDetails(message: errorDetails.exception.toString());
      }
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
                  l10n?.genericError ?? 'Произошла непредвиденная ошибка',
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
                  child: Text(l10n?.retryButton ?? 'Повторить'),
                ),
              ],
            ),
          ),
        ),
      );
    };
  }
}

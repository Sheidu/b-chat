import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/providers/auth_provider.dart';
import 'package:frontend/screens/login_screen.dart';
import 'package:frontend/screens/register_screen.dart';

class FakeAuthProvider extends AuthProvider {
  int loginCalls = 0;
  int registerCalls = 0;

  @override
  Future<bool> login(String email, String password) async {
    loginCalls += 1;
    return false;
  }

  @override
  Future<bool> register(
    String email,
    String password,
    String name, {
    required bool termsAccepted,
    required String consentText,
    String authChannel = 'email',
  }) async {
    registerCalls += 1;
    return false;
  }
}

Widget wrap(Widget child, AuthProvider auth) {
  return ChangeNotifierProvider<AuthProvider>.value(
    value: auth,
    child: MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en', ''), Locale('ru', '')],
      locale: const Locale('en', ''),
      routes: {'/register': (_) => const RegisterScreen()},
      home: child,
    ),
  );
}

void main() {
  testWidgets('login submits on Enter key the same as button', (tester) async {
    final auth = FakeAuthProvider();
    await tester.pumpWidget(wrap(const LoginScreen(), auth));

    await tester.enterText(find.byType(TextFormField).at(0), 'user@example.ru');
    await tester.enterText(find.byType(TextFormField).at(1), 'pass1234');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();

    expect(auth.loginCalls, 1);
  });

  testWidgets('register submits on Enter key the same as button', (tester) async {
    final auth = FakeAuthProvider();
    await tester.pumpWidget(wrap(const RegisterScreen(), auth));

    await tester.enterText(find.byType(TextFormField).at(0), 'Name');
    await tester.enterText(find.byType(TextFormField).at(1), 'user@example.ru');
    await tester.enterText(find.byType(TextFormField).at(2), 'pass1234');
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();

    expect(auth.registerCalls, 1);
  });

  testWidgets('register screen shows explicit storage consent checkbox text', (tester) async {
    final auth = FakeAuthProvider();
    await tester.pumpWidget(wrap(const RegisterScreen(), auth));

    expect(
      find.textContaining('I understand that this is a family chat.'),
      findsOneWidget,
    );
  });
}

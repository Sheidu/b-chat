import 'package:flutter/foundation.dart';

class AppConfig {
  // Override at runtime when needed:
  // flutter run --dart-define=CHAT_API_BASE_URL=http://192.168.1.50:3000
  static const String _overrideBaseUrl = String.fromEnvironment(
    'CHAT_API_BASE_URL',
    defaultValue: '',
  );

  static const String _overrideUserAgreementUrl = String.fromEnvironment(
    'CHAT_USER_AGREEMENT_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    if (_overrideBaseUrl.isNotEmpty) return _overrideBaseUrl;

    // Reasonable defaults per platform
    if (kIsWeb) return 'http://localhost:3000';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'http://10.0.2.2:3000';
      default:
        return 'http://localhost:3000';
    }
  }

  static String get userAgreementUrl {
    if (_overrideUserAgreementUrl.isNotEmpty) return _overrideUserAgreementUrl;
    return 'https://direct.yandex.ru/base/articles/polzovatelskoe-soglashenie';
  }
}

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocaleProvider extends ChangeNotifier {
  static const String _localeKey = 'user_locale';
  static const supportedLanguages = ['ru', 'en'];
  Locale? _locale;
  bool _isLoading = true;

  Locale? get locale => _locale;
  bool get isLoading => _isLoading;

  Future<void> loadLocale() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final localeCode = prefs.getString(_localeKey);

      if (localeCode != null) {
        // ✅ Use saved locale
        _locale = Locale(localeCode);
      } else {
        // ✅ First launch → detect system locale
        final systemLocale = PlatformDispatcher.instance.locale;

        if (supportedLanguages.contains(systemLocale.languageCode)) {
          _locale = Locale(systemLocale.languageCode);
        } else {
          // ✅ Compliance-safe fallback
          _locale = const Locale('ru');
        }

        // ✅ Save detected locale immediately
        await prefs.setString(_localeKey, _locale!.languageCode);
      }
    } catch (e) {
      // Fallback to Russian on error (compliance-safe)
      _locale = const Locale('ru');
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Set and save locale preference
  Future<void> setLocale(Locale newLocale) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_localeKey, newLocale.languageCode);
      
      _locale = newLocale;
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to save locale: $e');
    }
  }

  /// Check if locale is Russian
  bool get isRussian => _locale?.languageCode == 'ru';

  /// Check if locale is English
  bool get isEnglish => _locale?.languageCode == 'en';
}
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../l10n/app_localizations.dart';

class LocaleProvider extends ChangeNotifier {
  static const String _localeKey = 'user_locale';
  static const String _defaultLanguageCode = 'ru';
  Locale? _locale;
  bool _isLoading = true;

  Locale? get locale => _locale;
  bool get isLoading => _isLoading;

  Future<void> loadLocale() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final localeCode = prefs.getString(_localeKey);
      final normalizedSavedCode = _normalizeLanguageCode(localeCode);

      if (normalizedSavedCode != null) {
        _locale = Locale(normalizedSavedCode);
      } else {
        final systemLocale = PlatformDispatcher.instance.locale;
        final normalizedSystemCode = _normalizeLanguageCode(systemLocale.languageCode);
        _locale = Locale(normalizedSystemCode ?? _defaultLanguageCode);
        await prefs.setString(_localeKey, _locale!.languageCode);
      }
    } catch (e) {
      _locale = const Locale(_defaultLanguageCode);
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Set and save locale preference
  Future<void> setLocale(Locale newLocale) async {
    final normalizedCode = _normalizeLanguageCode(newLocale.languageCode);
    if (normalizedCode == null) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_localeKey, normalizedCode);

      _locale = Locale(normalizedCode);
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to save locale: $e');
    }
  }

  String? _normalizeLanguageCode(String? code) {
    if (code == null) return null;
    final trimmed = code.trim().toLowerCase();
    final isSupported = AppLocalizations.supportedLocales.any(
      (locale) => locale.languageCode == trimmed,
    );
    return isSupported ? trimmed : null;
  }

  /// Check if locale is Russian
  bool get isRussian => _locale?.languageCode == 'ru';

  /// Check if locale is English
  bool get isEnglish => _locale?.languageCode == 'en';
}
